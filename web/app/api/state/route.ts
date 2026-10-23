import { readState } from "@/lib/chain/state";
import { jsonSafe } from "@/lib/chain/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(jsonSafe(await readState()));
  } catch (err) {
    return Response.json({ error: `Chain unavailable: ${err instanceof Error ? err.message : String(err)}` }, { status: 503 });
  }
}
