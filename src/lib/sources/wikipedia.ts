// Wikipédia : API Pageviews officielle, articles les plus vus de la veille, plusieurs langues.
// User-Agent avec un moyen de contact (politique Wikimedia, docs/sources.md).

import { normalizeTopic } from "@/lib/normalize";
import { env } from "@/lib/env";
import { fetchJson, runSource, type SourceItem, type SourceResult } from "./types";

export const WIKI_PROJECTS = ["en", "fr", "de", "es", "it", "pt", "ja"] as const;
const PER_PROJECT = 40;

// Pages d'accueil et pages techniques à écarter (le reste des espaces de noms contient « : »)
const SKIP = new Set(
  [
    "Main_Page", "Wikipédia:Accueil_principal", "Wikipedia:Hauptseite", "Hauptseite", "Wikipedia:Portada", "Pagina_principale",
    "Wikipédia:Página_principal", "メインページ", "Special:Search", "-", "Undefined",
  ].map((s) => s.toLowerCase()),
);

interface PageviewsResponse {
  items?: { articles?: { article: string; views: number; rank: number }[] }[];
}

export function parsePageviews(project: string, data: PageviewsResponse): SourceItem[] {
  const articles = data.items?.[0]?.articles ?? [];
  const out: SourceItem[] = [];
  for (const a of articles) {
    if (!a?.article || SKIP.has(a.article.toLowerCase()) || a.article.includes(":")) continue;
    const raw = a.article.replace(/_/g, " ");
    const key = normalizeTopic(raw);
    if (!key) continue;
    out.push({ source: "wikipedia", raw, key, country: null, rank: out.length + 1, value: a.views, meta: { project } });
    if (out.length >= PER_PROJECT) break;
  }
  return out;
}

export function userAgent(): string {
  const contact = env("WIKIMEDIA_CONTACT");
  if (!contact) throw new Error("wikipedia: WIKIMEDIA_CONTACT is not set (required in the User-Agent)");
  return `trends-by-uptake/1.0 (https://trends.uptake.me; ${contact})`;
}

/** Articles les plus vus le jour `day` (YYYY-MM-DD, normalement la veille). */
export function fetchWikipedia(day: string): Promise<SourceResult> {
  return runSource("wikipedia", async () => {
    const ua = userAgent();
    const [y, m, d] = day.split("-");
    const results = await Promise.allSettled(
      WIKI_PROJECTS.map((p) =>
        fetchJson<PageviewsResponse>(
          `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/${p}.wikipedia.org/all-access/${y}/${m}/${d}`,
          { source: "wikipedia", headers: { "User-Agent": ua, "Api-User-Agent": ua, Accept: "application/json" } },
        ).then((data) => parsePageviews(p, data)),
      ),
    );
    const items = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    if (items.length === 0) {
      const first = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
      throw new Error(first ? String((first.reason as Error)?.message ?? first.reason) : "wikipedia: no articles");
    }
    return { items };
  });
}
