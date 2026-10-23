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
  parseEventLogs,
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

type Deployment = (typeof deployments)["localhost"];
export const deployment: Deployment = (deployments as Record<string, Deployment>)[NETWORK];
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

function decodeRevert(err: unknown): RevertInfo | null {
  if (!(err instanceof BaseError)) return null;
  const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
  if (revert instanceof ContractFunctionRevertedError && revert.data) {
    return { name: revert.data.errorName, args: (revert.data.args ?? []) as unknown[], message: revert.shortMessage };
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

/**
 * Simulate, then send. If the contract would revert and `forceOnchain` is set, the transaction is still
 * broadcast with a fixed gas limit so the failure is recorded on-chain (visible on the explorer).
 */
export function sendAs(
  role: Role,
  functionName: PassportFn | RegistryFn,
  args: readonly unknown[],
  opts: { forceOnchain?: boolean; target?: "passport" | "registry" } = {},
): Promise<TxResult> {
  return enqueue(role, () => send(role, functionName, args, opts));
}

async function send(
  role: Role,
  functionName: PassportFn | RegistryFn,
  args: readonly unknown[],
  opts: { forceOnchain?: boolean; target?: "passport" | "registry" },
): Promise<TxResult> {
  const account = roleAccount(role);
  const wallet = createWalletClient({ account, chain, transport });
  const contract = opts.target === "registry" ? registry : passport;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { request } = await publicClient.simulateContract({ ...contract, account, functionName, args } as any);
    const hash = await wallet.writeContract(request);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const logs = parseEventLogs({ abi: contract.abi, logs: receipt.logs }).map((l) => ({ eventName: l.eventName, args: l.args }));
    return { ok: receipt.status === "success", hash, explorer: explorerTx(hash), blockNumber: Number(receipt.blockNumber), logs: jsonSafe(logs) };
  } catch (err) {
    const revert = decodeRevert(err);
    if (revert && opts.forceOnchain) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hash = await wallet.writeContract({ ...contract, functionName, args, gas: 300_000n, chain } as any);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
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
