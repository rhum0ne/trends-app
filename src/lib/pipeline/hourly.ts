// Rafraîchissement léger (CLAUDE.md § 5) : seule la composante « sources » change en cours de journée
// (docs/heat.md). Pas d'IA, pas de BigQuery : Wikipédia, Bluesky et Hacker News seulement.
// La prévision, l'expiration et le pic suivent la nouvelle chaleur (refreshOutlook).

import { db, fetchAll } from "@/lib/supabase/server";
import type { TrendDayRow } from "@/lib/supabase/database.types";
import { collectSignals } from "@/lib/sources";
import { heatFromComponents, rankByHeat, type HeatComponents, FREE_SOURCE_COUNT } from "@/lib/heat";
import { matchesTopic } from "@/lib/normalize";
import { addDays, parisToday } from "@/lib/format";
import type { Lifespan } from "@/lib/types";
import { backfillTones } from "@/lib/images/store";
import { refreshOutlook } from "./score";

export interface HourlyReport {
  day: string;
  updated: number;
  sources: Record<string, boolean>;
}

export async function runHourly(): Promise<HourlyReport> {
  const day = parisToday();
  const client = db();
  // Courbes de tonalité manquantes des photos actives (docs/images.md § 4) ; ne lève jamais d'erreur
  await backfillTones();
  const { data: rows, error } = await client
    .from("trend_days")
    .select("*, trends!inner(topic_key, signal_key, brand_safe, hidden, lifespan, peak_heat)")
    .eq("day", day);
  if (error) throw new Error(error.message);
  const list = (rows ?? []) as (TrendDayRow & {
    trends: { topic_key: string; signal_key: string | null; brand_safe: boolean; hidden: boolean; lifespan: string; peak_heat: number | null };
  })[];
  if (list.length === 0) return { day, updated: 0, sources: {} };

  // Chaleur des deux jours précédents : la prévision en dépend (pic probable, docs/heat.md)
  const { data: past, error: pastErr } = await client
    .from("trend_days")
    .select("trend_id, day, heat")
    .in("trend_id", list.map((r) => r.trend_id))
    .in("day", [addDays(day, -1), addDays(day, -2)]);
  if (pastErr) throw new Error(pastErr.message);
  const pastHeat = (id: string, d: string) => (past ?? []).find((p) => p.trend_id === id && p.day === d)?.heat ?? null;

  const results = await collectSignals({ day, only: ["wikipedia", "bluesky", "hackernews"] });
  const items = results.flatMap((r) => (r.ok ? r.items : []));
  const okSources = new Set(results.filter((r) => r.ok).map((r) => r.source));

  // Google ne change pas dans la journée : on garde sa contribution du matin
  const googleRows = await fetchAll(() => client.from("signals").select("topic_key").eq("day", day).eq("source", "google"));
  const googleKeys = [...new Set(googleRows.map((r) => r.topic_key))];

  const refreshed = list.map((r) => {
    const keys = [r.trends.signal_key, r.trends.topic_key].filter(Boolean) as string[];
    const match = (k: string) => keys.some((t) => k === t || matchesTopic(t, k));
    const cited = new Set<string>();
    if (googleKeys.some(match)) cited.add("google");
    for (const i of items) if (match(i.key)) cited.add(i.source);
    // Une source en panne garde sa contribution du matin plutôt que de faire baisser la chaleur
    const prevCount = r.source_count;
    const count = okSources.size === 3 ? cited.size : Math.max(cited.size, prevCount);
    const comp = { ...(r.components as unknown as HeatComponents), sources: Math.min(1, count / FREE_SOURCE_COUNT) };
    const heat = heatFromComponents(comp);
    return { row: r, heat, comp, count };
  });

  const visible = refreshed.filter((x) => !x.row.trends.hidden);
  const ranked = rankByHeat(visible.map((x) => ({ key: x.row.trend_id, heat: x.heat, sourceCount: x.count })));
  const manualTop = visible.find((x) => x.row.manual_top);
  const top = manualTop ? manualTop.row.trend_id : ranked.find((r) => visible.find((v) => v.row.trend_id === r.key)?.row.trends.brand_safe)?.key;

  // Retirer l'ancienne tendance du jour avant d'en marquer une autre (index unique)
  await client.from("trend_days").update({ is_top: false }).eq("day", day).eq("is_top", true);
  let updated = 0;
  for (const r of ranked) {
    const x = visible.find((v) => v.row.trend_id === r.key)!;
    const delta = x.heat - x.row.heat;
    const outlook = refreshOutlook({
      day,
      heat: x.heat,
      hPrev: pastHeat(r.key, addDays(day, -1)),
      hPrev2: pastHeat(r.key, addDays(day, -2)),
      lifespan: x.row.trends.lifespan as Lifespan,
      peakHeat: x.row.trends.peak_heat,
    });
    const { error: e } = await client
      .from("trend_days")
      .update({
        heat: x.heat,
        heat_change: x.row.heat_change + delta,
        rank: r.rank,
        is_top: r.key === top,
        forecast: outlook.forecast,
        components: x.comp as unknown as TrendDayRow["components"],
        source_count: x.count,
        updated_at: new Date().toISOString(),
      })
      .eq("trend_id", r.key)
      .eq("day", day);
    if (e) continue;
    updated++;
    // L'expiration et le pic suivent la chaleur ; updated_at de la tendance reste celui de l'analyse (sitemap)
    await client
      .from("trends")
      .update({ expires_at: outlook.expires_at, ...(outlook.peak ?? {}) })
      .eq("id", r.key);
  }
  return { day, updated, sources: Object.fromEntries(results.map((r) => [r.source, r.ok])) };
}
