// Lecture des tendances, partagée par les pages et par /api/v1 (docs/pages.md : « mêmes fonctions »).
// Résultats mis en cache 10 minutes (CLAUDE.md § 7) et invalidés par le tag "trends" (pipeline, admin).

import { cacheLife, cacheTag } from "next/cache";
import { db, fetchAll, hasDb, publicImageUrl } from "@/lib/supabase/server";
import type { TrendCountryRow, TrendDayRow, TrendImageRow, TrendRow } from "@/lib/supabase/database.types";
import type { CountryOverview, TrendImage, TrendView } from "@/lib/types";
import { addDays, countryName, parisToday } from "@/lib/format";
import { buildTrendView, finalizeDay, imageFromRow } from "./view";
import { heatLevel, weeklyAverage } from "@/lib/heat";
import type { RunSummary } from "@/lib/pipeline/schedule";

export const TRENDS_TAG = "trends";

function cache10() {
  cacheLife({ stale: 300, revalidate: 600, expire: 3600 });
  cacheTag(TRENDS_TAG);
}

const HISTORY_DAYS = 14;

/** Dernier jour publié (≤ aujourd'hui à Paris), ou null. */
export async function getLatestDay(): Promise<string | null> {
  "use cache";
  cache10();
  if (!hasDb()) return null;
  const { data, error } = await db()
    .from("trend_days")
    .select("day, trends!inner(hidden)")
    .eq("trends.hidden", false)
    .lte("day", parisToday())
    .order("day", { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data?.[0] as { day: string } | undefined)?.day ?? null;
}

interface DayBundle {
  dayRows: TrendDayRow[];
  trends: Map<string, TrendRow>;
  history: Map<string, Pick<TrendDayRow, "day" | "heat" | "rank" | "trend_id">[]>;
  countries: Map<string, TrendCountryRow[]>;
  images: Map<string, TrendImageRow>;
}

async function loadBundle(dayRows: TrendDayRow[], historyEnd: string): Promise<DayBundle> {
  const ids = [...new Set(dayRows.map((r) => r.trend_id))];
  const empty: DayBundle = { dayRows: [], trends: new Map(), history: new Map(), countries: new Map(), images: new Map() };
  if (ids.length === 0) return empty;
  const client = db();
  const days = [...new Set(dayRows.map((r) => r.day))];
  const [trendsRes, history, countryRows, imagesRes] = await Promise.all([
    client.from("trends").select("*").in("id", ids).eq("hidden", false),
    fetchAll(() =>
      client
        .from("trend_days")
        .select("trend_id, day, heat, rank")
        .in("trend_id", ids)
        .gte("day", addDays([...days].sort()[0], -HISTORY_DAYS))
        .lte("day", historyEnd),
    ),
    fetchAll(() => client.from("trend_countries").select("*").in("trend_id", ids).in("day", days)),
    client.from("trend_images").select("*").in("trend_id", ids).eq("active", true),
  ]);
  for (const r of [trendsRes, imagesRes]) if (r.error) throw r.error;
  const trends = new Map((trendsRes.data ?? []).map((t) => [t.id, t as TrendRow]));
  const historyBy = new Map<string, Pick<TrendDayRow, "day" | "heat" | "rank" | "trend_id">[]>();
  for (const h of history) {
    const list = historyBy.get(h.trend_id) ?? [];
    list.push(h);
    historyBy.set(h.trend_id, list);
  }
  const countries = new Map<string, TrendCountryRow[]>();
  for (const c of countryRows) {
    const k = `${c.trend_id}|${c.day}`;
    const list = countries.get(k) ?? [];
    list.push(c as TrendCountryRow);
    countries.set(k, list);
  }
  const images = new Map((imagesRes.data ?? []).map((i) => [i.trend_id, i as TrendImageRow]));
  return { dayRows: dayRows.filter((r) => trends.has(r.trend_id)), trends, history: historyBy, countries, images };
}

function toViews(bundle: DayBundle): TrendView[] {
  return bundle.dayRows.map((dayRow) =>
    buildTrendView({
      trend: bundle.trends.get(dayRow.trend_id)!,
      dayRow,
      history: bundle.history.get(dayRow.trend_id) ?? [],
      countries: bundle.countries.get(`${dayRow.trend_id}|${dayRow.day}`) ?? [],
      image: bundle.images.get(dayRow.trend_id) ?? null,
      imageUrl: publicImageUrl,
    }),
  );
}

async function viewsForDay(day: string): Promise<TrendView[]> {
  const { data, error } = await db().from("trend_days").select("*").eq("day", day);
  if (error) throw error;
  const bundle = await loadBundle((data ?? []) as TrendDayRow[], day);
  return finalizeDay(toViews(bundle));
}

export interface DailyResult {
  day: string | null;
  /** true si la journée affichée n'est pas celle d'aujourd'hui (pipeline en retard ou en échec). */
  stale: boolean;
  trends: TrendView[];
}

/**
 * Les tendances d'un jour, triées par chaleur. Sans `day` : aujourd'hui, sans les tendances expirées ;
 * si aucune n'est encore valide, la dernière journée publiée (jamais de page vide).
 */
export async function getDailyTrends(opts: { day?: string; country?: string; category?: string } = {}): Promise<DailyResult> {
  "use cache";
  cache10();
  if (!hasDb()) return { day: null, stale: false, trends: [] };
  const day = opts.day ?? (await getLatestDay());
  if (!day) return { day: null, stale: false, trends: [] };
  let views = await viewsForDay(day);
  if (!opts.day) {
    const now = Date.now();
    const valid = views.filter((v) => Date.parse(v.expires_at) > now);
    if (valid.length > 0) views = finalizeDay(valid);
  }
  if (opts.category) views = views.filter((v) => v.category === opts.category);
  if (opts.country) {
    const cc = opts.country.toUpperCase();
    views = views
      .filter((v) => v.countries.some((c) => c.code === cc))
      .sort((a, b) => (b.countries.find((c) => c.code === cc)?.heat ?? 0) - (a.countries.find((c) => c.code === cc)?.heat ?? 0));
  }
  return { day, stale: day !== parisToday(), trends: views };
}

export async function getTopTrend(country?: string): Promise<{ day: string | null; stale: boolean; trend: TrendView | null }> {
  const res = await getDailyTrends(country ? { country } : {});
  if (!country) return { day: res.day, stale: res.stale, trend: res.trends.find((t) => t.is_top) ?? res.trends[0] ?? null };
  // Dans un pays : la plus chaude du pays parmi celles sûres pour une marque, sinon la plus chaude
  return { day: res.day, stale: res.stale, trend: res.trends.find((t) => t.brand_safe) ?? res.trends[0] ?? null };
}

/** Une tendance par son slug, à sa dernière mesure (ou à `day`), avec l'historique. null si masquée ou inconnue. */
export async function getTrend(slug: string, opts: { day?: string; historyDays?: number } = {}): Promise<(TrendView & { full_history: { day: string; heat: number; rank: number }[] }) | null> {
  "use cache";
  cache10();
  if (!hasDb()) return null;
  const client = db();
  const { data: trend, error } = await client.from("trends").select("*").eq("slug", slug).eq("hidden", false).maybeSingle();
  if (error) throw error;
  if (!trend) return null;
  let q = client.from("trend_days").select("*").eq("trend_id", trend.id).order("day", { ascending: false }).limit(1);
  if (opts.day) q = q.lte("day", opts.day);
  const { data: rows, error: e2 } = await q;
  if (e2) throw e2;
  const dayRow = rows?.[0] as TrendDayRow | undefined;
  if (!dayRow) return null;
  const bundle = await loadBundle([dayRow], dayRow.day);
  const [view] = toViews(bundle);
  if (!view) return null;
  // Rang affiché et tendance du jour recalculés parmi les visibles du même jour
  const sameDay = await viewsForDay(dayRow.day);
  const me = sameDay.find((v) => v.id === view.id);
  const historyDays = opts.historyDays ?? 90;
  const full = (bundle.history.get(trend.id) ?? [])
    .filter((h) => h.day >= addDays(dayRow.day, -historyDays))
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((h) => ({ day: h.day, heat: h.heat, rank: h.rank }));
  return { ...view, rank: me?.rank ?? view.rank, is_top: me?.is_top ?? false, full_history: full };
}

/** Pays suivis ce jour-là, avec leur tendance publiée la plus chaude (null = aucune). */
export async function getCountries(dayArg?: string): Promise<{ day: string | null; countries: CountryOverview[] }> {
  "use cache";
  cache10();
  if (!hasDb()) return { day: null, countries: [] };
  const day = dayArg ?? (await getLatestDay());
  if (!day) return { day: null, countries: [] };
  const [{ trends }, tracked] = await Promise.all([
    getDailyTrends(dayArg ? { day } : {}),
    fetchAll(() => db().from("signals").select("country").eq("day", day).eq("source", "google").not("country", "is", null)),
  ]);
  const codes = new Set<string>(tracked.map((r) => (r.country as string).toUpperCase()));
  for (const t of trends) for (const c of t.countries) codes.add(c.code);
  const out: CountryOverview[] = [...codes].map((code) => {
    let best: { slug: string; title: string; heat: number } | null = null;
    for (const t of trends) {
      const c = t.countries.find((x) => x.code === code);
      if (c && (!best || c.heat > best.heat)) best = { slug: t.slug, title: t.title, heat: c.heat };
    }
    return { code, name: countryName(code), heat: best?.heat ?? 0, heat_level: best ? heatLevel(best.heat) : null, trend: best };
  });
  out.sort((a, b) => (b.trend ? 1 : 0) - (a.trend ? 1 : 0) || b.heat - a.heat || a.name.localeCompare(b.name));
  return { day, countries: out };
}

export interface WeeklyEntry {
  view: TrendView;
  average: number;
  rank: number;
  prevRank: number | null;
}

/** Classement de la semaine : chaleur moyenne des 7 derniers jours (absents = 0), monde ou pays. */
export async function getWeekly(opts: { country?: string; limit?: number } = {}): Promise<{ day: string | null; entries: WeeklyEntry[] }> {
  "use cache";
  cache10();
  if (!hasDb()) return { day: null, entries: [] };
  const day = await getLatestDay();
  if (!day) return { day: null, entries: [] };
  const days = Array.from({ length: 7 }, (_, i) => addDays(day, i - 6));
  const prevDays = Array.from({ length: 7 }, (_, i) => addDays(day, i - 7));
  const client = db();
  const cc = opts.country?.toUpperCase();
  const heatsQuery = cc
    ? client.from("trend_countries").select("trend_id, day, heat").eq("country_code", cc).gte("day", prevDays[0]).lte("day", day)
    : client.from("trend_days").select("trend_id, day, heat").gte("day", prevDays[0]).lte("day", day);
  const { data, error } = await heatsQuery;
  if (error) throw error;
  const byTrend = new Map<string, Record<string, number>>();
  for (const r of data ?? []) {
    const m = byTrend.get(r.trend_id) ?? {};
    m[r.day] = r.heat;
    byTrend.set(r.trend_id, m);
  }
  const scored = [...byTrend.entries()]
    .map(([id, m]) => ({ id, avg: weeklyAverage(m, days), prev: weeklyAverage(m, prevDays), last: days.filter((d) => d in m).at(-1) }))
    .filter((s) => s.avg > 0 && s.last);
  const prevOrder = [...scored].filter((s) => s.prev > 0).sort((a, b) => b.prev - a.prev).map((s) => s.id);
  scored.sort((a, b) => b.avg - a.avg);
  const top = scored.slice(0, opts.limit ?? 10);
  // Vue de chaque tendance à son dernier jour présent dans la semaine
  const { data: rows, error: e2 } = await client
    .from("trend_days")
    .select("*")
    .in("trend_id", top.map((t) => t.id))
    .gte("day", days[0])
    .lte("day", day);
  if (e2) throw e2;
  const lastRow = new Map<string, TrendDayRow>();
  for (const r of (rows ?? []) as TrendDayRow[]) {
    const cur = lastRow.get(r.trend_id);
    if (!cur || r.day > cur.day) lastRow.set(r.trend_id, r);
  }
  const bundle = await loadBundle([...lastRow.values()], day);
  const views = new Map(toViews(bundle).map((v) => [v.id, v]));
  const entries: WeeklyEntry[] = [];
  for (const t of top) {
    const v = views.get(t.id);
    if (!v) continue; // masquée
    const idx = prevOrder.indexOf(t.id);
    entries.push({ view: v, average: t.avg, rank: entries.length + 1, prevRank: idx >= 0 ? idx + 1 : null });
  }
  return { day, entries };
}

/** Les tendances du jour des N derniers jours (une par jour) pour /archive. */
export async function getArchive(daysBack = 30): Promise<{ day: string; trend: TrendView }[]> {
  "use cache";
  cache10();
  if (!hasDb()) return [];
  const end = parisToday();
  const start = addDays(end, -daysBack + 1);
  const { data, error } = await db().from("trend_days").select("*").gte("day", start).lte("day", end).order("day", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as TrendDayRow[];
  const bundle = await loadBundle(rows, end);
  const byDay = new Map<string, TrendView[]>();
  for (const v of toViews(bundle)) {
    const list = byDay.get(v.day) ?? [];
    list.push(v);
    byDay.set(v.day, list);
  }
  return [...byDay.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([day, list]) => ({ day, trend: finalizeDay(list).find((v) => v.is_top) ?? finalizeDay(list)[0] }))
    .filter((e) => Boolean(e.trend));
}

/** 3 tendances liées : même catégorie, sinon mêmes pays. */
export async function getRelated(view: TrendView, limit = 3): Promise<TrendView[]> {
  const { trends } = await getDailyTrends();
  const others = trends.filter((t) => t.id !== view.id);
  const codes = new Set(view.countries.slice(0, 5).map((c) => c.code));
  const score = (t: TrendView) => (t.category === view.category ? 10 : 0) + t.countries.filter((c) => codes.has(c.code)).length;
  return others.sort((a, b) => score(b) - score(a) || b.heat - a.heat).slice(0, limit);
}

/** Une photo réellement stockée (pour /styleguide), ou null. */
export async function getSampleImage(): Promise<TrendImage | null> {
  "use cache";
  cache10();
  if (!hasDb()) return null;
  const { data, error } = await db().from("trend_images").select("*").eq("active", true).order("created_at", { ascending: false }).limit(1);
  if (error) return null;
  return imageFromRow((data?.[0] as TrendImageRow | undefined) ?? null, publicImageUrl);
}

/** Date de la dernière analyse réussie (sitemap : jamais la date du build). */
export async function getLastAnalysisAt(): Promise<string | null> {
  "use cache";
  cache10();
  if (!hasDb()) return null;
  const { data, error } = await db()
    .from("analysis_runs")
    .select("finished_at")
    .eq("status", "ok")
    .not("finished_at", "is", null)
    .order("finished_at", { ascending: false })
    .limit(1);
  if (error) return null;
  return data?.[0]?.finished_at ?? null;
}

/** Nombre de jours de données d'un pays (noindex de /c/{code} sous 7 jours). */
export async function countryDataDays(code: string): Promise<number> {
  "use cache";
  cache10();
  if (!hasDb()) return 0;
  try {
    const rows = await fetchAll(() => db().from("trend_countries").select("day").eq("country_code", code.toUpperCase()));
    return new Set(rows.map((r) => r.day)).size;
  } catch {
    return 0;
  }
}

/** Nombre de jours où la tendance a été présente (noindex de /t/{slug} sous 2 jours). */
export async function trendDaysPresent(trendId: string): Promise<number> {
  "use cache";
  cache10();
  if (!hasDb()) return 0;
  const { count, error } = await db().from("trend_days").select("day", { count: "exact", head: true }).eq("trend_id", trendId);
  if (error) return 0;
  return count ?? 0;
}

/** Analyses du jour (Paris) pour l'écran sans prévision : état court, mis en cache 1 minute. */
export async function getTodayRuns(): Promise<RunSummary[]> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 300 });
  cacheTag(TRENDS_TAG);
  if (!hasDb()) return [];
  const { data, error } = await db().from("analysis_runs").select("status, started_at, finished_at").eq("day", parisToday());
  if (error) return [];
  return (data ?? []) as RunSummary[];
}
