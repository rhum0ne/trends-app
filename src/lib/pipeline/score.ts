// Chaleur, sélection et pays d'une journée — pur, sans I/O (docs/heat.md ; CLAUDE.md § 5.3).

import type { SourceName } from "@/lib/types";
import type { SourceItem, SourceResult } from "@/lib/sources";
import type { CheckedTrend } from "@/lib/ai/checks";
import { matchesTopic } from "@/lib/normalize";
import {
  computeCountryHeat,
  computeHeat,
  computeOutlook,
  rankByHeat,
  MAX_PUBLISHED,
  type HeatComponents,
  type Outlook,
} from "@/lib/heat";

export interface PrevState {
  /** spread de la veille (null : absente la veille → sujet nouveau). */
  prevSpread: number | null;
  hPrev: number | null;
  hPrev2: number | null;
}

export interface ScoredTrend {
  trend: CheckedTrend;
  heat: number;
  components: HeatComponents & { countries: number; tracked: number };
  sourceCount: number;
  sources: SourceName[];
  countryRanks: Record<string, number>;
  isNew: boolean;
  outlook: Outlook;
  rank: number;
  isTop: boolean;
  heatChange: number;
  countries: { code: string; heat: number; rank: number }[];
  top3Countries: number;
}

/** Les éléments d'une source qui parlent du sujet (clé du signal ou clé du sujet). */
export function itemsFor(trend: Pick<CheckedTrend, "topic_key" | "signal_key">, items: SourceItem[]): SourceItem[] {
  const keys = [trend.signal_key, trend.topic_key].filter(Boolean);
  return items.filter((i) => keys.some((k) => i.key === k || matchesTopic(k, i.key)));
}

export function bestCountryRanks(items: SourceItem[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const i of items) {
    if (i.source !== "google" || !i.country || i.rank == null) continue;
    if (out[i.country] === undefined || i.rank < out[i.country]) out[i.country] = i.rank;
  }
  return out;
}

export interface ScoreInput {
  accepted: CheckedTrend[];
  results: SourceResult[];
  prev: Map<string, PrevState>;
  /** Éléments Google de la veille (rang par pays, pour la chaleur par pays). */
  yesterdayGoogle: SourceItem[];
}

export interface ScoreOutput {
  published: ScoredTrend[];
  unconfirmed: { topic: string; reason: string }[];
  trackedCountries: string[];
}

export function scoreDay({ accepted, results, prev, yesterdayGoogle }: ScoreInput): ScoreOutput {
  const items = results.flatMap((r) => (r.ok ? r.items : []));
  const google = results.find((r) => r.source === "google" && r.ok);
  const tracked = google?.trackedCountries ?? [...new Set(items.filter((i) => i.source === "google" && i.country).map((i) => i.country as string))];
  const unconfirmed: ScoreOutput["unconfirmed"] = [];
  const scored: Omit<ScoredTrend, "rank" | "isTop" | "countries">[] = [];

  for (const t of accepted) {
    const matched = itemsFor(t, items);
    const sources = [...new Set(matched.map((m) => m.source))].sort() as SourceName[];
    // Une tendance doit être confirmée par au moins une source gratuite ET par l'analyse
    if (sources.length === 0) {
      unconfirmed.push({ topic: t.topic, reason: "no free source cites it today" });
      continue;
    }
    const countryRanks = bestCountryRanks(matched);
    const p = prev.get(t.topic_key) ?? { prevSpread: null, hPrev: null, hPrev2: null };
    const { heat, components } = computeHeat({ trackedCountries: tracked.length, countryRanks, prevSpread: p.prevSpread, sourceCount: sources.length });
    const outlook = computeOutlook({ h0: heat, hPrev: p.hPrev, hPrev2: p.hPrev2, lifespan: t.lifespan });
    scored.push({
      trend: t,
      heat,
      components: { ...components, countries: Object.keys(countryRanks).length, tracked: tracked.length },
      sourceCount: sources.length,
      sources,
      countryRanks,
      isNew: p.hPrev === null,
      outlook,
      heatChange: p.hPrev === null ? 0 : heat - p.hPrev,
      top3Countries: Object.values(countryRanks).filter((r) => r <= 3).length,
    });
  }

  // 10 tendances au plus, par chaleur
  const ranked = rankByHeat(scored.map((s) => ({ ...s, key: s.trend.topic_key }))).slice(0, MAX_PUBLISHED);
  // La tendance du jour : la plus chaude parmi celles sûres pour une marque
  const top = ranked.find((r) => r.trend.brand_safe);

  // Chaleur par pays, puis rang de chaque tendance dans chaque pays (parmi les publiées)
  const yRank = (code: string, t: CheckedTrend): number | null => {
    const r = bestCountryRanks(itemsFor(t, yesterdayGoogle.filter((i) => i.country === code)))[code];
    return r ?? null;
  };
  const perCountry = new Map<string, { idx: number; heat: number }[]>();
  const countryHeats = ranked.map((r, idx) =>
    Object.entries(r.countryRanks).map(([code, rank]) => {
      const heat = computeCountryHeat(rank, yRank(code, r.trend));
      const list = perCountry.get(code) ?? [];
      list.push({ idx, heat });
      perCountry.set(code, list);
      return { code, heat };
    }),
  );
  const countryRank = new Map<string, number>();
  for (const [code, list] of perCountry) {
    list.sort((a, b) => b.heat - a.heat || a.idx - b.idx).forEach((e, i) => countryRank.set(`${code}|${e.idx}`, i + 1));
  }

  const published: ScoredTrend[] = ranked.map((r, idx) => {
    const { key: _key, ...rest } = r;
    void _key;
    return {
      ...rest,
      isTop: top ? r.trend.topic_key === top.trend.topic_key : false,
      countries: countryHeats[idx]
        .map((c) => ({ ...c, rank: countryRank.get(`${c.code}|${idx}`) ?? 1 }))
        .sort((a, b) => b.heat - a.heat || a.code.localeCompare(b.code)),
    };
  });
  return { published, unconfirmed, trackedCountries: tracked };
}
