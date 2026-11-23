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
/** Luminosité moyenne (0–1) sous laquelle une photo sort presque noire du filtre thermique. */
export const MIN_BRIGHTNESS = 0.12;

/** Luminosité perçue de avg_color (#rrggbb), 0 à 1 ; null si absente ou illisible. */
export function brightness(hex: string | null): number | null {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex?.trim() ?? "");
  if (!m) return null;
  const [r, g, b] = m.slice(1).map((x) => parseInt(x, 16) / 255);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Une photo trop sombre (nuit noire, salle éteinte) donne un aplat noir une fois filtrée : écartée. */
export function tooDark(p: Pick<PexelsPhoto, "avg_color">): boolean {
  const l = brightness(p.avg_color);
  return l !== null && l < MIN_BRIGHTNESS;
}

/**
 * pickPhoto : écarte les photos utilisées dans les 30 derniers jours et les photos trop sombres,
 * préfère le paysage d'au moins 1600 px, sinon la première qui reste ; null si rien.
 */
export function pickPhoto(photos: PexelsPhoto[], recentlyUsed: Set<number>): PexelsPhoto | null {
  const fresh = photos.filter((p) => p && Number.isFinite(p.id) && !recentlyUsed.has(p.id) && p.src?.large2x && !tooDark(p));
  const preferred = fresh.find((p) => p.width >= p.height && p.width >= MIN_WIDTH);
  return preferred ?? fresh[0] ?? null;
}
