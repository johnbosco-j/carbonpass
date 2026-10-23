/**
 * Seeds verified history so the demo isn't empty: April–June 2026 batches for the demo installation,
 * each submitted, verified (ML-DSA + ECDSA), partly shipped to both importers and partly surrendered.
 * The live demo then certifies July 2026. Resumable: re-running picks up where a previous run stopped.
 *
 *   pnpm --filter web seed      (NETWORK from web/.env.local or the environment)
 */
import { buildBundle, HISTORY, INSTALLATION, CN_CODE } from "@/lib/demo";
import { sha256, type EvidenceDoc } from "@/lib/evidence";
import { publicClient, passport, sendAs, roleAddress, deployment, pinnedBlock, retryLag } from "@/lib/chain/server";
import { attestationMessage, pqKeysFromSeed, pqSign } from "@/lib/pq";
import { keccak256, toBytes, type Hex } from "viem";

const SEED_MONTHS = ["2026-04", "2026-05", "2026-06"];
const ref = (s: string) => keccak256(toBytes(s));

async function must<T extends { ok: boolean; error?: string; revert?: { name: string } }>(label: string, p: Promise<T>) {
  const r = await p;
  if (!r.ok) throw new Error(`${label} failed: ${r.revert?.name ?? r.error}`);
  console.log(`  ✓ ${label}`);
  return r;
}

// Reads are pinned to the block of our last write so a lagging RPC node can't hand back stale state.
async function readBatch(id: bigint) {
  const blockNumber = await pinnedBlock();
  return retryLag(() => publicClient.readContract({ ...passport, functionName: "getBatch", args: [id], blockNumber }));
}

async function main() {
  console.log(`Seeding ${deployment.network}: CarbonPassport ${deployment.passport}`);
  const seed = process.env.VERIFIER_PQ_SEED as Hex;
  if (!seed) throw new Error("VERIFIER_PQ_SEED not set (run node scripts/sync-env.mjs)");
  const pq = pqKeysFromSeed(seed);

  for (const [i, month] of SEED_MONTHS.entries()) {
    const batchId = BigInt(i + 1);
    const at = await pinnedBlock();
    const count = await retryLag(() => publicClient.readContract({ ...passport, functionName: "batchCount", blockNumber: at }));
    const h = HISTORY.find((x) => x.month === month)!;

    if (count < batchId) {
      const documents: EvidenceDoc[] = await Promise.all(
        (["gas_invoice", "electricity_invoice", "production_log"] as const).map(async (kind) => ({
          name: `${kind}_${month}.pdf`,
          kind,
          sha256: await sha256(`${INSTALLATION.code}/${month}/${kind}`),
          size: 3200,
        })),
      );
      const bundle = await buildBundle({ month, activity: h.activity, values: [], documents });
      console.log(`${month}: ${h.activity.production_t} t at ${bundle.calc.seeDirect} tCO2e/t`);
      await must(
        "submit",
        sendAs("producer", "submitBatch", [
          {
            installationId: INSTALLATION.id,
            cnCode: CN_CODE,
            periodStart: BigInt(bundle.period.start),
            periodEnd: BigInt(bundle.period.end),
            tonnes: BigInt(h.activity.production_t),
            directKgPerT: bundle.calc.directKgPerT,
            indirectKgPerT: bundle.calc.indirectKgPerT,
            dataRoot: bundle.dataRoot,
            reportHash: bundle.reportHash,
          },
        ]),
      );
    } else {
      console.log(`${month}: batch #${batchId} exists`);
    }

    let b = await readBatch(batchId);
    if (b.status === 1) {
      // Sign over the commitments as stored on-chain.
      const message = attestationMessage(deployment.chainId, deployment.passport as Hex, batchId, b.dataRoot, b.reportHash);
      await must("verify + issue (ML-DSA-65)", sendAs("verifier", "attestAndIssue", [batchId, pqSign(message, pq.secretKey)]));
      b = await readBatch(batchId);
    }

    const balAt = await pinnedBlock();
    const [balA, balB] = await retryLag(() =>
      publicClient.readContract({
        ...passport,
        functionName: "balanceOfBatch",
        args: [[roleAddress("importerA"), roleAddress("importerB")], [batchId, batchId]],
        blockNumber: balAt,
      }),
    );
    const toA = Math.round(h.activity.production_t * 0.55);
    const toB = Math.round(h.activity.production_t * 0.35);
    if (balA === 0n && b.surrendered === 0n) {
      await must(`ship ${toA} t → importer A`, sendAs("producer", "ship", [roleAddress("importerA"), batchId, BigInt(toA), ref(`MRN-26DE-${month}-A`)]));
    }
    if (balB === 0n) {
      await must(`ship ${toB} t → importer B`, sendAs("producer", "ship", [roleAddress("importerB"), batchId, BigInt(toB), ref(`MRN-26NL-${month}-B`)]));
    }
    if ((await readBatch(batchId)).surrendered === 0n) {
      await must(`importer A surrenders ${toA} t`, sendAs("importerA", "surrender", [batchId, BigInt(toA), ref(`CBAM-DECL-2026-DE-${month}`)]));
    }
  }
  console.log("Seed complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
