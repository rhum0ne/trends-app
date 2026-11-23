// Données structurées JSON-LD (schema.org). Elles ne décrivent que ce qui est visible sur la page :
// pas de note, d'avis ni de chiffre inventé (CLAUDE.md § 8, « pas de données structurées trompeuses »).

import { CATEGORY_LABEL } from "@/lib/format";
import { SITE_URL } from "@/lib/links";
import type { TrendView } from "@/lib/types";

type Ld = Record<string, unknown>;

export const ORG_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

/** Le site et son éditeur, sur toutes les pages publiques. */
export function siteJsonLd(): Ld {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": ORG_ID,
        name: "trends°",
        url: `${SITE_URL}/`,
        logo: { "@type": "ImageObject", url: `${SITE_URL}/icon-512.png`, width: 512, height: 512 },
        description: "The internet's weather report, for makers: the trend of the day, its heat, forecast and how to post about it.",
        parentOrganization: { "@type": "Organization", name: "upTake", url: "https://uptake.me" },
      },
      {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        name: "trends°",
        alternateName: "trends by upTake",
        url: `${SITE_URL}/`,
        description: "The trend of the day, and how to use it for your product. Heat, forecast and post angles for makers.",
        inLanguage: "en",
        publisher: { "@id": ORG_ID },
      },
    ],
  };
}

/** Une tendance : l'analyse (Article) et son fil d'Ariane. */
export function trendJsonLd(trend: TrendView): Ld {
  const url = `${SITE_URL}/t/${trend.slug}`;
  const image = trend.image
    ? {
        "@type": "ImageObject",
        url: trend.image.url,
        width: trend.image.width,
        height: trend.image.height,
        caption: trend.image.alt || undefined,
        creditText: `Photo: ${trend.image.credit.name} on Pexels`,
        creator: { "@type": "Person", name: trend.image.credit.name, url: trend.image.credit.url },
      }
    : undefined;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${url}#analysis`,
        headline: trend.cooled ? `${trend.topic} has cooled` : `${trend.topic} is heating up`,
        description: trend.why,
        url,
        mainEntityOfPage: url,
        inLanguage: "en",
        datePublished: trend.first_seen,
        dateModified: trend.updated_at ?? trend.last_seen,
        articleSection: CATEGORY_LABEL[trend.category] ?? trend.category,
        about: { "@type": "Thing", name: trend.topic },
        image,
        isAccessibleForFree: true,
        author: { "@id": ORG_ID },
        publisher: { "@id": ORG_ID },
        isPartOf: { "@id": WEBSITE_ID },
        citation: trend.sources.map((s) => ({ "@type": "CreativeWork", name: s.title, url: s.url })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Today", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: trend.title },
        ],
      },
    ],
  };
}

/** Une liste de tendances dans l'ordre affiché (accueil, archive). */
export function trendListJsonLd(name: string, trends: Pick<TrendView, "slug" | "topic">[]): Ld {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: trends.length,
    itemListElement: trends.map((t, i) => ({ "@type": "ListItem", position: i + 1, name: t.topic, url: `${SITE_URL}/t/${t.slug}` })),
  };
}

/** JSON sûr dans une balise <script> : aucun « </script> » ni commentaire HTML ne peut en sortir. */
export function serializeJsonLd(data: Ld): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}
