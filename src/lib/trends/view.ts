// Construction des vues à partir des lignes de la base. Pur et testé : pas d'I/O ici.

import type { Angle, Audience, Category, CountryHeat, Lifespan, PublicTrend, SignalFactors, SourceLink, TrendImage, TrendView } from "@/lib/types";
import type { TrendCountryRow, TrendDayRow, TrendImageRow, TrendRow } from "@/lib/supabase/database.types";
import { computeOutlook, heatLevel, heatwaveDays } from "@/lib/heat";
import { addDays } from "@/lib/format";
import { entitlements, type PlanId } from "@/lib/plans";
import { POWERED_BY } from "@/lib/links";

export interface ViewInput {
  trend: TrendRow;
  dayRow: TrendDayRow;
  /** Lignes trend_days de la même tendance, tous jours (au moins les 14 derniers). */
  history: Pick<TrendDayRow, "day" | "heat" | "rank">[];
  countries: TrendCountryRow[];
  image: TrendImageRow | null;
  imageUrl: (path: string) => string;
  /** Rang affiché (après retrait des tendances masquées) ; par défaut le rang stocké. */
  displayRank?: number;
  prevDisplayRank?: number | null;
  isTop?: boolean;
  now?: Date;
}

export function imageFromRow(row: TrendImageRow | null, imageUrl: (p: string) => string): TrendImage | null {
  if (!row) return null;
  return {
    url: imageUrl(row.storage_path),
    width: row.width,
    height: row.height,
    alt: row.alt,
    avg_color: row.avg_color,
    credit: { name: row.photographer, url: row.photographer_url },
    source_url: row.pexels_url,
  };
}

function arr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export function buildTrendView(input: ViewInput): TrendView {
  const { trend, dayRow, history, countries, image, imageUrl, now = new Date() } = input;
  const day = dayRow.day;
  const byDay = new Map(history.map((h) => [h.day, h]));
  const hPrev = byDay.get(addDays(day, -1))?.heat ?? null;
  const hPrev2 = byDay.get(addDays(day, -2))?.heat ?? null;
  const lifespan = trend.lifespan as Lifespan;
  const outlook = computeOutlook({ h0: dayRow.heat, hPrev, hPrev2, lifespan });
  const forecast = dayRow.forecast?.length === 5 ? dayRow.forecast : outlook.forecast;
  const last14 = Array.from({ length: 14 }, (_, i) => byDay.get(addDays(day, i - 13))?.heat ?? 0);
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(day, i - 6);
    return { day: d, heat: byDay.get(d)?.heat ?? 0 };
  });
  const countryList: CountryHeat[] = [...countries]
    .sort((a, b) => b.heat - a.heat || a.country_code.localeCompare(b.country_code))
    .map((c) => ({ code: c.country_code, heat: c.heat, rank: c.rank }));
  const cooled = Date.parse(trend.expires_at) <= now.getTime();
  const factors = (dayRow.factors ?? {}) as SignalFactors;
  const prevRow = byDay.get(addDays(day, -1));
  return {
    id: trend.id,
    topic: trend.topic,
    slug: trend.slug,
    title: trend.title,
    category: trend.category as Category,
    why: trend.why,
    lifespan,
    brand_safe: trend.brand_safe,
    risk: trend.risk,
    audiences: arr<Audience>(trend.audiences),
    angles: arr<Angle>(trend.angles),
    sources: arr<SourceLink>(trend.sources),
    heat: dayRow.heat,
    heat_level: heatLevel(dayRow.heat),
    heat_change: dayRow.heat_change,
    rank: input.displayRank ?? dayRow.rank,
    forecast,
    countries: countryList,
    first_seen: trend.first_seen,
    last_seen: trend.last_seen,
    expires_at: trend.expires_at,
    is_top: input.isTop ?? dayRow.is_top,
    image: imageFromRow(image, imageUrl),
    day,
    is_new: dayRow.is_new,
    prev_rank: input.prevDisplayRank !== undefined ? input.prevDisplayRank : (prevRow?.rank ?? null),
    heatwave_days: heatwaveDays(last14),
    cools_in_days: outlook.coolsInDays,
    best_window: outlook.bestWindow,
    curve_title: outlook.curveTitle,
    history: last7,
    factors,
    top3_countries: dayRow.top3_countries,
    cooled,
    peak_heat: trend.peak_heat,
    peak_day: trend.peak_day,
    updated_at: dayRow.updated_at,
  };
}

/**
 * Réordonne les tendances visibles d'un jour : rangs 1…n contigus et une seule tendance du jour
 * (celle marquée, sinon la plus chaude parmi les sûres pour une marque).
 */
export function finalizeDay(views: TrendView[]): TrendView[] {
  const sorted = [...views].sort((a, b) => a.rank - b.rank || b.heat - a.heat);
  let top = sorted.find((v) => v.is_top) ?? sorted.find((v) => v.brand_safe) ?? null;
  if (top && !top.brand_safe) top = sorted.find((v) => v.brand_safe) ?? null;
  return sorted.map((v, i) => ({ ...v, rank: i + 1, is_top: top ? v.id === top.id : false }));
}

/** Projection vers le contrat public v1 (§ 7), selon les droits de l'offre. */
export function toPublicTrend(view: TrendView, plan: PlanId): PublicTrend & { powered_by?: typeof POWERED_BY } {
  const ent = entitlements(plan);
  const angles = ent.maxAngles === null ? view.angles : view.angles.slice(0, ent.maxAngles);
  const out: PublicTrend & { powered_by?: typeof POWERED_BY } = {
    topic: view.topic,
    slug: view.slug,
    title: view.title,
    category: view.category,
    why: view.why,
    lifespan: view.lifespan,
    brand_safe: view.brand_safe,
    risk: view.risk,
    audiences: view.audiences,
    angles,
    sources: view.sources,
    heat: view.heat,
    heat_level: view.heat_level,
    heat_change: view.heat_change,
    rank: view.rank,
    forecast: view.forecast,
    countries: view.countries,
    first_seen: view.first_seen,
    last_seen: view.last_seen,
    expires_at: view.expires_at,
    is_top: view.is_top,
    image: view.image,
    day: view.day,
  };
  if (ent.poweredBy) out.powered_by = POWERED_BY;
  return out;
}
