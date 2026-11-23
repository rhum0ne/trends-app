import { connection } from "next/server";
import { db, hasDb } from "@/lib/supabase/server";
import { parisToday } from "@/lib/format";

// Contrôle de santé sans détails de connexion, avec une limite de deux secondes.
// `forecast` dit si l'analyse du jour a réussi (surveillance externe) ; il ne rend jamais le conteneur
// « unhealthy » : le superviseur rattrape une analyse manquée, redémarrer n'y changerait rien.
export async function GET() {
  await connection();
  let database = false;
  let forecast: "today" | "missing" | null = null;
  if (hasDb()) {
    try {
      const day = parisToday();
      const res = await Promise.race([
        db().from("analysis_runs").select("id").eq("day", day).eq("status", "ok").limit(1),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 2_000)),
      ]);
      database = Boolean(res && !res.error);
      if (res && !res.error) forecast = res.data?.length ? "today" : "missing";
    } catch {
      database = false;
    }
  }
  return Response.json({ ok: true, db: database, forecast }, { headers: { "Cache-Control": "no-store" } });
}
