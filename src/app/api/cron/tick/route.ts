import { after, connection } from "next/server";
import { revalidateTag } from "next/cache";
import { cronAuthorized } from "@/lib/pipeline/cron-auth";
import { tick } from "@/lib/pipeline/supervisor";
import { TRENDS_TAG } from "@/lib/trends/queries";

// Superviseur (CLAUDE.md § 5) : appelé toutes les 5 minutes par le serveur lui-même (src/instrumentation.ts).
// Peut aussi être appelé de l'extérieur, sans risque : il ne lance que ce qui est dû, une seule fois.
// Répond tout de suite (202) ; l'analyse peut durer plusieurs minutes.
export async function POST(request: Request) {
  await connection();
  if (!cronAuthorized(request.headers.get("authorization"))) return Response.json({ error: "unauthorized" }, { status: 401 });
  after(async () => {
    try {
      const report = await tick();
      if (report.daily.started || report.hourly.started) {
        console.log(`[tick] ${report.day} daily=${report.daily.reason}${report.daily.status ? `:${report.daily.status}` : ""} hourly=${report.hourly.started ? "ran" : "-"}`);
        revalidateTag(TRENDS_TAG, { expire: 0 });
      }
    } catch (e) {
      console.error("[tick] failed", e instanceof Error ? e.message : e);
    }
  });
  return Response.json({ ok: true, started: true }, { status: 202 });
}
