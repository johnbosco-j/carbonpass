/**
 * Server-only chain access. API routes act on behalf of demo roles with testnet keys held in env
 * (localhost uses the public Hardhat test mnemonic). In production each party signs with its own wallet/HSM.
 */
import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  parseEventLogs,
  toBytes,
  type Address,
  type Hex,
} from "viem";
import { mnemonicToAccount, privateKeyToAccount, type Account } from "viem/accounts";
import { hardhat, sepolia } from "viem/chains";
import { passportAbi, registryAbi } from "./abi";
import deployments from "./deployments.json";

export type Role = "registrar" | "producer" | "verifier" | "importerA" | "importerB";
export const ROLES: Role[] = ["registrar", "producer", "verifier", "importerA", "importerB"];

const NETWORK = (process.env.NETWORK ?? "localhost") as "localhost" | "sepolia";
const LOCAL_MNEMONIC = "test test test test test test test test test test test junk";
const LOCAL_INDEX: Record<Role, number> = { registrar: 0, producer: 1, verifier: 2, importerA: 3, importerB: 4 };
const ENV_KEY: Record<Role, string> = {
  registrar: "DEPLOYER_PRIVATE_KEY",
  producer: "PRODUCER_PRIVATE_KEY",
  verifier: "VERIFIER_PRIVATE_KEY",
  importerA: "IMPORTER_A_PRIVATE_KEY",
  importerB: "IMPORTER_B_PRIVATE_KEY",
};

type Deployment = Omit<(typeof deployments)["localhost"], "explorer"> & { explorer: string | null };
export const deployment: Deployment = (deployments as unknown as Record<string, Deployment>)[NETWORK];
if (!deployment) throw new Error(`No deployment for NETWORK=${NETWORK}. Run the deploy script first.`);

export const chain = NETWORK === "sepolia" ? sepolia : hardhat;
const rpcUrl = process.env.RPC_URL ?? (NETWORK === "sepolia" ? "https://ethereum-sepolia-rpc.publicnode.com" : "http://127.0.0.1:8545");
const transport = http(rpcUrl);

export const publicClient = createPublicClient({ chain, transport });
export const passport = { address: deployment.passport as Address, abi: passportAbi } as const;
export const registry = { address: deployment.registry as Address, abi: registryAbi } as const;

export function roleAccount(role: Role): Account {
  if (NETWORK === "localhost") return mnemonicToAccount(LOCAL_MNEMONIC, { addressIndex: LOCAL_INDEX[role] });
  const key = process.env[ENV_KEY[role]];
  if (!key) throw new Error(`${ENV_KEY[role]} is not set`);
  return privateKeyToAccount(key as Hex);
}

export function roleAddress(role: Role): Address {
  // The registrar (deployer) never signs from the web app, so its key doesn't need to be deployed.
  if (role === "registrar" && NETWORK !== "localhost") return deployment.registrar as Address;
  return roleAccount(role).address;
}

export const explorerTx = (hash: string) => (deployment.explorer ? `${deployment.explorer}/tx/${hash}` : null);
export const explorerAddress = (addr: string) => (deployment.explorer ? `${deployment.explorer}/address/${addr}` : null);

// ------------------------------------------------------------------ writes

export interface RevertInfo {
  name: string;
  args: unknown[];
  message: string;
}

export interface TxResult {
  ok: boolean;
  hash?: Hex;
  explorer?: string | null;
  blockNumber?: number;
  logs?: unknown[];
  revert?: RevertInfo;
  error?: string;
}

// Selector → error name, for RPCs whose revert payload viem can't decode against the ABI.
const ERROR_SELECTORS = new Map(
  [...passportAbi, ...registryAbi]
    .filter((i) => i.type === "error")
    .map((i) => [keccak256(toBytes(`${i.name}(${i.inputs.map((x) => x.type).join(",")})`)).slice(0, 10), i.name] as const),
);

function decodeRevert(err: unknown): RevertInfo | null {
  if (!(err instanceof BaseError)) return null;
  const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
  if (revert instanceof ContractFunctionRevertedError && !revert.data && revert.signature) {
    const name = ERROR_SELECTORS.get(revert.signature);
    if (name) return { name, args: [], message: revert.shortMessage };
  }
  if (revert instanceof ContractFunctionRevertedError && revert.data) {
    const args = ((revert.data.args ?? []) as unknown[]).map((a) => (typeof a === "bigint" ? a.toString() : a));
    return { name: revert.data.errorName, args, message: revert.shortMessage };
  }
  return null;
}

type WriteFn<A extends readonly unknown[]> = Extract<A[number], { type: "function"; stateMutability: "nonpayable" }> extends {
  name: infer N;
}
  ? N
  : never;
