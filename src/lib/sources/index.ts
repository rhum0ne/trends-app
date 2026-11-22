// Collecte des signaux gratuits (CLAUDE.md § 5.1) : toutes les sources en parallèle,
// une source en panne n'arrête pas les autres.

import type { SourceName } from "@/lib/types";
import { matchesTopic } from "@/lib/normalize";
import { addDays } from "@/lib/format";
import { fetchGoogleTrends } from "./google";
import { fetchWikipedia } from "./wikipedia";
import { fetchBluesky } from "./bluesky";
import { fetchHackerNews } from "./hackernews";
import type { SourceItem, SourceResult } from "./types";

export type { SourceItem, SourceResult } from "./types";

export interface CollectOptions {
  day: string;
  /** Sources à lire (par défaut : les 4). Le rafraîchissement horaire n'interroge pas BigQuery. */
  only?: SourceName[];
}

export async function collectSignals({ day, only }: CollectOptions): Promise<SourceResult[]> {
  const want = new Set<SourceName>(only ?? ["google", "wikipedia", "bluesky", "hackernews"]);
  const jobs: Promise<SourceResult>[] = [];
  if (want.has("google")) jobs.push(fetchGoogleTrends());
  if (want.has("wikipedia")) jobs.push(fetchWikipedia(addDays(day, -1)));
  if (want.has("bluesky")) jobs.push(fetchBluesky());
  if (want.has("hackernews")) jobs.push(fetchHackerNews());
  return Promise.all(jobs); // runSource ne rejette jamais
}

export function okSources(results: SourceResult[]): SourceName[] {
  return results.filter((r) => r.ok).map((r) => r.source);
}

// ─── Candidats pour l'analyse ──────────────────────────────────────────────

export interface Candidate {
  key: string;
  label: string;
  sources: SourceName[];
  googleCountries: number;
  googleBestRank: number | null;
  wikiViews: number;
  hnPoints: number;
  blueskyRank: number | null;
  score: number;
}

/**
 * Regroupe les éléments par clé normalisée et compte les sources qui citent chaque sujet.
 * Les titres de Hacker News (phrases entières) ne deviennent candidats que s'ils recoupent un autre sujet
 * ou sont parmi les 15 premiers.
 */
export function buildCandidates(results: SourceResult[], limit = 60): Candidate[] {
  const items = results.flatMap((r) => (r.ok ? r.items : []));
  const groups = new Map<string, SourceItem[]>();
  for (const it of items) {
    if (it.source === "hackernews" && (it.rank ?? 99) > 15) continue;
    const list = groups.get(it.key) ?? [];
    list.push(it);
    groups.set(it.key, list);
  }
  const all = [...groups.entries()].map(([key, list]) => {
    const sources = new Set<SourceName>(list.map((i) => i.source));
    // Une source « cite » aussi le sujet si l'un de ses éléments contient tous ses mots
    for (const it of items) if (!sources.has(it.source) && it.key.length > key.length && matchesTopic(key, it.key)) sources.add(it.source);
    const google = items.filter((i) => i.source === "google" && (i.key === key || matchesTopic(key, i.key)));
    const countries = new Set(google.map((g) => g.country));
    const wikiViews = items.filter((i) => i.source === "wikipedia" && i.key === key).reduce((a, i) => a + (i.value ?? 0), 0);
    const hnPoints = items.filter((i) => i.source === "hackernews" && i.key === key).reduce((a, i) => a + (i.value ?? 0), 0);
    const bsky = items.find((i) => i.source === "bluesky" && i.key === key);
    const googleBestRank = google.length ? Math.min(...google.map((g) => g.rank ?? 99)) : null;
    const score = sources.size * 10 + countries.size * 3 + Math.log10(1 + wikiViews) * 2 + (bsky ? 5 : 0) + Math.log10(1 + hnPoints);
    return {
      key,
      label: list[0].raw,
      sources: [...sources].sort(),
      googleCountries: countries.size,
      googleBestRank,
      wikiViews,
      hnPoints,
      blueskyRank: bsky?.rank ?? null,
      score: Math.round(score * 10) / 10,
    } satisfies Candidate;
  });
  return all.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key)).slice(0, limit);
}
