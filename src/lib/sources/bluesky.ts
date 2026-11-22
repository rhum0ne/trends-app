// Bluesky : app.bsky.unspecced.getTrendingTopics (point d'accès non stabilisé : on tolère sa disparition).

import { normalizeTopic } from "@/lib/normalize";
import { fetchJson, runSource, type SourceItem, type SourceResult } from "./types";

const URL = "https://public.api.bsky.app/xrpc/app.bsky.unspecced.getTrendingTopics?limit=25";

interface TrendingResponse {
  topics?: { topic?: string; displayName?: string; link?: string }[];
}

export function parseBluesky(data: TrendingResponse): SourceItem[] {
  const topics = Array.isArray(data?.topics) ? data.topics : [];
  const out: SourceItem[] = [];
  for (const t of topics) {
    const raw = (t?.displayName || t?.topic || "").trim();
    const key = normalizeTopic(raw);
    if (!key) continue;
    out.push({ source: "bluesky", raw, key, country: null, rank: out.length + 1, value: null });
  }
  return out;
}

export function fetchBluesky(): Promise<SourceResult> {
  return runSource("bluesky", async () => {
    const data = await fetchJson<TrendingResponse>(URL, { source: "bluesky", headers: { Accept: "application/json" } });
    const items = parseBluesky(data);
    if (items.length === 0) throw new Error("bluesky: empty or changed response");
    return { items };
  });
}
