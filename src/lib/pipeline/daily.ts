// Pipeline quotidien (CLAUDE.md § 5) : collecte → analyse IA → contrôles → chaleur → sélection → photos.
// Appelé par /api/cron/daily, « Run now » (/admin) et `pnpm run:daily`. N'importe rien de Next :
// l'appelant invalide le cache (revalidateTag) après coup.

import { db, fetchAll } from "@/lib/supabase/server";
import type { Json, TrendDayRow, TrendRow } from "@/lib/supabase/database.types";
import { addDays, parisToday } from "@/lib/format";
import { collectSignals, buildCandidates, okSources, type SourceItem, type SourceResult } from "@/lib/sources";
import { analyzeDay, type AnalysisResult } from "@/lib/ai/analyze";
import { BudgetExceededError } from "@/lib/ai/generate";
import { expiresAt, growthFactor } from "@/lib/heat";
import { matchesTopic } from "@/lib/normalize";
import { attachPhoto } from "@/lib/images/store";
import type { Category } from "@/lib/types";
import { closeIncident, openIncident } from "./alerts";
import { scoreDay, type PrevState, type ScoredTrend } from "./score";
import { alignWithKnown, heatJumped, splitCandidates, stillAllowed, trendFromRow, KNOWN_WITHIN_DAYS } from "./incremental";
import type { CheckedTrend } from "@/lib/ai/checks";
import { pingIndexNow } from "./indexnow";

export interface DailyReport {
  day: string;
  status: "ok" | "fallback" | "failed" | "skipped";
  runId: string | null;
  sources: Record<string, { ok: boolean; items: number; ms: number; error?: string }>;
  candidates: number;
  published: { slug: string; title: string; heat: number; rank: number; is_top: boolean; photo: string }[];
  rejected: { topic: string; reason: string }[];
  costUsd: number;
  searches: number;
  /** Analyse incrémentale : sujets envoyés à l'IA (nouveaux, à rafraîchir) et analyses gardées. */
  incremental?: { fresh: number; refreshed: number; kept: number; hidden: number; aiSkipped: boolean };
  error?: string;
}

type Log = (msg: string) => void;

function sourcesSummary(results: SourceResult[]): DailyReport["sources"] {
  return Object.fromEntries(results.map((r) => [r.source, { ok: r.ok, items: r.items.length, ms: r.ms, ...(r.error ? { error: r.error } : {}) }]));
}

async function storeSignals(day: string, results: SourceResult[]): Promise<void> {
  const client = db();
  for (const r of results) {
    if (!r.ok) continue;
    await client.from("signals").delete().eq("day", day).eq("source", r.source);
    const rows = r.items.map((i) => ({
      day,
      source: i.source,
      topic_key: i.key,
      raw_topic: i.raw.slice(0, 500),
      country: i.country,
      rank: i.rank,
      value: i.value,
      meta: (i.meta ?? {}) as Json,
    }));
    for (let k = 0; k < rows.length; k += 1000) {
      const { error } = await client.from("signals").insert(rows.slice(k, k + 1000));
      if (error) throw new Error(`signals insert: ${error.message}`);
    }
  }
}

async function loadGoogleItems(day: string): Promise<SourceItem[]> {
  const rows = await fetchAll(() => db().from("signals").select("topic_key, raw_topic, country, rank").eq("day", day).eq("source", "google"));
  return rows.map((r) => ({ source: "google" as const, key: r.topic_key, raw: r.raw_topic, country: r.country, rank: r.rank, value: null }));
}

async function loadPrevState(day: string, topicKeys: string[]): Promise<{ prev: Map<string, PrevState>; existing: Map<string, TrendRow>; history: Map<string, TrendDayRow[]> }> {
  const client = db();
  const existing = new Map<string, TrendRow>();
  if (topicKeys.length) {
    const { data, error } = await client.from("trends").select("*").in("topic_key", topicKeys);
    if (error) throw new Error(error.message);
    for (const t of data ?? []) existing.set(t.topic_key, t as TrendRow);
  }
  const ids = [...existing.values()].map((t) => t.id);
  const history = new Map<string, TrendDayRow[]>();
  if (ids.length) {
    const { data, error } = await client.from("trend_days").select("*").in("trend_id", ids).gte("day", addDays(day, -8)).lt("day", day);
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as TrendDayRow[]) history.set(r.trend_id, [...(history.get(r.trend_id) ?? []), r]);
  }
  const prev = new Map<string, PrevState>();
  for (const [key, t] of existing) {
    const rows = history.get(t.id) ?? [];
    const y = rows.find((r) => r.day === addDays(day, -1));
    const y2 = rows.find((r) => r.day === addDays(day, -2));
    const comp = (y?.components ?? {}) as { spread?: number };
    prev.set(key, { prevSpread: y && typeof comp.spread === "number" ? comp.spread : null, hPrev: y?.heat ?? null, hPrev2: y2?.heat ?? null });
  }
  return { prev, existing, history };
}

