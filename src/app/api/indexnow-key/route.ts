import { connection } from "next/server";
import { env } from "@/lib/env";

// Fichier de clé IndexNow (keyLocation), servi seulement si INDEXNOW_KEY est défini.
export async function GET() {
  await connection();
  const key = env("INDEXNOW_KEY");
  if (!key) return new Response("Not found", { status: 404 });
  return new Response(key, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
