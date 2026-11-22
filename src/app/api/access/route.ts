import { connection } from "next/server";
import { z } from "zod";
import { db, hasDb } from "@/lib/supabase/server";
import { flags } from "@/lib/env";
import { clientIp, limiter } from "@/lib/api/ratelimit";
import { generateApiKey } from "@/lib/api/keys";

const Body = z.object({ email: z.email().max(200), consent: z.literal(true) });

// « Get API access » : liste d'attente (phase 1), ou clé gratuite si PUBLIC_API_KEYS=true (phase 2).
// Limité : 3 demandes par jour et par visiteur (compteur en mémoire, IP jamais stockée).
export async function POST(request: Request) {
  await connection();
  if (!limiter("access").hit(clientIp(request.headers), 3).allowed) {
    return Response.json({ error: { code: "rate_limited", message: "Too many requests today" } }, { status: 429, headers: { "Retry-After": "3600" } });
  }
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: { code: "invalid", message: "Enter a valid email and tick the box" } }, { status: 400 });
  if (!hasDb()) return Response.json({ error: { code: "unavailable", message: "Try again later" } }, { status: 503 });
  const email = parsed.data.email.trim().toLowerCase();
  const client = db();

  if (!flags.publicApiKeys()) {
    const { error } = await client.from("waitlist").upsert({ email, kind: "api" }, { onConflict: "email,kind", ignoreDuplicates: true });
    if (error) return Response.json({ error: { code: "unavailable", message: "Try again later" } }, { status: 503 });
    return Response.json({ ok: true, waitlist: true });
  }

  // Une seule clé gratuite active par email
  const { data: existing } = await client.from("api_keys").select("id").eq("email", email).eq("plan", "free").eq("active", true).limit(1);
  if (existing?.length) {
    return Response.json({ error: { code: "exists", message: "This email already has a free key. Contact us to replace it." } }, { status: 409 });
  }
  const { key, hash, prefix } = generateApiKey();
  const { error } = await client.from("api_keys").insert({ key_hash: hash, prefix, plan: "free", email, label: "self-serve" });
  if (error) return Response.json({ error: { code: "unavailable", message: "Try again later" } }, { status: 503 });
  return Response.json({ ok: true, key }, { headers: { "Cache-Control": "no-store" } });
}
