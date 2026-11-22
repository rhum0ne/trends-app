// Client Pexels (docs/images.md § 2). Une erreur, un 429 ou l'absence de clé ne font jamais échouer
// le pipeline : la tendance est publiée sans photo. Jamais appelé pendant une visite ni une requête d'API.

import { env } from "@/lib/env";

export interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  photographer_url: string;
  avg_color: string | null;
  alt: string | null;
  src: { original: string; large2x: string; large: string; medium: string };
}

export type PexelsSearch = { ok: true; photos: PexelsPhoto[] } | { ok: false; reason: "no_key" | "rate_limited" | "timeout" | "error"; status?: number };

const TIMEOUT_MS = 10_000;

export function searchUrl(query: string): string {
  const q = new URLSearchParams({ query, orientation: "landscape", per_page: "15", size: "large" });
  return `https://api.pexels.com/v1/search?${q.toString()}`;
}

export async function searchPexels(query: string, fetchImpl: typeof fetch = fetch): Promise<PexelsSearch> {
  const key = env("PEXELS_API_KEY");
  if (!key) return { ok: false, reason: "no_key" };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(searchUrl(query), { headers: { Authorization: key }, signal: ctrl.signal });
    if (res.status === 429) return { ok: false, reason: "rate_limited", status: 429 };
    if (!res.ok) return { ok: false, reason: "error", status: res.status };
    const data = (await res.json()) as { photos?: PexelsPhoto[] };
    return { ok: true, photos: Array.isArray(data.photos) ? data.photos : [] };
  } catch (e) {
    return { ok: false, reason: (e as Error).name === "AbortError" ? "timeout" : "error" };
  } finally {
    clearTimeout(timer);
  }
}

export const MIN_WIDTH = 1600;

/**
 * pickPhoto : écarte les photos utilisées dans les 30 derniers jours, préfère le paysage d'au moins 1600 px,
 * sinon la première qui reste ; null si rien.
 */
export function pickPhoto(photos: PexelsPhoto[], recentlyUsed: Set<number>): PexelsPhoto | null {
  const fresh = photos.filter((p) => p && Number.isFinite(p.id) && !recentlyUsed.has(p.id) && p.src?.large2x);
  const preferred = fresh.find((p) => p.width >= p.height && p.width >= MIN_WIDTH);
  return preferred ?? fresh[0] ?? null;
}
