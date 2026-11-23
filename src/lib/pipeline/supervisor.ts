// Superviseur (CLAUDE.md § 5) : appelé toutes les 5 minutes par le serveur lui-même (src/instrumentation.ts →
// /api/cron/tick). Lance ce qui est dû, rattrape une analyse manquée, réessaie avec un délai croissant,
// ouvre l'incident « daily_missing ». Un bail en base garantit une seule exécution entre plusieurs conteneurs.

import { randomUUID } from "node:crypto";
import { db } from "@/lib/supabase/server";
import { closeIncident, openIncident } from "./alerts";
import { trackCron } from "./cron";
import { runDaily } from "./daily";
import { runHourly } from "./hourly";
import { dailyMissing, decideDaily, decideHourly, parisClock, type DailyDecision, type RunSummary } from "./schedule";

/** Identifiant de ce processus pour les baux. */
const HOLDER = `${process.env.HOSTNAME ?? "local"}:${process.pid}:${randomUUID().slice(0, 8)}`;

export interface TickReport {
  day: string;
  daily: DailyDecision & { started?: boolean; status?: string };
  hourly: { due: boolean; started?: boolean };
}

async function withLease<T>(job: string, seconds: number, fn: () => Promise<T>): Promise<T | null> {
  const client = db();
  const { data: got, error } = await client.rpc("claim_lease", { p_job: job, p_holder: HOLDER, p_seconds: seconds });
  if (error || !got) return null;
  try {
    return await fn();
  } finally {
    await client.rpc("release_lease", { p_job: job, p_holder: HOLDER });
  }
}

async function todayRuns(day: string): Promise<RunSummary[]> {
  const { data, error } = await db().from("analysis_runs").select("status, started_at, finished_at").eq("day", day);
  if (error) throw new Error(`analysis_runs: ${error.message}`);
  return (data ?? []) as RunSummary[];
}

async function lastHourly(): Promise<string | null> {
  const { data } = await db().from("cron_runs").select("started_at").eq("job", "hourly").order("started_at", { ascending: false }).limit(1);
  return data?.[0]?.started_at ?? null;
}

export async function tick(now: Date = new Date()): Promise<TickReport> {
  const { day } = parisClock(now);
  const runs = await todayRuns(day);
  const report: TickReport = { day, daily: decideDaily(now, runs), hourly: { due: false } };

  if (report.daily.run) {
    // Bail plus long que l'analyse la plus lente ; rendu dès la fin
    const out = await withLease("daily", 30 * 60, () => trackCron("daily", () => runDaily()));
    report.daily = { ...report.daily, started: Boolean(out), status: out?.status };
  }

  const missing = dailyMissing(now, report.daily.status === "ok" ? [...runs, { status: "ok", started_at: now.toISOString(), finished_at: null }] : runs);
  if (missing === "open") await openIncident("daily_missing", { day, attempts: runs.length, last: runs.at(-1)?.status ?? null });
  if (missing === "close") await closeIncident("daily_missing");

  // Pas de rafraîchissement pendant que l'analyse tourne : il serait aussitôt remplacé
  if (!report.daily.started && report.daily.reason !== "in_progress" && decideHourly(now, await lastHourly())) {
    report.hourly.due = true;
    const out = await withLease("hourly", 10 * 60, () => trackCron("hourly", () => runHourly()));
    report.hourly.started = Boolean(out);
  }
  return report;
}
