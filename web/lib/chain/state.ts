import type { Address, Hex } from "viem";
import { deployment, explorerTx, passport, pinnedBlock, publicClient, registry, retryLag, roleAddress, ROLES, type Role } from "./server";

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
  /** Tonnes burned as a precursor of downstream batches. supply + surrendered + consumed == tonnes once issued. */
  consumed: number;
  status: Status;
  supply: number;
  /** Tonnes still held by the batch's own producer (the supplier, for a pig-iron batch). */
  producerBalance: number;
  balances: Partial<Record<Role, number>>;
  /** Verified upstream batches this batch declared as inputs; burned when it was issued. */
  precursors: { batchId: number; tonnes: number }[];
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

const OUR_EVENTS = new Set(["BatchSubmitted", "BatchIssued", "BatchRejected", "BatchRevoked", "Shipped", "Surrendered", "PrecursorConsumed"]);
const blockTimes = new Map<bigint, number>();

async function blockTime(n: bigint) {
  if (!blockTimes.has(n)) blockTimes.set(n, Number((await retryLag(() => publicClient.getBlock({ blockNumber: n }))).timestamp));
  return blockTimes.get(n)!;
}

export async function readBatch(id: number, blockNumber?: bigint): Promise<BatchView> {
  const at = blockNumber ?? (await pinnedBlock());
  const holders: Role[] = ["producer", "importerA", "importerB", "supplier"];
  const addrs = holders.map(roleAddress);
  const [b, bals, supply, precursors] = await retryLag(() =>
    Promise.all([
      publicClient.readContract({ ...passport, functionName: "getBatch", args: [BigInt(id)], blockNumber: at }),
      publicClient.readContract({ ...passport, functionName: "balanceOfBatch", args: [addrs, addrs.map(() => BigInt(id))], blockNumber: at }),
      publicClient.readContract({ ...passport, functionName: "totalSupply", args: [BigInt(id)], blockNumber: at }),
      publicClient.readContract({ ...passport, functionName: "getPrecursors", args: [BigInt(id)], blockNumber: at }),
    ]),
  );
  const balances = Object.fromEntries(holders.map((r, i) => [r, Number(bals[i])])) as Partial<Record<Role, number>>;
  const producerRole = holders.find((_, i) => addrs[i].toLowerCase() === b.producer.toLowerCase());
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
    consumed: Number(b.consumed),
    status: STATUS[b.status],
    supply: Number(supply),
    producerBalance: producerRole ? (balances[producerRole] ?? 0) : 0,
    balances,
    precursors: precursors.map((p) => ({ batchId: Number(p.batchId), tonnes: Number(p.tonnes) })),
  };
}

export async function readEvents(batchId?: number, toBlock?: bigint): Promise<EventView[]> {
  const to = toBlock ?? (await pinnedBlock());
  const logs = await retryLag(() => publicClient.getContractEvents({ ...passport, fromBlock: BigInt(deployment.deployBlock), toBlock: to }));
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

/** Full demo state, read at one pinned block (>= the caller's last known block) so it's internally consistent. */
export async function readState(minBlock = 0) {
  const block = await pinnedBlock(minBlock);
  const count = Number(await retryLag(() => publicClient.readContract({ ...passport, functionName: "batchCount", blockNumber: block })));
  const verifierAddr = roleAddress("verifier");
  const [batches, events, verifier] = await Promise.all([
    Promise.all(Array.from({ length: count }, (_, i) => readBatch(i + 1, block))),
    readEvents(undefined, block),
    retryLag(() => publicClient.readContract({ ...registry, functionName: "getVerifier", args: [verifierAddr], blockNumber: block })),
  ]);
  return {
    network: deployment.network,
    chainId: deployment.chainId,
    explorer: deployment.explorer,
    deployedAt: deployment.deployedAt,
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
