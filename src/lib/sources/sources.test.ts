import { afterEach, describe, expect, it, vi } from "vitest";
import { parsePageviews, fetchWikipedia } from "./wikipedia";
import { parseBluesky, fetchBluesky } from "./bluesky";
import { parseHackerNews, fetchHackerNews, hnUrl } from "./hackernews";
import { aggregateGoogleRows, missingColumns, trendsQuery, REQUIRED_COLUMNS } from "./google";
import { buildCandidates, collectSignals } from "./index";
import type { SourceResult } from "./types";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("wikipedia", () => {
  const sample = {
    items: [
      {
        articles: [
          { article: "Main_Page", views: 5_000_000, rank: 1 },
          { article: "Special:Search", views: 900_000, rank: 2 },
          { article: "Grand_Theft_Auto_VI", views: 400_000, rank: 3 },
          { article: "Black_Friday_(shopping)", views: 200_000, rank: 4 },
        ],
      },
    ],
  };

  it("skips main and special pages and normalizes titles", () => {
    const items = parsePageviews("en", sample);
    expect(items.map((i) => i.key)).toEqual(["gta 6", "black friday shopping"]);
    expect(items[0]).toMatchObject({ source: "wikipedia", rank: 1, value: 400_000, country: null });
  });

  it("requires a contact in the User-Agent", async () => {
    vi.stubEnv("WIKIMEDIA_CONTACT", "");
    const res = await fetchWikipedia("2026-11-21");
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/WIKIMEDIA_CONTACT/);
  });

  it("fetches yesterday's top articles with a contact User-Agent", async () => {
    vi.stubEnv("WIKIMEDIA_CONTACT", "contact page");
    const fetchMock = vi.fn(async () => jsonResponse(sample));
    vi.stubGlobal("fetch", fetchMock);
    const res = await fetchWikipedia("2026-11-21");
    expect(res.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/2026/11/21");
    expect((init.headers as Record<string, string>)["User-Agent"]).toContain("contact page");
  });
});

describe("bluesky", () => {
  it("parses topics and tolerates a changed response", () => {
    expect(parseBluesky({ topics: [{ topic: "gta6", displayName: "GTA 6" }, { topic: "" }] }).map((i) => i.key)).toEqual(["gta 6"]);
    expect(parseBluesky({} as never)).toEqual([]);
    expect(parseBluesky(null as never)).toEqual([]);
  });

  it("returns a failed result when the endpoint disappears", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "MethodNotImplemented" }, 501)));
    const res = await fetchBluesky();
    expect(res.ok).toBe(false);
    expect(res.error).toContain("HTTP 501");
  });
});

describe("hacker news", () => {
  it("orders stories by points", () => {
    const items = parseHackerNews({ hits: [{ title: "Show HN: thing", points: 10 }, { title: "GTA VI delayed again", points: 500 }, { title: null }] });
    expect(items.map((i) => i.raw)).toEqual(["GTA VI delayed again", "Show HN: thing"]);
    expect(items[0].key).toBe("gta 6 delayed again");
  });
  it("queries the last 24 hours", () => {
    expect(hnUrl(1_000_000)).toContain(`created_at_i>${1_000_000 - 86_400}`);
  });
  it("times out after 10 seconds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => new Promise((_res, rej) => init.signal?.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" }))))),
    );
    vi.useFakeTimers();
    const p = fetchHackerNews(new Date(0));
    await vi.advanceTimersByTimeAsync(10_001);
    const res = await p;
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/timed out/);
  });
});

describe("google (BigQuery)", () => {
  it("keeps the best rank per country and term, and lists tracked countries", () => {
    const { items, trackedCountries } = aggregateGoogleRows([
      { country_code: "fr", term: "GTA 6", rank: 3, kind: "top" },
      { country_code: "FR", term: "gta vi", rank: 1, kind: "rising" },
      { country_code: "US", term: "black friday", rank: "2", kind: "top" },
      { country_code: "XX1", term: "bad", rank: 1, kind: "top" },
      { country_code: "DE", term: "too low", rank: 40, kind: "top" },
    ]);
    expect(trackedCountries).toEqual(["FR", "US"]);
    const fr = items.find((i) => i.country === "FR");
    expect(fr).toMatchObject({ key: "gta 6", rank: 1 });
    expect(items).toHaveLength(2);
  });

  it("detects schema changes", () => {
    const all = Object.entries(REQUIRED_COLUMNS).flatMap(([t, cols]) => cols.map((c) => ({ table_name: t, column_name: c, data_type: "STRING" })));
    expect(missingColumns(all)).toEqual([]);
    expect(missingColumns(all.filter((r) => !(r.table_name === "top_terms" && r.column_name === "rank")))).toEqual(["top_terms.rank"]);
  });

  it("filters partitions to the last 7 days and the top 25", () => {
    const q = trendsQuery();
    expect(q).toContain("INTERVAL 7 DAY");
    expect(q).toContain("rank <= 25");
    expect(q.match(/UNION ALL/g)).toHaveLength(3);
  });
});

describe("collectSignals", () => {
  it("keeps going when one source fails", async () => {
    vi.stubEnv("WIKIMEDIA_CONTACT", "contact page");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("bsky")) throw new Error("network down");
        if (url.includes("algolia")) return jsonResponse({ hits: [{ title: "Hello", points: 3 }] });
        return jsonResponse({ items: [{ articles: [{ article: "Black_Friday", views: 10, rank: 1 }] }] });
      }),
    );
    const res = await collectSignals({ day: "2026-11-22", only: ["wikipedia", "bluesky", "hackernews"] });
    expect(res.map((r) => [r.source, r.ok])).toEqual([
      ["wikipedia", true],
      ["bluesky", false],
      ["hackernews", true],
    ]);
  });
});

describe("buildCandidates", () => {
  const results: SourceResult[] = [
    {
      source: "google",
      ok: true,
      ms: 1,
      items: [
        { source: "google", raw: "gta 6 trailer", key: "gta 6 trailer", country: "US", rank: 1, value: null },
        { source: "google", raw: "gta 6", key: "gta 6", country: "FR", rank: 2, value: null },
      ],
    },
    { source: "wikipedia", ok: true, ms: 1, items: [{ source: "wikipedia", raw: "Grand Theft Auto VI", key: "gta 6", country: null, rank: 1, value: 1000, meta: {} }] },
    { source: "bluesky", ok: false, ms: 1, items: [], error: "down" },
  ];
  it("merges sources and counts countries for a topic", () => {
    const [first] = buildCandidates(results);
    expect(first.key).toBe("gta 6");
    expect(first.sources).toEqual(["google", "wikipedia"]);
    expect(first.googleCountries).toBe(2);
    expect(first.googleBestRank).toBe(1);
  });
});
