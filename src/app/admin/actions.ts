"use server";

import { after } from "next/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { authClient, isAdminEmail, requireAdmin } from "@/lib/supabase/auth";
import { db } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/links";
import { adminEmails, flags } from "@/lib/env";
import { parisToday } from "@/lib/format";
import { TRENDS_TAG } from "@/lib/trends/queries";
import { runDaily } from "@/lib/pipeline/daily";
import { trackCron } from "@/lib/pipeline/cron";
import { nextPhoto as nextPhotoFor, removePhoto as removePhotoFor } from "@/lib/images/store";
import { generateApiKey } from "@/lib/api/keys";
import { assignablePlans, isKeyPlan } from "@/lib/plans";
import { clientIp, hourWindow, limiter } from "@/lib/api/ratelimit";

/**
 * Lien magique : envoyé seulement aux adresses autorisées ; la réponse à l'écran est la même dans tous
 * les cas. La raison d'un non-envoi va dans les journaux du serveur, sans l'adresse (CLAUDE.md § 9).
 */
export async function sendMagicLink(form: FormData) {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const ip = clientIp(await headers());
  // 5 demandes par heure et 20 par jour et par IP ; une demande refusée par l'heure ne compte pas dans le jour.
  const now = new Date();
  const hourOk = limiter("magic-link-hour").hit(ip, 5, now, hourWindow(now)).allowed;
  const dayOk = hourOk && limiter("magic-link-day").hit(ip, 20, now).allowed;
  if (!hourOk || !dayOk) {
    console.warn(`[magic-link] not sent: rate limit reached (${hourOk ? "20 per IP per day" : "5 per IP per hour"})`);
  } else if (!isAdminEmail(email)) {
    console.warn(`[magic-link] not sent: address not in ADMIN_EMAILS (${adminEmails().length} address(es) configured)`);
  } else {
    try {
      const supabase = await authClient();
      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${SITE_URL}/auth/callback`, shouldCreateUser: true } });
      if (error?.name === "AuthRetryableFetchError") console.error(`[magic-link] Supabase Auth unreachable (check SUPABASE_URL): ${error.message}`);
      else if (error) console.error(`[magic-link] Supabase Auth refused (${error.status ?? "no status"} ${error.code ?? error.name}): ${error.message}`);
    } catch (e) {
      console.error("[magic-link] Supabase Auth unreachable:", e instanceof Error ? e.message : e);
    }
  }
  redirect("/admin/login?sent=1");
}

export async function signOut() {
  const supabase = await authClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

function id(form: FormData, name = "id"): string {
  const v = String(form.get(name) ?? "");
  if (!/^[0-9a-f-]{36}$/.test(v)) throw new Error("bad id");
  return v;
}

/** « Hide » : masquage immédiat partout, API comprise. */
export async function hideTrend(form: FormData) {
  await requireAdmin();
  const hidden = form.get("hidden") !== "false";
  await db().from("trends").update({ hidden, hidden_at: hidden ? new Date().toISOString() : null }).eq("id", id(form));
  updateTag(TRENDS_TAG);
}

/** « Make top » : la tendance devient la tendance du jour (doit être sûre pour une marque). */
export async function makeTop(form: FormData) {
  await requireAdmin();
  const trendId = id(form);
  const day = parisToday();
  const client = db();
  const { data: t } = await client.from("trends").select("brand_safe").eq("id", trendId).maybeSingle();
  if (!t?.brand_safe) return;
  await client.from("trend_days").update({ is_top: false, manual_top: false }).eq("day", day);
  await client.from("trend_days").update({ is_top: true, manual_top: true }).eq("day", day).eq("trend_id", trendId);
  updateTag(TRENDS_TAG);
}

export async function nextPhoto(form: FormData) {
  await requireAdmin();
  if (!limiter("pexels-admin").hit("admin", 60).allowed) return;
  await nextPhotoFor(id(form));
  updateTag(TRENDS_TAG);
}

export async function removePhoto(form: FormData) {
  await requireAdmin();
  await removePhotoFor(id(form));
  updateTag(TRENDS_TAG);
}

/** « Run now » : lance le pipeline en arrière-plan (tracé dans cron_runs). */
export async function runNow() {
  await requireAdmin();
  if (!limiter("run-now").hit("admin", 4).allowed) redirect("/admin?run=limited");
  after(async () => {
    try {
      await trackCron("manual", () => runDaily());
    } finally {
      // after() n'est pas une Server Action : on invalide par revalidateTag
      const { revalidateTag } = await import("next/cache");
      revalidateTag(TRENDS_TAG, { expire: 0 });
    }
  });
  redirect("/admin?run=started");
}

export async function resolveReport(form: FormData) {
  await requireAdmin();
  await db().from("reports").update({ resolved: true }).eq("id", id(form));
}

/** Crée une clé (gardée en empreinte SHA-256) ; la clé en clair n'est montrée qu'une fois à l'admin. */
export async function createKey(form: FormData) {
  await requireAdmin();
  const plan = String(form.get("plan") ?? "");
  if (!isKeyPlan(plan) || !assignablePlans({ paidPlans: flags.paidPlans() }).includes(plan)) return;
  const label = String(form.get("label") ?? "").slice(0, 80) || null;
  const email = String(form.get("email") ?? "").trim().toLowerCase().slice(0, 200) || null;
  const { key, hash, prefix } = generateApiKey();
  const { error } = await db().from("api_keys").insert({ key_hash: hash, prefix, plan, label, email });
  if (error) redirect("/admin?key=error");
  // Fragment (#) : jamais envoyé au serveur ni journalisé ; affiché une fois par la page
  redirect(`/admin#new-key=${encodeURIComponent(key)}`);
}

export async function revokeKey(form: FormData) {
  await requireAdmin();
  await db().from("api_keys").update({ active: false }).eq("id", id(form));
}
