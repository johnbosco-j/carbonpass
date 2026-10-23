import { readState } from "@/lib/chain/state";
import { jsonSafe } from "@/lib/chain/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const minBlock = Number(new URL(req.url).searchParams.get("minBlock") ?? 0) || 0;
  try {
    return Response.json(jsonSafe(await readState(minBlock)));
  } catch (err) {
    return Response.json({ error: `Chain unavailable: ${err instanceof Error ? err.message : String(err)}` }, { status: 503 });
  }
}
