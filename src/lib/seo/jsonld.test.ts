import { describe, expect, it } from "vitest";
import { EXAMPLE_TRENDS } from "@/lib/examples";
import { SITE_URL } from "@/lib/links";
import { serializeJsonLd, siteJsonLd, trendJsonLd, trendListJsonLd } from "./jsonld";

const trend = EXAMPLE_TRENDS[0];
type Node = Record<string, unknown>;
const graph = (ld: Record<string, unknown>) => ld["@graph"] as Node[];

describe("trendJsonLd", () => {
  it("décrit l'analyse avec ses dates, sa catégorie et ses sources", () => {
    const [article, crumbs] = graph(trendJsonLd(trend));
    expect(article["@type"]).toBe("Article");
    expect(article.headline).toBe("GTA VI is heating up");
    expect(article.url).toBe(`${SITE_URL}/t/${trend.slug}`);
    expect(article.datePublished).toBe(trend.first_seen);
    expect(article.dateModified).toBe(trend.last_seen);
    expect(article.articleSection).toBe("Gaming");
    expect(article.citation).toEqual([{ "@type": "CreativeWork", name: "Example source", url: "https://example.com" }]);
    expect(article.image).toBeUndefined();
    expect(crumbs["@type"]).toBe("BreadcrumbList");
  });

  it("dit qu'une tendance expirée a refroidi et crédite la photo", () => {
    const image = { url: "https://x/p.jpg", width: 1200, height: 800, alt: "a crowd", avg_color: null, credit: { name: "Ana", url: "https://pexels.com/@ana" }, source_url: "https://pexels.com/photo/1" };
    const [article] = graph(trendJsonLd({ ...trend, cooled: true, image }));
    expect(article.headline).toBe("GTA VI has cooled");
    expect(article.image).toMatchObject({ url: image.url, creditText: "Photo: Ana on Pexels" });
  });

  it("ne contient ni chaleur, ni note, ni avis", () => {
    const json = JSON.stringify(trendJsonLd(trend));
    expect(json).not.toMatch(/aggregateRating|review|"heat"/i);
  });
});

describe("trendListJsonLd", () => {
  it("garde l'ordre affiché", () => {
    const ld = trendListJsonLd("Today", EXAMPLE_TRENDS.slice(0, 2));
    const items = ld.itemListElement as Node[];
    expect(ld.numberOfItems).toBe(2);
    expect(items[1]).toMatchObject({ position: 2, url: `${SITE_URL}/t/${EXAMPLE_TRENDS[1].slug}` });
  });
});

describe("serializeJsonLd", () => {
  it("ne laisse aucune balise sortir du <script>", () => {
    const out = serializeJsonLd({ name: "</script><script>alert(1)</script> & <!--" });
    expect(out).not.toMatch(/[<>&]/);
    expect(JSON.parse(out).name).toBe("</script><script>alert(1)</script> & <!--");
  });

  it("décrit le site et son éditeur", () => {
    const types = graph(siteJsonLd()).map((n) => n["@type"]);
    expect(types).toEqual(["Organization", "WebSite"]);
  });
});
