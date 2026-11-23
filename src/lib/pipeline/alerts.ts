// Alerte à l'administrateur, une seule fois par incident (CLAUDE.md § 5.7).
// Un incident reste ouvert tant que le problème dure ; il est fermé au premier succès.

import { db } from "@/lib/supabase/server";
import { adminEmails, env } from "@/lib/env";
import type { Json } from "@/lib/supabase/database.types";

export type IncidentKind = "analysis_failed" | "sources_down" | "daily_missing";

const SUBJECTS: Record<IncidentKind, string> = {
  analysis_failed: "trends°: daily analysis failed twice",
  sources_down: "trends°: fewer than two sources answered",
  daily_missing: "trends°: no forecast published today yet",
};

/** Ouvre l'incident s'il ne l'est pas déjà ; n'envoie l'email qu'à l'ouverture. Renvoie true si une alerte part. */
export async function openIncident(kind: IncidentKind, detail: Record<string, unknown>): Promise<boolean> {
  const client = db();
  const { data: open } = await client.from("incidents").select("id").eq("kind", kind).is("closed_at", null).maybeSingle();
  if (open) return false;
  const { data, error } = await client.from("incidents").insert({ kind, detail: detail as Json }).select("id").single();
  if (error || !data) return false; // un autre processus l'a ouvert entre-temps (index unique)
  const sent = await sendAdminEmail(SUBJECTS[kind], `${SUBJECTS[kind]}.\n\n${JSON.stringify(detail, null, 2)}\n\nSee /admin for details.`);
  if (sent) await client.from("incidents").update({ notified_at: new Date().toISOString() }).eq("id", data.id);
  return sent;
}

export async function closeIncident(kind: IncidentKind): Promise<void> {
  await db().from("incidents").update({ closed_at: new Date().toISOString() }).eq("kind", kind).is("closed_at", null);
}

/**
 * Email à ADMIN_EMAILS. Aucun fournisseur n'est arrêté dans CLAUDE.md : Resend si RESEND_API_KEY et ALERT_FROM
 * sont renseignés, sinon rien n'est envoyé et l'incident reste visible dans /admin (TODO.md).
 */
export async function sendAdminEmail(subject: string, text: string): Promise<boolean> {
  const key = env("RESEND_API_KEY");
  const from = env("ALERT_FROM");
  const to = adminEmails();
  if (!key || !from || to.length === 0) {
    console.warn(`[alert] ${subject} (email not configured)`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, text }),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