type PassportFn = WriteFn<typeof passportAbi>;
type RegistryFn = WriteFn<typeof registryAbi>;

// Serialise transactions per role so concurrent requests never race on the account nonce.
const roleQueues = new Map<Role, Promise<unknown>>();
function enqueue<T>(role: Role, job: () => Promise<T>): Promise<T> {
  const next = (roleQueues.get(role) ?? Promise.resolve()).then(job, job);
  roleQueues.set(role, next.catch(() => undefined));
  return next;
}

export interface SendOpts {
  /** Broadcast even if simulation reverts, so the rejection is recorded on-chain (explorer-visible). */
  forceOnchain?: boolean;
  target?: "passport" | "registry";
  /** Read-your-writes: the caller's last known block (e.g. its previous transaction). */
  minBlock?: number;
}

/**
 * Simulate, then send. Simulation and gas estimation are pinned to the newest block we know contains our own
 * writes, because public RPCs are load-balanced and a node may still be a block or two behind.
 */
export function sendAs(role: Role, functionName: PassportFn | RegistryFn, args: readonly unknown[], opts: SendOpts = {}): Promise<TxResult> {
  return enqueue(role, () => send(role, functionName, args, opts));
}

let lastWriteBlock = 0n;
const nextNonce = new Map<string, number>();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retries calls that fail because the node serving them hasn't caught up (anything that isn't a contract revert). */
export async function retryLag<T>(fn: () => Promise<T>, attempts = 10): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (err) {
      const revert = decodeRevert(err);
      // A revert is final, except "this batch doesn't exist / isn't in that state yet", which on a
      // load-balanced RPC right after our own write usually means the node is behind.
      const lagRevert = revert && LAG_REVERTS.has(revert.name) && lastWriteBlock > 0n;
      if ((revert && !lagRevert) || i >= attempts - 1) throw err;
      await sleep(1500);
    }
  }
}
const LAG_REVERTS = new Set(["UnknownBatch", "NotPending", "NotIssued"]);

/** Highest of: latest block, our last write, the caller's last known block. Reads pinned here see our own writes. */
export async function pinnedBlock(minBlock = 0): Promise<bigint> {
  const latest = await publicClient.getBlockNumber({ cacheTime: 0 });
  const floor = BigInt(minBlock) > lastWriteBlock ? BigInt(minBlock) : lastWriteBlock;
  return latest > floor ? latest : floor;
}

async function send(role: Role, functionName: PassportFn | RegistryFn, args: readonly unknown[], opts: SendOpts): Promise<TxResult> {
  const account = roleAccount(role);
  const wallet = createWalletClient({ account, chain, transport });
  const contract = opts.target === "registry" ? registry : passport;
  const call = { ...contract, account, functionName, args };

  const nonceFor = async () => {
    const n = await publicClient.getTransactionCount({ address: account.address, blockTag: "pending" });
    return Math.max(n, nextNonce.get(account.address) ?? 0);
  };
  const broadcast = async (gas: bigint) => {
    const nonce = await nonceFor();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hash = await wallet.writeContract({ ...call, gas, nonce, chain } as any);
    nextNonce.set(account.address, nonce + 1);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.blockNumber > lastWriteBlock) lastWriteBlock = receipt.blockNumber;
    return { hash, receipt };
  };

  try {
    const blockNumber = await pinnedBlock(opts.minBlock);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await retryLag(() => publicClient.simulateContract({ ...call, blockNumber } as any));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gas = await retryLag(() => publicClient.estimateContractGas({ ...call, blockNumber } as any));
    const { hash, receipt } = await broadcast((gas * 13n) / 10n);
    const logs = parseEventLogs({ abi: contract.abi, logs: receipt.logs }).map((l) => ({ eventName: l.eventName, args: l.args }));
    return { ok: receipt.status === "success", hash, explorer: explorerTx(hash), blockNumber: Number(receipt.blockNumber), logs: jsonSafe(logs) };
  } catch (err) {
    const revert = decodeRevert(err);
    if (revert && opts.forceOnchain) {
      try {
        const { hash, receipt } = await broadcast(300_000n);
        return { ok: false, hash, explorer: explorerTx(hash), blockNumber: Number(receipt.blockNumber), revert };
      } catch {
        // Some nodes refuse to accept a transaction that reverts; the simulated revert is still the answer.
        return { ok: false, revert };
      }
    }
    return { ok: false, revert: revert ?? undefined, error: err instanceof BaseError ? err.shortMessage : String(err) };
  }
}

// ------------------------------------------------------------------ JSON helper

export function jsonSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x)));
}
