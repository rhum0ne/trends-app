import { serializeJsonLd } from "@/lib/seo/jsonld";

/** Données structurées schema.org (src/lib/seo/jsonld.ts). */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
