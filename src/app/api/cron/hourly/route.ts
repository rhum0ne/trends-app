import { connection } from "next/server";
import { revalidateTag } from "next/cache";
import { cronAuthorized } from "@/lib/pipeline/cron-auth";
import { trackCron } from "@/lib/pipeline/cron";
import { runHourly } from "@/lib/pipeline/hourly";
import { TRENDS_TAG } from "@/lib/trends/queries";

// Rafraîchissement léger toutes les heures (chaleur et ticker), sans IA.
export async function POST(request: Request) {
  await connection();
  if (!cronAuthorized(request.headers.get("authorization"))) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const report = await trackCron("hourly", runHourly);
    revalidateTag(TRENDS_TAG, { expire: 0 });
    return Response.json({ ok: true, ...report });
  } catch {
    return Response.json({ ok: false, error: "hourly refresh failed" }, { status: 500 });
  }
}
