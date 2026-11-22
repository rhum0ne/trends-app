// Enveloppe commune des points d'accès /api/v1 : clé, limites, CORS, cache 10 minutes, erreurs propres.

import { connection } from "next/server";
import { db, hasDb } from "@/lib/supabase/server";
import { entitlements, isKeyPlan, type PlanId } from "@/lib/plans";
import { bearerKey, hashApiKey } from "./keys";
import { clientIp, limiter, monthPeriod, secondsUntilNextUtcMonth, type LimitResult } from "./ratelimit";
import type { ApiError } from "./access";

export interface ApiContext {
  plan: PlanId;
  keyId: string | null;
  url: URL;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

function headersFor(plan: PlanId, limit: LimitResult | null, extra: Record<string, string> = {}): Headers {
  const h = new Headers({ ...CORS, "Content-Type": "application/json; charset=utf-8", Vary: "Authorization", ...extra });
  h.set("Cache-Control", plan === "anonymous" ? "public, max-age=600, s-maxage=600" : "private, max-age=600");
  if (limit?.limit != null) {
    h.set("X-RateLimit-Limit", String(limit.limit));
    h.set("X-RateLimit-Remaining", String(limit.remaining ?? 0));
  }
  return h;
}

export function apiError(err: ApiError, plan: PlanId = "anonymous", extra: Record<string, string> = {}): Response {
  const h = headersFor(plan, null, extra);
  h.set("Cache-Control", "no-store");
  return new Response(JSON.stringify({ error: { code: err.code, message: err.message } }), { status: err.status, headers: h });
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS });
}

async function resolveKey(header: string | null): Promise<{ plan: PlanId; keyId: string | null } | ApiError> {
  const key = bearerKey(header);
  if (key === null) return { plan: "anonymous", keyId: null };
  if (key === "invalid") return { status: 401, code: "invalid_key", message: "Use Authorization: Bearer tk_…" };
  const { data, error } = await db().from("api_keys").select("id, plan, active").eq("key_hash", hashApiKey(key)).maybeSingle();
  if (error) return { status: 503, code: "unavailable", message: "The API is temporarily unavailable" };
  if (!data || !data.active || !isKeyPlan(data.plan)) return { status: 401, code: "invalid_key", message: "Unknown or revoked API key" };
  return { plan: data.plan, keyId: data.id };
}

async function countKeyUsage(keyId: string, plan: PlanId): Promise<LimitResult> {
  const lim = entitlements(plan).requests;
  const reset = secondsUntilNextUtcMonth();
  if (!lim) return { allowed: true, limit: null, remaining: null, resetSeconds: reset };
  try {
    const { data, error } = await db().rpc("increment_api_usage", { p_key_id: keyId, p_period: monthPeriod() });
    if (error || typeof data !== "number") return { allowed: true, limit: lim.limit, remaining: null, resetSeconds: reset };
    void db().from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyId).then(() => undefined);
    return { allowed: data <= lim.limit, limit: lim.limit, remaining: Math.max(0, lim.limit - data), resetSeconds: reset };
  } catch {
    // Un compteur en panne ne bloque jamais une requête
    return { allowed: true, limit: lim.limit, remaining: null, resetSeconds: reset };
  }
}

/** Exécute un point d'accès : `fn` renvoie le corps JSON ou une erreur. */
export async function handleApi(request: Request, fn: (ctx: ApiContext) => Promise<unknown | ApiError>): Promise<Response> {
  await connection();
  if (!hasDb()) return apiError({ status: 503, code: "unavailable", message: "The API is temporarily unavailable" });
  let plan: PlanId = "anonymous";
  try {
    const who = await resolveKey(request.headers.get("authorization"));
    if ("status" in who) return apiError(who);
    plan = who.plan;
    let limit: LimitResult | null = null;
    if (who.keyId) {
      limit = await countKeyUsage(who.keyId, plan);
    } else {
      const lim = entitlements("anonymous").requests!;
      limit = limiter("api-anon").hit(clientIp(request.headers), lim.limit);
    }
    if (!limit.allowed) {
      return apiError({ status: 429, code: "rate_limited", message: "Too many requests for your plan" }, plan, { "Retry-After": String(limit.resetSeconds) });
    }
    const body = await fn({ plan, keyId: who.keyId, url: new URL(request.url) });
    if (body && typeof body === "object" && "status" in body && "code" in body && "message" in body) return apiError(body as ApiError, plan);
    return new Response(JSON.stringify(body), { status: 200, headers: headersFor(plan, limit) });
  } catch (e) {
    console.error("api error", e instanceof Error ? e.message : e);
    // Jamais le message brut d'un service à l'écran (CLAUDE.md § 9)
    return apiError({ status: 500, code: "internal_error", message: "Something went wrong" }, plan);
  }
}