/** Facteurs « signals » : valeur du jour / moyenne des 7 jours précédents (jamais les valeurs brutes). */
async function computeFactors(day: string, scored: ScoredTrend[], history: Map<string, TrendDayRow[]>, existing: Map<string, TrendRow>, results: SourceResult[]) {
  const since = addDays(day, -7);
  const rows = await fetchAll(() =>
    db().from("signals").select("day, source, topic_key, value").in("source", ["wikipedia", "hackernews"]).gte("day", since).lt("day", day),
  );
  const todayItems = results.flatMap((r) => (r.ok ? r.items : []));
  const out = new Map<string, Record<string, number | null>>();
  for (const s of scored) {
    const keys = [s.trend.signal_key, s.trend.topic_key];
    const match = (k: string) => keys.some((t) => k === t || matchesTopic(t, k));
    const sumBy = (src: string, list: { source: string; topic_key?: string; key?: string; value: number | null; day?: string }[], d?: string) =>
      list.filter((r) => r.source === src && match((r.topic_key ?? r.key) as string) && (!d || r.day === d)).reduce((a, r) => a + Number(r.value ?? 0), 0);
    const prevDays = Array.from({ length: 7 }, (_, i) => addDays(day, -7 + i));
    const t = existing.get(s.trend.topic_key);
    const hist = t ? (history.get(t.id) ?? []) : [];
    const prevCountries = prevDays.map((d) => ((hist.find((h) => h.day === d)?.components ?? {}) as { countries?: number }).countries ?? 0);
    const wikiPrev = prevDays.map((d) => sumBy("wikipedia", rows, d));
    const hnPrev = prevDays.map((d) => sumBy("hackernews", rows, d));
    out.set(s.trend.topic_key, {
      search: prevCountries.some((v) => v > 0) ? growthFactor(s.components.countries, prevCountries) : null,
      wikipedia: wikiPrev.some((v) => v > 0) ? growthFactor(sumBy("wikipedia", todayItems.map((i) => ({ ...i, topic_key: i.key }))), wikiPrev) : null,
      news: hnPrev.some((v) => v > 0) ? growthFactor(sumBy("hackernews", todayItems.map((i) => ({ ...i, topic_key: i.key }))), hnPrev) : null,
    });
  }
  return out;
}

async function uniqueSlug(slug: string, topicKey: string): Promise<string> {
  for (let i = 1; i < 20; i++) {
    const candidate = i === 1 ? slug : `${slug}-${i}`;
    const { data } = await db().from("trends").select("topic_key").eq("slug", candidate).maybeSingle();
    if (!data || data.topic_key === topicKey) return candidate;
  }
  return `${slug}-${Date.now().toString(36)}`;
}

async function persist(day: string, scored: ScoredTrend[], existing: Map<string, TrendRow>, factors: Map<string, Record<string, number | null>>, analyzedKeys: Set<string>): Promise<Map<string, TrendRow>> {
  const client = db();
  const saved = new Map<string, TrendRow>();
  for (const s of scored) {
    const t = s.trend;
    const prior = existing.get(t.topic_key);
    const peak = !prior || (prior.peak_heat ?? 0) <= s.heat ? { peak_heat: s.heat, peak_day: day } : {};
    const fields = {
      topic: t.topic,
      topic_key: t.topic_key,
      signal_key: t.signal_key,
      title: t.title,
      category: t.category,
      why: t.why,
      lifespan: t.lifespan,
      brand_safe: t.brand_safe,
      risk: t.risk,
      audiences: t.audiences as unknown as Json,
      angles: t.angles as unknown as Json,
      image_query: t.image_query,
      sources: t.sources as unknown as Json,
      last_seen: day,
      expires_at: expiresAt(day, s.outlook.expiresInDays),
      updated_at: new Date().toISOString(),
      ...(analyzedKeys.has(t.topic_key) ? { analyzed_at: new Date().toISOString() } : {}),
      ...peak,
    };
    if (prior) {
      // Une tendance masquée dans /admin le reste : on met ses données à jour sans la republier
      const { data, error } = await client.from("trends").update(fields).eq("id", prior.id).select("*").single();
      if (error) throw new Error(`trends update: ${error.message}`);
      saved.set(t.topic_key, data as TrendRow);
    } else {
      const slug = await uniqueSlug(t.slug, t.topic_key);
      const { data, error } = await client.from("trends").insert({ ...fields, slug, first_seen: day }).select("*").single();
      if (error) throw new Error(`trends insert: ${error.message}`);
      saved.set(t.topic_key, data as TrendRow);
    }
  }
  // Journée rejouable : on remplace les lignes du jour
  await client.from("trend_countries").delete().eq("day", day);
  await client.from("trend_days").delete().eq("day", day);
  const visible = scored.filter((s) => !saved.get(s.trend.topic_key)?.hidden);
  const dayRows = visible.map((s, i) => ({
    trend_id: saved.get(s.trend.topic_key)!.id,
    day,
    heat: s.heat,
    heat_change: s.heatChange,
    rank: i + 1,
    is_top: s.isTop,
    is_new: s.isNew,
    forecast: s.outlook.forecast,
    components: s.components as unknown as Json,
    factors: (factors.get(s.trend.topic_key) ?? {}) as Json,
    source_count: s.sourceCount,
    top3_countries: s.top3Countries,
  }));
  if (dayRows.length) {
    const { error } = await client.from("trend_days").insert(dayRows);
    if (error) throw new Error(`trend_days insert: ${error.message}`);
  }
  const countryRows = visible.flatMap((s) =>
    s.countries.map((c) => ({ trend_id: saved.get(s.trend.topic_key)!.id, day, country_code: c.code, heat: c.heat, rank: c.rank })),
  );
  for (let k = 0; k < countryRows.length; k += 1000) {
    const { error } = await client.from("trend_countries").insert(countryRows.slice(k, k + 1000));
    if (error) throw new Error(`trend_countries insert: ${error.message}`);
  }
  return saved;
}

