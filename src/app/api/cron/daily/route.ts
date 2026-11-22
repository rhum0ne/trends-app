import { after, connection } from "next/server";
import { revalidateTag } from "next/cache";
import { cronAuthorized } from "@/lib/pipeline/cron-auth";
import { trackCron } from "@/lib/pipeline/cron";
import { runDaily } from "@/lib/pipeline/daily";
import { TRENDS_TAG } from "@/lib/trends/queries";

// Tâche quotidienne, 06:30 Europe/Paris, appelée par le cron du VPS (docs/deploy.md).
// Répond tout de suite (202) et travaille en arrière-plan : l'analyse peut durer plusieurs minutes.
export async function POST(request: Request) {
  await connection();
  if (!cronAuthorized(request.headers.get("authorization"))) return Response.json({ error: "unauthorized" }, { status: 401 });
  after(async () => {
    try {
      await trackCron("daily", () => runDaily());
    } catch (e) {
      console.error("daily failed", e instanceof Error ? e.message : e);
    } finally {
      revalidateTag(TRENDS_TAG, { expire: 0 });
    }
  });
  return Response.json({ ok: true, started: true }, { status: 202 });
}
