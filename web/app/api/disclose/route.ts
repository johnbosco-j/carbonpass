import { z } from "zod";
import type { Hex } from "viem";
import { passport, publicClient } from "@/lib/chain/server";

const Body = z.object({
  batchId: z.number().int().positive(),
  leaf: z.tuple([z.string(), z.string(), z.string(), z.string().regex(/^0x[0-9a-fA-F]{64}$/)]),
  proof: z.array(z.string().regex(/^0x[0-9a-fA-F]{64}$/)),
});

/** Asks the contract whether a disclosed evidence leaf belongs to the batch's committed Merkle root. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: parsed.error.message }, { status: 400 });
  const { batchId, leaf, proof } = parsed.data;
  const included = await publicClient.readContract({
    ...passport,
    functionName: "verifyDisclosure",
    args: [BigInt(batchId), leaf[0], leaf[1], leaf[2], leaf[3] as Hex, proof as Hex[]],
  });
  return Response.json({ included });
}