async function runningAnalysis(day: string): Promise<boolean> {
  const since = new Date(Date.now() - 30 * 60_000).toISOString();
  const { data } = await db().from("analysis_runs").select("id").eq("day", day).eq("status", "running").gte("started_at", since).limit(1);
  return Boolean(data?.length);
}

export async function runDaily(opts: { log?: Log; force?: boolean } = {}): Promise<DailyReport> {
  const log: Log = opts.log ?? (() => {});
  const day = parisToday();
  const client = db();
  const report: DailyReport = { day, status: "failed", runId: null, sources: {}, candidates: 0, published: [], rejected: [], costUsd: 0, searches: 0 };

  if (!opts.force && (await runningAnalysis(day))) {
    log("An analysis is already running for today: skipped.");
    return { ...report, status: "skipped" };
  }
  const { data: run, error: runErr } = await client.from("analysis_runs").insert({ day }).select("id").single();
  if (runErr || !run) throw new Error(`analysis_runs: ${runErr?.message}`);
  report.runId = run.id;
  const finish = async (patch: Record<string, unknown>) => {
    await client.from("analysis_runs").update({ finished_at: new Date().toISOString(), ...patch }).eq("id", run.id);
  };

  try {
    // 1. Collecte
    log("Collecting signals…");
    const results = await collectSignals({ day });
    report.sources = sourcesSummary(results);
    for (const r of results) log(`  ${r.source}: ${r.ok ? `${r.items.length} items` : `FAILED (${r.error})`} in ${r.ms} ms`);
    await storeSignals(day, results);
    const ok = okSources(results);
    if (ok.length < 2) await openIncident("sources_down", { day, sources: report.sources });
    else await closeIncident("sources_down");
    await client.from("analysis_runs").update({ sources: report.sources as Json }).eq("id", run.id);

    const candidates = buildCandidates(results);
    report.candidates = candidates.length;
    log(`${candidates.length} candidates`);
    if (candidates.length === 0) throw new Error("no candidates: every source failed or returned nothing");

    // 2. Analyse incrémentale : l'IA ne voit que les sujets nouveaux et les tendances à rafraîchir
    const { data: knownRows, error: knownErr } = await client.from("trends").select("*").gte("last_seen", addDays(day, -KNOWN_WITHIN_DAYS));
    if (knownErr) throw new Error(`trends: ${knownErr.message}`);
    const known = (knownRows ?? []) as TrendRow[];
    const split = splitCandidates(day, new Date(), candidates, known);
    let kept: CheckedTrend[] = split.keep.map(trendFromRow).filter(stillAllowed);
    // Chaleur qui bondit : l'analyse gardée ne dit sans doute plus pourquoi le sujet chauffe
    const yesterdayGoogle = await loadGoogleItems(addDays(day, -1));
    if (kept.length) {
      const { prev } = await loadPrevState(day, kept.map((t) => t.topic_key));
      const pre = scoreDay({ accepted: kept, results, prev, yesterdayGoogle });
      const jumped = new Set(pre.published.filter((s) => heatJumped(s.heat, prev.get(s.trend.topic_key)?.hPrev ?? null)).map((s) => s.trend.topic_key));
      for (const k of split.keep.filter((r) => jumped.has(r.topic_key))) {
        const c = candidates.find((x) => x.key === k.topic_key || x.key === k.signal_key || matchesTopic(k.topic_key, x.key));
        if (c) split.refresh.push({ trend: k, candidate: c });
      }
      kept = kept.filter((t) => !jumped.has(t.topic_key));
    }
    const toAnalyze = [...split.fresh, ...split.refresh.map((r) => r.candidate)].sort((a, b) => b.score - a.score);
    report.incremental = { fresh: split.fresh.length, refreshed: split.refresh.length, kept: kept.length, hidden: split.hidden, aiSkipped: toAnalyze.length === 0 };
    log(`Incremental: ${split.fresh.length} new, ${split.refresh.length} to refresh, ${kept.length} kept`);

    let analysis: AnalysisResult | null = null;
    if (toAnalyze.length > 0) {
      let lastError = "";
      for (let attempt = 1; attempt <= 2 && !analysis; attempt++) {
        try {
          log(`Analysis attempt ${attempt}…`);
          await client.from("analysis_runs").update({ attempt }).eq("id", run.id);
          analysis = await analyzeDay(day, toAnalyze, kept.map((t) => t.title));
        } catch (e) {
          lastError = (e as Error).message.slice(0, 500);
          log(`  failed: ${lastError}`);
          if (e instanceof BudgetExceededError) break;
        }
      }
      if (!analysis) {
        await openIncident("analysis_failed", { day, error: lastError });
        report.status = "fallback";
        report.error = lastError;
        await finish({ status: "fallback", error: lastError, candidates: candidates.length });
        log("Analysis failed: today keeps yesterday's trends that are still valid.");
        return report;
      }
      await closeIncident("analysis_failed");
      report.costUsd = analysis.generation.costUsd;
      report.searches = analysis.generation.research?.searches ?? 0;
      report.rejected = [...analysis.rejected];
      log(`${analysis.accepted.length} trends passed the checks, ${analysis.rejected.length} rejected`);
    } else {
      log("Nothing new today: no AI call, kept analyses only.");
    }

    // 3. Chaleur, score, sélection : analyses du jour + analyses gardées
    const knownAll = [...split.keep, ...split.refresh.map((r) => r.trend)];
    const fresh = (analysis?.accepted ?? []).map((t) => alignWithKnown(t, knownAll));
    const freshKeys = new Set(fresh.map((t) => t.topic_key));
    const accepted = [...fresh, ...kept.filter((t) => !freshKeys.has(t.topic_key))];
    const keys = accepted.map((t) => t.topic_key);
    const { prev, existing, history } = await loadPrevState(day, keys);
    const { published, unconfirmed } = scoreDay({ accepted, results, prev, yesterdayGoogle });
    report.rejected.push(...unconfirmed);
    const factors = await computeFactors(day, published, history, existing, results);
    const saved = await persist(day, published, existing, factors, freshKeys);

    // 4. Photos pour les nouvelles tendances (ou sans photo active)
    const ids = [...saved.values()].map((t) => t.id);
    const { data: withImage } = ids.length ? await client.from("trend_images").select("trend_id").in("trend_id", ids).eq("active", true) : { data: [] };
    const hasImage = new Set((withImage ?? []).map((r) => r.trend_id));
    for (const s of published) {
      const t = saved.get(s.trend.topic_key)!;
      let photo = hasImage.has(t.id) ? "kept" : "none";
      if (!hasImage.has(t.id)) {
        const out = await attachPhoto({ id: t.id, slug: t.slug, image_query: t.image_query, category: t.category as Category });
        photo = out.ok ? `pexels ${out.pexelsId}` : `none (${out.reason})`;
      }
      report.published.push({ slug: t.slug, title: t.title, heat: s.heat, rank: s.rank, is_top: s.isTop, photo });
    }

    report.status = "ok";
    await finish({
      status: "ok",
      candidates: candidates.length,
      searches: report.searches,
      search_urls: (analysis?.generation.research?.results ?? []).map((r) => r.url) as Json,
      rejected: report.rejected as unknown as Json,
      trends_count: published.length,
      input_tokens: analysis?.generation.usage.input_tokens ?? 0,
      output_tokens: analysis?.generation.usage.output_tokens ?? 0,
      cost_usd: report.costUsd,
    });
    await pingIndexNow(report.published.map((p) => `/t/${p.slug}`).concat(["/", "/archive"]));
    return report;
  } catch (e) {
    report.status = "failed";
    report.error = (e as Error).message.slice(0, 500);
    await finish({ status: "failed", error: report.error });
    log(`FAILED: ${report.error}`);
    return report;
  }
}
