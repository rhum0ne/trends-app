import { connection } from "next/server";
import { db, hasDb } from "@/lib/supabase/server";

// Contrôle de santé sans détails de connexion, avec une limite de deux secondes.
export async function GET() {
  await connection();
  let database = false;
  if (hasDb()) {
    try {
      database = await Promise.race([
        db().from("trends").select("id").limit(1).then(({ error }) => !error),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2_000)),
      ]);
    } catch {
      database = false;
    }
  }
  return Response.json({ ok: true, db: database }, { headers: { "Cache-Control": "no-store" } });
}
