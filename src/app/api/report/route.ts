import { connection } from "next/server";
import { z } from "zod";
import { db, hasDb } from "@/lib/supabase/server";
import { clientIp, limiter } from "@/lib/api/ratelimit";
import { normalizeTopic, slugify } from "@/lib/normalize";

const Body = z.object({
  slug: z.string().trim().min(1).max(200),
  reason: z.enum(["sensitive", "wrong", "offensive", "other"]),
  message: z.string().trim().max(1000).nullish(),
});

// « Report this trend » : anonyme, limité à 10 par jour et par visiteur (compteur en mémoire).
export async function POST(request: Request) {
  await connection();
  if (!limiter("report").hit(clientIp(request.headers), 10).allowed) {
    return Response.json({ error: { code: "rate_limited", message: "Too many reports today" } }, { status: 429, headers: { "Retry-After": "3600" } });
  }
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: { code: "invalid", message: "Check the form" } }, { status: 400 });
  if (!hasDb()) return Response.json({ error: { code: "unavailable", message: "Try again later" } }, { status: 503 });
  // Le champ libre peut être un lien /t/{slug} ou un nom : on tente de retrouver la tendance
  const raw = parsed.data.slug.replace(/^.*\/t\//, "").replace(/[?#].*$/, "");
  const slug = /^[a-z0-9-]+$/.test(raw) ? raw : slugify(raw);
  const client = db();
  const { data: trend } = await client.from("trends").select("id, slug").or(`slug.eq.${slug},topic_key.eq."${normalizeTopic(raw).replace(/"/g, "")}"`).limit(1).maybeSingle();
  const { error } = await client.from("reports").insert({
    trend_id: trend?.id ?? null,
    slug: trend?.slug ?? raw.slice(0, 120),
    reason: parsed.data.reason,
    message: parsed.data.message || null,
  });
  if (error) return Response.json({ error: { code: "unavailable", message: "Try again later" } }, { status: 503 });
  return Response.json({ ok: true });
}
