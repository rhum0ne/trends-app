// Décisions du superviseur (CLAUDE.md § 5) : fonctions pures, testées. Aucune dépendance à un planificateur
// externe : le serveur appelle /api/cron/tick toutes les 5 minutes et rattrape ce qui manque.

import { parisInstant } from "@/lib/format";

/** Heure de Paris de la tâche quotidienne. */
export const DAILY_AT_MINUTES = 6 * 60 + 30;
/** Au-delà, pas de prévision réussie aujourd'hui = incident « daily_missing ». */
export const DAILY_ALERT_AT_MINUTES = 9 * 60;
/** Essais par jour au plus (échecs et replis comptent ; « skipped » ne compte pas). */
export const DAILY_MAX_ATTEMPTS = 4;
/** Délai avant l'essai n+1, en minutes, après le n-ième échec. */
export const DAILY_BACKOFF_MINUTES = [15, 60, 180];
/** Une analyse « running » plus vieille que ça est considérée comme morte (conteneur arrêté en cours de route). */
export const RUNNING_STALE_MINUTES = 30;
/** Rafraîchissement léger : une fois par heure. */
export const HOURLY_EVERY_MINUTES = 55;

export interface RunSummary {
  status: "running" | "ok" | "failed" | "fallback" | "skipped";
  started_at: string;
  finished_at: string | null;
}

export interface ParisClock {
  day: string;
  /** Minutes depuis minuit, heure de Paris. */
  minutes: number;
}

export function parisClock(now: Date): ParisClock {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { day: `${get("year")}-${get("month")}-${get("day")}`, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

export type DailyDecision =
  | { run: true; reason: "due" | "retry" }
  | { run: false; reason: "too_early" | "done" | "in_progress" | "backoff" | "gave_up" };

/** Faut-il lancer l'analyse du jour maintenant ? `runs` : les analyses de la journée de Paris en cours. */
export function decideDaily(now: Date, runs: RunSummary[]): DailyDecision {
  const { minutes } = parisClock(now);
  if (minutes < DAILY_AT_MINUTES) return { run: false, reason: "too_early" };
  if (runs.some((r) => r.status === "ok")) return { run: false, reason: "done" };
  const staleBefore = now.getTime() - RUNNING_STALE_MINUTES * 60_000;
  if (runs.some((r) => r.status === "running" && Date.parse(r.started_at) > staleBefore)) return { run: false, reason: "in_progress" };
  // Échecs, replis et analyses mortes en cours de route
  const attempts = runs.filter((r) => r.status === "failed" || r.status === "fallback" || r.status === "running");
  if (attempts.length === 0) return { run: true, reason: "due" };
  if (attempts.length >= DAILY_MAX_ATTEMPTS) return { run: false, reason: "gave_up" };
  const last = Math.max(...attempts.map((r) => Date.parse(r.finished_at ?? r.started_at)));
  const wait = DAILY_BACKOFF_MINUTES[Math.min(attempts.length, DAILY_BACKOFF_MINUTES.length) - 1];
  return now.getTime() >= last + wait * 60_000 ? { run: true, reason: "retry" } : { run: false, reason: "backoff" };
}

/** Rafraîchissement léger : dû si aucun n'a démarré depuis HOURLY_EVERY_MINUTES. */
export function decideHourly(now: Date, lastStartedAt: string | null): boolean {
  if (!lastStartedAt) return true;
  return now.getTime() - Date.parse(lastStartedAt) >= HOURLY_EVERY_MINUTES * 60_000;
}

/** Incident « daily_missing » : ouvert passé 09:00 sans analyse réussie, fermé dès qu'il y en a une. */
export function dailyMissing(now: Date, runs: RunSummary[]): "open" | "close" | "wait" {
  if (runs.some((r) => r.status === "ok")) return "close";
  return parisClock(now).minutes >= DAILY_ALERT_AT_MINUTES ? "open" : "wait";
}

export type ForecastStatus =
  | { state: "ready" }
  | { state: "running" }
  | { state: "scheduled"; nextAt: Date }
  | { state: "retrying"; nextAt: Date }
  | { state: "delayed" };

/** État public de la prévision du jour, pour l'écran sans prévision (mêmes règles que le superviseur). */
export function forecastStatus(now: Date, runs: RunSummary[]): ForecastStatus {
  const decision = decideDaily(now, runs);
  if (decision.reason === "done") return { state: "ready" };
  if (decision.reason === "in_progress" || decision.run) return { state: "running" };
  if (decision.reason === "too_early") return { state: "scheduled", nextAt: parisInstant(parisClock(now).day, DAILY_AT_MINUTES) };
  if (decision.reason === "gave_up") return { state: "delayed" };
  // backoff : prochain essai = dernier essai + délai
  const attempts = runs.filter((r) => r.status === "failed" || r.status === "fallback" || r.status === "running");
  const last = Math.max(...attempts.map((r) => Date.parse(r.finished_at ?? r.started_at)));
  const wait = DAILY_BACKOFF_MINUTES[Math.min(attempts.length, DAILY_BACKOFF_MINUTES.length) - 1];
  return { state: "retrying", nextAt: new Date(last + wait * 60_000) };
}
