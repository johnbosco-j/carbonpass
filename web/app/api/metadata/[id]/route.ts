import { readBatch } from "@/lib/chain/state";
import { deployment } from "@/lib/chain/server";

export const dynamic = "force-dynamic";

/** ERC-1155 metadata for a batch token (the contract's uri() points here). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const raw = (await params).id.replace(/\.json$/, "");
  const id = /^[0-9a-fA-F]{64}$/.test(raw) ? parseInt(raw, 16) : Number(raw);
  try {
    const b = await readBatch(id);
    const origin = new URL(req.url).origin;
    return Response.json({
      name: `CarbonPass batch #${id}`,
      description: `${b.tonnes.toLocaleString("en-US")} t of CN ${b.cnCode} from ${deployment.installation.name}, verified at ${(b.directKgPerT / 1000).toFixed(3)} tCO2e/t (direct incl. precursors).`,
      external_url: `${origin}/passport/${id}`,
      attributes: [
        { trait_type: "Status", value: b.status },
        { trait_type: "CN code", value: b.cnCode },
        { trait_type: "Direct kgCO2e/t", value: b.directKgPerT },
        { trait_type: "Indirect kgCO2e/t", value: b.indirectKgPerT },
        { trait_type: "Verified tonnes", value: b.tonnes },
        { trait_type: "Surrendered tonnes", value: b.surrendered },
      ],
    });
  } catch {
    return Response.json({ error: "Unknown batch" }, { status: 404 });
  }
}
