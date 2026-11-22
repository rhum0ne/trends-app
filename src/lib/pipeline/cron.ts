// Chaque exécution planifiée ou manuelle est tracée dans cron_runs (CLAUDE.md § 4).

import { db } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

export async function trackCron<T>(job: "daily" | "hourly" | "manual", fn: () => Promise<T>): Promise<T> {
  const client = db();
  const { data } = await client.from("cron_runs").insert({ job }).select("id").single();
  const id = data?.id;
  try {
    const out = await fn();
    const s = (out as { status?: string } | null)?.status;
    const status = s === "skipped" ? "skipped" : s === "failed" ? "failed" : "ok";
    if (id) await client.from("cron_runs").update({ finished_at: new Date().toISOString(), status, detail: summarize(out) }).eq("id", id);
    return out;
  } catch (e) {
    if (id) await client.from("cron_runs").update({ finished_at: new Date().toISOString(), status: "failed", error: (e as Error).message.slice(0, 500) }).eq("id", id);
    throw e;
  }
}

function summarize(out: unknown): Json {
  try {
    return JSON.parse(JSON.stringify(out, (_k, v) => (typeof v === "string" && v.length > 300 ? `${v.slice(0, 300)}…` : v))) as Json;
  } catch {
    return {};
  }
}
