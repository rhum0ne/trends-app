// Petites fonctions d'affichage, sans état.

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

export function countryName(code: string): string {
  const c = code.toUpperCase();
  if (c === "WW") return "Worldwide";
  try {
    return regionNames.of(c) ?? c;
  } catch {
    return c;
  }
}

/** "YYYY-MM-DD" pour une date donnée, dans le fuseau UTC. */
export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDay(d);
}

export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function formatDay(day: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}

export function weekdayShort(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
}

export function weekdayLong(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
}

export function signed(n: number): string {
  if (n > 0) return `▲ ${n}`;
  if (n < 0) return `▼ ${Math.abs(n)}`;
  return "0";
}

export function coolsInLabel(days: number | null): string {
  if (days === null) return "holding for now";
  if (days <= 0) return "cooling now";
  return `cools in ~${days} day${days === 1 ? "" : "s"}`;
}

/** Titre de page : « {title} is heating up · trends° », 60 caractères au plus. */
export function pageTitle(title: string, suffix = "is heating up"): string {
  const full = `${title} ${suffix} · trends°`;
  if (full.length <= 60) return full;
  const room = 60 - ` ${suffix} · trends°`.length - 1;
  return `${title.slice(0, Math.max(8, room))}… ${suffix} · trends°`;
}

export const CATEGORY_LABEL: Record<string, string> = {
  gaming: "Gaming",
  tech: "Tech",
  ai: "AI",
  entertainment: "Entertainment",
  sport: "Sport",
  culture: "Culture",
  business: "Business",
  design: "Design",
  lifestyle: "Lifestyle",
  food: "Food",
  music: "Music",
  other: "Other",
};

/** Le jour courant à Paris (le pipeline tourne à 06:30 Europe/Paris), YYYY-MM-DD. */
export function parisToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** L'instant où il est `minutes` (depuis minuit) à Paris le jour `day` (YYYY-MM-DD), heure d'été comprise. */
export function parisInstant(day: string, minutes: number): Date {
  const [y, m, d] = day.split("-").map(Number);
  // Point de départ : l'instant UTC qui porterait cette heure, puis correction du décalage de Paris ce jour-là
  const guess = new Date(Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60));
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(guess);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const offset = (((get("hour") * 60 + get("minute") - minutes) % 1440) + 1440) % 1440; // +60 l'hiver, +120 l'été
  return new Date(guess.getTime() - offset * 60_000);
}

/** Date et heure à Paris, pour l'administration : « 23 Nov, 06:30 ». */
export function parisDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
}

/** Durée entre deux instants : « 42 s », « 3 min », « 1 h 05 » ; null si non terminé. */
export function durationLabel(startIso: string, endIso: string | null): string | null {
  if (!endIso) return null;
  const s = Math.max(0, Math.round((Date.parse(endIso) - Date.parse(startIso)) / 1000));
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  return `${Math.floor(s / 3600)} h ${String(Math.round((s % 3600) / 60)).padStart(2, "0")}`;
}
