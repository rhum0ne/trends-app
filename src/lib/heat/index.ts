// Chaleur, prévision, pays et rangs — docs/heat.md. Fonctions pures, sans IA, sans I/O.
// Les pondérations sont un point de départ : tout changement de formule est noté dans docs/heat.md.

import type { Lifespan } from "@/lib/types";
import { clampHeat } from "./levels";

export * from "./levels";

// ─── Constantes (docs/heat.md) ─────────────────────────────────────────────
export const WEIGHTS = { spread: 0.35, strength: 0.25, sources: 0.2, momentum: 0.2 } as const;
export const TOP_N = 25;
export const FREE_SOURCE_COUNT = 4;
export const COUNTRY_WEIGHTS = { strength: 0.6, momentum: 0.4 } as const;
export const HALF_LIFE_DAYS: Record<Lifespan, number> = { "1-2 days": 1.5, "3-7 days": 3, "2+ weeks": 10 };
export const COOL_THRESHOLD = 60;
export const EXPIRE_THRESHOLD = 40;
export const BEST_WINDOW_THRESHOLD = 75;
export const HEATWAVE_THRESHOLD = 90;
export const MAX_LIFETIME_DAYS = 14;
export const FORECAST_DAYS = 5;
export const MAX_PUBLISHED = 10;

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);

// ─── Chaleur globale ───────────────────────────────────────────────────────

export interface HeatInput {
  /** Nombre de pays suivis ce jour-là (présents dans les données Google). */
  trackedCountries: number;
  /** Rang (1–25) dans chaque pays où le sujet est dans le top 25 aujourd'hui. */
  countryRanks: Record<string, number>;
  /** spread de la veille, ou null si le sujet est nouveau. */
  prevSpread: number | null;
  /** Nombre de sources gratuites qui citent le sujet aujourd'hui (0–4). */
  sourceCount: number;
}

export interface HeatComponents {
  spread: number;
  strength: number;
  sources: number;
  momentum: number;
}

export function strengthFromRank(rank: number): number {
  return clamp01(1 - (rank - 1) / TOP_N);
}

export function computeComponents(input: HeatInput): HeatComponents {
  const ranks = Object.values(input.countryRanks).filter((r) => Number.isFinite(r) && r >= 1 && r <= TOP_N);
  const spread = input.trackedCountries > 0 ? clamp01(ranks.length / input.trackedCountries) : 0;
  const avgRank = ranks.length ? ranks.reduce((a, b) => a + b, 0) / ranks.length : null;
  const strength = avgRank === null ? 0 : strengthFromRank(avgRank);
  const sources = clamp01(input.sourceCount / FREE_SOURCE_COUNT);
  const momentum = input.prevSpread === null ? 1 : clamp01((spread - input.prevSpread) * 4 + 0.5);
  return { spread, strength, sources, momentum };
}

export function heatFromComponents(c: HeatComponents): number {
  return clampHeat(
    100 * (WEIGHTS.spread * c.spread + WEIGHTS.strength * c.strength + WEIGHTS.sources * c.sources + WEIGHTS.momentum * c.momentum),
  );
}

export function computeHeat(input: HeatInput): { heat: number; components: HeatComponents } {
  const components = computeComponents(input);
  return { heat: heatFromComponents(components), components };
}

// ─── Chaleur par pays ──────────────────────────────────────────────────────

/**
 * momentum_pays (précisé ici, docs/heat.md) : absent la veille → 1 ;
 * sinon 0,5 + (rang_veille − rang_jour) / 10, borné 0–1.
 */
export function countryMomentum(rankToday: number, rankYesterday: number | null): number {
  if (rankYesterday === null) return 1;
  return clamp01(0.5 + (rankYesterday - rankToday) / 10);
}

export function computeCountryHeat(rankToday: number, rankYesterday: number | null): number {
  return clampHeat(100 * (COUNTRY_WEIGHTS.strength * strengthFromRank(rankToday) + COUNTRY_WEIGHTS.momentum * countryMomentum(rankToday, rankYesterday)));
}

// ─── Rangs ─────────────────────────────────────────────────────────────────

export interface Rankable {
  key: string;
  heat: number;
  sourceCount?: number;
}

/** Ordre par chaleur décroissante (puis nombre de sources, puis clé) ; rang 1 = le plus chaud. */
export function rankByHeat<T extends Rankable>(items: T[]): (T & { rank: number })[] {
  return [...items]
    .sort((a, b) => b.heat - a.heat || (b.sourceCount ?? 0) - (a.sourceCount ?? 0) || a.key.localeCompare(b.key))
    .map((it, i) => ({ ...it, rank: i + 1 }));
}

/** Classement de la semaine : chaleur moyenne des 7 derniers jours, jours absents comptés 0. */
export function weeklyAverage(heatByDay: Record<string, number>, days: string[]): number {
  if (days.length === 0) return 0;
  const sum = days.reduce((acc, d) => acc + (heatByDay[d] ?? 0), 0);
  return Math.round((sum / days.length) * 10) / 10;
}

