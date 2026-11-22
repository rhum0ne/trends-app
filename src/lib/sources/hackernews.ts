// Hacker News : API Algolia, histoires de la première page publiées dans les dernières 24 h.

import { normalizeTopic } from "@/lib/normalize";
import { fetchJson, runSource, type SourceItem, type SourceResult } from "./types";

interface AlgoliaResponse {
  hits?: { title?: string | null; points?: number | null; objectID?: string; created_at_i?: number }[];
}

export function hnUrl(nowSec: number): string {
  const since = nowSec - 86_400;
  return `https://hn.algolia.com/api/v1/search?tags=front_page&numericFilters=created_at_i>${since}&hitsPerPage=60`;
}

export function parseHackerNews(data: AlgoliaResponse): SourceItem[] {
  const hits = Array.isArray(data?.hits) ? data.hits : [];
  return hits
    .filter((h) => h?.title)
    .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
    .map((h, i) => ({
      source: "hackernews" as const,
      raw: h.title as string,
      key: normalizeTopic(h.title as string),
      country: null,
      rank: i + 1,
      value: h.points ?? null,
      meta: { id: h.objectID },
    }))
    .filter((it) => it.key);
}

export function fetchHackerNews(now: Date = new Date()): Promise<SourceResult> {
  return runSource("hackernews", async () => {
    const data = await fetchJson<AlgoliaResponse>(hnUrl(Math.floor(now.getTime() / 1000)), { source: "hackernews" });
    const items = parseHackerNews(data);
    if (items.length === 0) throw new Error("hackernews: no stories");
    return { items };
  });
}
