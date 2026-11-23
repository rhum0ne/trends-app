import { connection } from "next/server";
import { env } from "@/lib/env";
import { indexNowKeyFile } from "@/lib/pipeline/indexnow";

// Fichier de clé IndexNow, servi à la racine sous /{INDEXNOW_KEY}.txt (réécriture dans next.config.ts).
export async function GET(request: Request) {
  await connection();
  const body = indexNowKeyFile(new URL(request.url).searchParams.get("key"), env("INDEXNOW_KEY"));
  if (!body) return new Response("Not found", { status: 404 });
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" } });
}
