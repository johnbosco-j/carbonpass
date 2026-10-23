/**
 * Seeds verified history so the demo isn't empty: April–June 2026 batches for the demo installation,
 * each submitted, verified (ML-DSA + ECDSA), partly shipped to both importers and partly surrendered.
 * The live demo then certifies July 2026.
 *
 *   pnpm --filter web seed      (NETWORK from web/.env.local)
 */
import { buildBundle, HISTORY, INSTALLATION, CN_CODE } from "@/lib/demo";
import { sha256, type EvidenceDoc } from "@/lib/evidence";
import { publicClient, passport, sendAs, roleAddress, deployment } from "@/lib/chain/server";
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

async function main() {
  console.log(`Seeding ${deployment.network} — CarbonPassport ${deployment.passport}`);
  const existing = Number(await publicClient.readContract({ ...passport, functionName: "batchCount" }));
  if (existing > 0) {
    console.log(`Already has ${existing} batches; skipping. Redeploy for a fresh demo.`);
    return;
  }
  const seed = process.env.VERIFIER_PQ_SEED as Hex;
  if (!seed) throw new Error("VERIFIER_PQ_SEED not set (run node scripts/sync-env.mjs)");
  const pq = pqKeysFromSeed(seed);

  for (const [i, month] of SEED_MONTHS.entries()) {
    const h = HISTORY.find((x) => x.month === month)!;
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

    const submitted = await must(
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
    const batchId = BigInt(i + 1);
    void submitted;

    const message = attestationMessage(deployment.chainId, deployment.passport as Hex, batchId, bundle.dataRoot, bundle.reportHash);
    await must("verify + issue (ML-DSA-65)", sendAs("verifier", "attestAndIssue", [batchId, pqSign(message, pq.secretKey)]));

    const toA = Math.round(h.activity.production_t * 0.55);
    const toB = Math.round(h.activity.production_t * 0.35);
    await must(`ship ${toA} t → importer A`, sendAs("producer", "ship", [roleAddress("importerA"), batchId, BigInt(toA), ref(`MRN-26DE-${month}-A`)]));
    await must(`ship ${toB} t → importer B`, sendAs("producer", "ship", [roleAddress("importerB"), batchId, BigInt(toB), ref(`MRN-26NL-${month}-B`)]));
    await must(`importer A surrenders ${toA} t`, sendAs("importerA", "surrender", [batchId, BigInt(toA), ref(`CBAM-DECL-2026-DE-${month}`)]));
  }
  console.log("Seed complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
