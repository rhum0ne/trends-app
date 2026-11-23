// Mots-clés visuels pour Pexels (docs/images.md § 1).

import type { Category } from "@/lib/types";
import { normalizeTopic, topicTokens } from "@/lib/normalize";
import { blockedWordSet } from "@/lib/blocklist";

/** Requête par défaut de chaque catégorie : une scène générique photographiable. */
export const CATEGORY_IMAGE_QUERY: Record<Category, string> = {
  gaming: "gaming night controller neon",
  tech: "laptop desk city night",
  ai: "laptop code bright office",
  entertainment: "cinema seats red light",
  sport: "stadium lights crowd night",
  culture: "museum crowd gallery light",
  business: "office skyline glass building",
  design: "designer sketchbook desk",
  lifestyle: "city street people walking",
  food: "restaurant kitchen chef plate",
  music: "concert crowd stage lights",
  other: "city lights night street",
};

export interface ImageQueryCheck {
  ok: boolean;
  query: string;
  reason?: string;
}

/**
 * checkImageQuery : 2 à 5 mots, aucun mot du topic, aucun mot du blocklist, aucun nom propre.
 * Échec → requête de la catégorie.
 */
export function checkImageQuery(query: string, topic: string, category: Category): ImageQueryCheck {
  const fallback = (reason: string): ImageQueryCheck => ({ ok: false, query: CATEGORY_IMAGE_QUERY[category] ?? CATEGORY_IMAGE_QUERY.other, reason });
  const raw = (query ?? "").trim().replace(/\s+/g, " ");
  if (!raw) return fallback("empty");
  const words = raw.split(" ");
  if (words.length < 2 || words.length > 5) return fallback("word count");
  if (!/^[A-Za-z][A-Za-z\s-]*$/.test(raw)) return fallback("not plain english words");
  // Nom propre : majuscule ailleurs qu'au premier mot, ou mot tout en capitales
  if (words.some((w, i) => (i > 0 && /^[A-Z]/.test(w)) || (w.length > 1 && w === w.toUpperCase()))) return fallback("proper noun");
  const key = normalizeTopic(raw);
  const qWords = new Set(key.split(" "));
  const topicWords = topicTokens(normalizeTopic(topic)).filter((w) => w.length > 1);
  if (topicWords.some((w) => qWords.has(w))) return fallback("contains topic word");
  const blocked = blockedWordSet();
  if ([...qWords].some((w) => blocked.has(w))) return fallback("blocked word");
  return { ok: true, query: key };
}
