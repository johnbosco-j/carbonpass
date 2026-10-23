import { keccak256, toBytes, type Hex } from "viem";
import { z } from "zod";
import { deployment, jsonSafe, pinnedBlock, publicClient, passport, retryLag, roleAccount, roleAddress, sendAs } from "@/lib/chain/server";
import { attestationMessage, pqKeysFromSeed, pqSign } from "@/lib/pq";

export const maxDuration = 60;

const hex32 = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const importer = z.enum(["importerA", "importerB"]);
const ref = (s: string) => keccak256(toBytes(s));

const schemas = {
  submit: z.object({
    installationId: hex32,
    cnCode: z.number().int().positive(),
    periodStart: z.number().int().nonnegative(),
    periodEnd: z.number().int().positive(),
    tonnes: z.number().int().positive(),
    directKgPerT: z.number().int().nonnegative(),
    indirectKgPerT: z.number().int().nonnegative(),
    dataRoot: hex32,
    reportHash: hex32,
    precursors: z.array(z.object({ batchId: z.number().int().positive(), tonnes: z.number().int().positive() })).max(8).default([]),
  }),
  attest: z.object({ batchId: z.number().int().positive(), acknowledged: z.array(z.string()).default([]) }),
  reject: z.object({ batchId: z.number().int().positive(), reason: z.string().min(1) }),
  ship: z.object({ batchId: z.number().int().positive(), to: importer, tonnes: z.number().int().positive(), shipmentRef: z.string().min(1) }),
  surrender: z.object({ batchId: z.number().int().positive(), as: importer, tonnes: z.number().int().positive(), declarationRef: z.string().min(1) }),
  revoke: z.object({ batchId: z.number().int().positive(), reason: z.string().min(1) }),
};
type Action = keyof typeof schemas;

function verifierPqKeys() {
  const seed = process.env.VERIFIER_PQ_SEED;
  if (!seed) throw new Error("VERIFIER_PQ_SEED is not set");
  return pqKeysFromSeed(seed as Hex);
}

export async function POST(req: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (!(action in schemas)) return Response.json({ error: `Unknown action ${action}` }, { status: 404 });
  const body = (await req.json()) as Record<string, unknown>;
  const parsed = schemas[action as Action].safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.message }, { status: 400 });
  const minBlock = Number(body.minBlock ?? 0) || 0;

  try {
    switch (action as Action) {
      case "submit": {
        const input = parsed.data as z.infer<typeof schemas.submit>;
        const precursors = input.precursors.map((p) => ({ batchId: BigInt(p.batchId), tonnes: BigInt(p.tonnes) }));
        const res = await sendAs(
          "producer",
          "submitBatch",
          [{ ...input, installationId: input.installationId as Hex, dataRoot: input.dataRoot as Hex, reportHash: input.reportHash as Hex, precursors }],
          // A rejected precursor claim (e.g. reusing consumed pig-iron tonnes) is broadcast anyway so the revert is on-chain.
          { minBlock, forceOnchain: precursors.length > 0 },
        );
        const ev = res.logs?.find((l) => (l as { eventName: string }).eventName === "BatchSubmitted") as { args: { batchId: string } } | undefined;
        return Response.json({ ...res, batchId: ev ? Number(ev.args.batchId) : undefined });
      }
      case "attest": {
        const { batchId } = parsed.data as z.infer<typeof schemas.attest>;
        const at = await pinnedBlock(minBlock);
        const b = await retryLag(() => publicClient.readContract({ ...passport, functionName: "getBatch", args: [BigInt(batchId)], blockNumber: at }));
        const message = attestationMessage(deployment.chainId, deployment.passport as Hex, BigInt(batchId), b.dataRoot, b.reportHash);
        const t0 = performance.now();
        const signature = pqSign(message, verifierPqKeys().secretKey);
        const signMs = performance.now() - t0;
        const res = await sendAs("verifier", "attestAndIssue", [BigInt(batchId), signature], { minBlock });
        return Response.json({
          ...res,
          pq: { scheme: "ML-DSA-65 (FIPS 204)", signatureBytes: (signature.length - 2) / 2, signatureHash: keccak256(signature), signMs: Math.round(signMs) },
        });
      }
      case "reject": {
        const { batchId, reason } = parsed.data as z.infer<typeof schemas.reject>;
        return Response.json(await sendAs("verifier", "rejectBatch", [BigInt(batchId), ref(reason)], { minBlock }));
      }
      case "ship": {
        const { batchId, to, tonnes, shipmentRef } = parsed.data as z.infer<typeof schemas.ship>;
        // forceOnchain: an over-shipment is broadcast anyway so the revert is recorded on-chain.
        return Response.json(
          await sendAs("producer", "ship", [roleAddress(to), BigInt(batchId), BigInt(tonnes), ref(shipmentRef)], { forceOnchain: true, minBlock }),
        );
      }
      case "surrender": {
        const { batchId, as, tonnes, declarationRef } = parsed.data as z.infer<typeof schemas.surrender>;
        return Response.json(await sendAs(as, "surrender", [BigInt(batchId), BigInt(tonnes), ref(declarationRef)], { minBlock }));
      }
      case "revoke": {
        const { batchId, reason } = parsed.data as z.infer<typeof schemas.revoke>;
        return Response.json(await sendAs("verifier", "revokeBatch", [BigInt(batchId), ref(reason)], { minBlock }));
      }
    }
  } catch (err) {
    return Response.json(jsonSafe({ ok: false, error: err instanceof Error ? err.message : String(err), actor: roleAccount("producer").address }), {
      status: 500,
    });
  }
}
