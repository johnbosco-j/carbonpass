import type { Address, Hex } from "viem";
import { deployment, explorerTx, passport, publicClient, registry, roleAddress, ROLES, type Role } from "./server";

export const STATUS = ["None", "Pending", "Issued", "Rejected", "Revoked"] as const;
export type Status = (typeof STATUS)[number];

export interface BatchView {
  id: number;
  producer: Address;
  installationId: Hex;
  cnCode: number;
  periodStart: number;
  periodEnd: number;
  tonnes: number;
  directKgPerT: number;
  indirectKgPerT: number;
  dataRoot: Hex;
  reportHash: Hex;
  verifier: Address;
  pqSignatureHash: Hex;
  submittedAt: number;
  issuedAt: number;
  surrendered: number;
  status: Status;
  supply: number;
  balances: Partial<Record<Role, number>>;
}

export interface EventView {
  type: string;
  batchId: number;
  blockNumber: number;
  timestamp: number;
  txHash: Hex;
  explorer: string | null;
  args: Record<string, string | number>;
}

const OUR_EVENTS = new Set(["BatchSubmitted", "BatchIssued", "BatchRejected", "BatchRevoked", "Shipped", "Surrendered"]);
const blockTimes = new Map<bigint, number>();

async function blockTime(n: bigint) {
  if (!blockTimes.has(n)) blockTimes.set(n, Number((await publicClient.getBlock({ blockNumber: n })).timestamp));
  return blockTimes.get(n)!;
}

export async function readBatch(id: number): Promise<BatchView> {
  const b = await publicClient.readContract({ ...passport, functionName: "getBatch", args: [BigInt(id)] });
  const holders: Role[] = ["producer", "importerA", "importerB"];
  const addrs = holders.map(roleAddress);
  const [bals, supply] = await Promise.all([
    publicClient.readContract({ ...passport, functionName: "balanceOfBatch", args: [addrs, addrs.map(() => BigInt(id))] }),
    publicClient.readContract({ ...passport, functionName: "totalSupply", args: [BigInt(id)] }),
  ]);
  return {
    id,
    producer: b.producer,
    installationId: b.installationId,
    cnCode: b.cnCode,
    periodStart: Number(b.periodStart),
    periodEnd: Number(b.periodEnd),
    tonnes: Number(b.tonnes),
    directKgPerT: b.directKgPerT,
    indirectKgPerT: b.indirectKgPerT,
    dataRoot: b.dataRoot,
    reportHash: b.reportHash,
    verifier: b.verifier,
    pqSignatureHash: b.pqSignatureHash,
    submittedAt: Number(b.submittedAt),
    issuedAt: Number(b.issuedAt),
    surrendered: Number(b.surrendered),
    status: STATUS[b.status],
    supply: Number(supply),
    balances: Object.fromEntries(holders.map((r, i) => [r, Number(bals[i])])),
  };
}

export async function readEvents(batchId?: number): Promise<EventView[]> {
  const logs = await publicClient.getContractEvents({ ...passport, fromBlock: BigInt(deployment.deployBlock), toBlock: "latest" });
  const ours = logs.filter((l) => l.eventName && OUR_EVENTS.has(l.eventName));
  const views = await Promise.all(
    ours.map(async (l) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = (l as any).args as Record<string, unknown>;
      const args: Record<string, string | number> = {};
      for (const [k, v] of Object.entries(raw)) {
        if (k === "pqSignature") continue; // 3.3 KB; served by /api/pq/[id]
        args[k] = typeof v === "bigint" ? Number(v) : String(v);
      }
      return {
        type: l.eventName!,
        batchId: Number(raw.batchId),
        blockNumber: Number(l.blockNumber),
        timestamp: await blockTime(l.blockNumber!),
        txHash: l.transactionHash!,
        explorer: explorerTx(l.transactionHash!),
        args,
      } satisfies EventView;
    }),
  );
  return batchId === undefined ? views : views.filter((v) => v.batchId === batchId);
}

export async function readState() {
  const count = Number(await publicClient.readContract({ ...passport, functionName: "batchCount" }));
  const verifierAddr = roleAddress("verifier");
  const [batches, events, verifier, block] = await Promise.all([
    Promise.all(Array.from({ length: count }, (_, i) => readBatch(i + 1))),
    readEvents(),
    publicClient.readContract({ ...registry, functionName: "getVerifier", args: [verifierAddr] }),
    publicClient.getBlockNumber(),
  ]);
  return {
    network: deployment.network,
    chainId: deployment.chainId,
    explorer: deployment.explorer,
    contracts: { passport: deployment.passport, registry: deployment.registry },
    roles: Object.fromEntries(ROLES.map((r) => [r, roleAddress(r)])) as Record<Role, Address>,
    installation: deployment.installation,
    verifier: { address: verifierAddr, ...verifier, since: Number(verifier.since) },
    batches,
    events,
    latestBlock: Number(block),
  };
}

export type ChainState = Awaited<ReturnType<typeof readState>>;