export type RankMove = { kind: "new" } | { kind: "up"; by: number } | { kind: "down"; by: number } | { kind: "same" };

export function rankMove(rank: number, prevRank: number | null): RankMove {
  if (prevRank === null) return { kind: "new" };
  if (prevRank > rank) return { kind: "up", by: prevRank - rank };
  if (prevRank < rank) return { kind: "down", by: rank - prevRank };
  return { kind: "same" };
}

// ─── Heatwave ──────────────────────────────────────────────────────────────

/** Nombre de jours consécutifs ≥ 90 se terminant aujourd'hui (dernier élément). Heatwave si ≥ 2. */
export function heatwaveDays(heatsOldestFirst: number[]): number {
  let n = 0;
  for (let i = heatsOldestFirst.length - 1; i >= 0; i--) {
    if (heatsOldestFirst[i] >= HEATWAVE_THRESHOLD) n++;
    else break;
  }
  return n >= 2 ? n : 0;
}

// ─── Prévision ─────────────────────────────────────────────────────────────

export interface OutlookInput {
  h0: number;
  /** Chaleur de la veille (null si nouveau). */
  hPrev: number | null;
  /** Chaleur de l'avant-veille (null si absente). */
  hPrev2: number | null;
  lifespan: Lifespan;
}

export interface Outlook {
  /** 5 valeurs : aujourd'hui (h0) puis les 4 jours suivants. */
  forecast: number[];
  peakTomorrow: boolean;
  /** Premier jour où la prévision passe sous 60 (0 = déjà sous 60), null au-delà de 14 jours. */
  coolsInDays: number | null;
  /** Indices (0–4) des jours ≥ 75, 2 au plus ; vide = « today ». */
  bestWindow: number[];
  curveTitle: string;
  /** Jours avant expiration (prévision < 40), entre 1 et 14. */
  expiresInDays: number;
}

/** h(n) pour n ≥ 0 jours après aujourd'hui (docs/heat.md § Prévision). */
export function projection(input: OutlookInput, n: number): number {
  const hl = HALF_LIFE_DAYS[input.lifespan];
  const h0 = clampHeat(input.h0);
  if (n <= 0) return h0;
  if (isRisingTwoDays(input)) {
    const peak = Math.min(100, h0 + (h0 - (input.hPrev as number)) / 2);
    return clampHeat(peak * Math.pow(0.5, (n - 1) / hl));
  }
  return clampHeat(h0 * Math.pow(0.5, n / hl));
}

function isRisingTwoDays({ h0, hPrev, hPrev2 }: OutlookInput): boolean {
  return hPrev !== null && hPrev2 !== null && h0 > hPrev && hPrev > hPrev2;
}

export function curveTitle(input: OutlookInput): string {
  if (isRisingTwoDays(input)) return "peak tomorrow, then it cools";
  if (input.hPrev === null) return "just heating up";
  if (input.h0 < input.hPrev - 2) return "past its peak";
  if (input.h0 > input.hPrev + 2) return "heating up";
  return "holding steady";
}

export function computeOutlook(input: OutlookInput): Outlook {
  const forecast = Array.from({ length: FORECAST_DAYS }, (_, n) => projection(input, n));
  let coolsInDays: number | null = null;
  for (let n = 0; n <= MAX_LIFETIME_DAYS; n++) {
    if (projection(input, n) < COOL_THRESHOLD) {
      coolsInDays = n;
      break;
    }
  }
  const bestWindow = forecast
    .map((h, i) => ({ h, i }))
    .filter((d) => d.h >= BEST_WINDOW_THRESHOLD)
    .sort((a, b) => b.h - a.h || a.i - b.i)
    .slice(0, 2)
    .map((d) => d.i)
    .sort((a, b) => a - b);
  let expiresInDays = MAX_LIFETIME_DAYS;
  for (let n = 1; n <= MAX_LIFETIME_DAYS; n++) {
    if (projection(input, n) < EXPIRE_THRESHOLD) {
      expiresInDays = n;
      break;
    }
  }
  return { forecast, peakTomorrow: isRisingTwoDays(input), coolsInDays, bestWindow, curveTitle: curveTitle(input), expiresInDays };
}

/** expires_at : début (UTC) du jour où la prévision passe sous 40, 14 jours au plus. */
export function expiresAt(day: string, expiresInDays: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Math.max(1, Math.min(MAX_LIFETIME_DAYS, expiresInDays)));
  return d.toISOString();
}

// ─── Facteurs « signals » ──────────────────────────────────────────────────

/** Valeur du jour / moyenne des 7 jours précédents, arrondie à une décimale ; null sans historique. */
export function growthFactor(today: number, previous: number[]): number | null {
  const prev = previous.filter((v) => Number.isFinite(v));
  if (prev.length === 0 || !Number.isFinite(today)) return null;
  const avg = prev.reduce((a, b) => a + b, 0) / prev.length;
  if (avg <= 0) return null;
  return Math.round((today / avg) * 10) / 10;
}
