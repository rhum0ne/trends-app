import { describe, expect, it, vi, beforeEach } from "vitest";
import { EXAMPLE_TRENDS } from "@/lib/examples";
import type { TrendView } from "@/lib/types";
import { listBody, topBody, trendBody, countriesBody } from "./endpoints";
import { validateTrendsQuery, validateDay, canListCountries } from "./access";
import { hourWindow, MemoryLimiter, secondsUntilNextUtcDay } from "./ratelimit";
import { bearerKey, generateApiKey, hashApiKey } from "./keys";
import { toPublicTrend, finalizeDay } from "@/lib/trends/view";
import { entitlements } from "@/lib/plans";

vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("@/lib/supabase/server", () => ({
  hasDb: () => true,
  db: () => {
    throw new Error("db should not be called for anonymous requests");
  },
}));

const IMAGE = {
  url: "https://x.supabase.co/storage/v1/object/public/trend-images/a.jpg",
  width: 1880,
  height: 1253,
  alt: "Alt",
  avg_color: "#112233",
  credit: { name: "Someone", url: "https://www.pexels.com/@someone" },
  source_url: "https://www.pexels.com/photo/1/",
};

const views: TrendView[] = finalizeDay(
  EXAMPLE_TRENDS.map((t, i) => ({
    ...t,
    id: `id-${i}`,
    rank: i + 1,
    image: i === 0 ? IMAGE : null,
    angles: [
      { tag: "a", title: "A", example: "Example A", fits: "X" },
      { tag: "b", title: "B", example: "Example B", fits: "X" },
      { tag: "c", title: "C", example: "Example C", fits: "X" },
    ],
  })),
);
const day = views[0].day;

// Champs du contrat v1 (CLAUDE.md § 7) : les champs du § 6 sauf image_query, plus les champs calculés
const CONTRACT_KEYS = [
  "topic", "slug", "title", "category", "why", "lifespan", "brand_safe", "risk", "audiences", "angles", "sources",
  "heat", "heat_level", "heat_change", "rank", "forecast", "countries", "first_seen", "last_seen", "expires_at", "is_top", "image",
  "day",
].sort();

describe("trend contract", () => {
  it("has exactly the v1 fields (powered_by only on free plans)", () => {
    expect(Object.keys(toPublicTrend(views[0], "pro")).sort()).toEqual(CONTRACT_KEYS);
    expect(Object.keys(toPublicTrend(views[0], "free")).sort()).toEqual([...CONTRACT_KEYS, "powered_by"].sort());
    expect(toPublicTrend(views[0], "anonymous").powered_by).toEqual({ name: "upTake", url: "https://uptake.me/?ut=trends" });
  });

  it("never leaks internal data", () => {
    const json = JSON.stringify(toPublicTrend(views[0], "internal"));
    for (const k of ["image_query", "components", "factors", "signal", "history", "prev_rank", "notes"]) expect(json).not.toContain(`"${k}"`);
  });

  it("serves image as an object or null", () => {
    const withImage = toPublicTrend(views[0], "pro").image;
    expect(withImage).toEqual(IMAGE);
    expect(withImage && Object.keys(withImage).sort()).toEqual(["alt", "avg_color", "credit", "height", "source_url", "url", "width"]);
    expect(toPublicTrend(views[1], "pro").image).toBeNull();
  });

  it("limits angles by plan", () => {
    expect(toPublicTrend(views[0], "anonymous").angles).toHaveLength(0);
    expect(toPublicTrend(views[0], "free").angles).toHaveLength(1);
    expect(toPublicTrend(views[0], "starter").angles).toHaveLength(3);
    expect(toPublicTrend(views[0], "internal").angles).toHaveLength(3);
  });

  it("keeps heat values in range with a 5-day forecast", () => {
    for (const v of views) {
      const t = toPublicTrend(v, "pro");
      expect(t.heat).toBeGreaterThanOrEqual(0);
      expect(t.heat).toBeLessThanOrEqual(100);
      expect(t.forecast).toHaveLength(5);
    }
  });
});

describe("list endpoint", () => {
  it("serves only the trend of the day without a key", () => {
    const body = listBody("anonymous", { day, trends: views }, {});
    expect(body.trends).toHaveLength(1);
    expect(body.trends[0].is_top).toBe(true);
    expect(body.powered_by).toBeDefined();
  });
  it("serves up to 10 with a free key, everything for internal", () => {
    expect(listBody("free", { day, trends: views }, {}).trends).toHaveLength(views.length);
    const internal = listBody("internal", { day, trends: views }, {});
    expect(internal.trends).toHaveLength(views.length);
    expect("powered_by" in internal).toBe(false);
  });
  it("orders by heat", () => {
    const heats = listBody("pro", { day, trends: views }, {}).trends.map((t) => t.heat);
    expect([...heats].sort((a, b) => b - a)).toEqual(heats);
  });
});

describe("access rules", () => {
  it("refuses country filters and history without a key", () => {
    expect(validateTrendsQuery({ country: "FR" }, "anonymous", day)).toMatchObject({ status: 403 });
    expect(validateTrendsQuery({ day: "2026-11-21" }, "anonymous", day)).toMatchObject({ status: 403, code: "history_not_included" });
    expect(validateTrendsQuery({ day }, "anonymous", day)).toBeNull();
  });
  it("allows 7 days and one country with a free key", () => {
    expect(validateTrendsQuery({ country: "FR", day: "2026-11-15" }, "free", day)).toBeNull();
    expect(validateDay("2026-11-14", "free", day)).toMatchObject({ status: 403 });
    expect(validateTrendsQuery({ category: "gaming" }, "free", day)).toMatchObject({ status: 403 });
    expect(validateTrendsQuery({ category: "gaming" }, "starter", day)).toBeNull();
  });
  it("validates formats", () => {
    expect(validateTrendsQuery({ day: "22-11-2026" }, "pro", day)).toMatchObject({ status: 400 });
    expect(validateTrendsQuery({ country: "FRA" }, "pro", day)).toMatchObject({ status: 400 });
    expect(validateTrendsQuery({ category: "politics" }, "pro", day)).toMatchObject({ status: 400 });
    expect(validateTrendsQuery({ day: "2099-01-01" }, "pro", day)).toMatchObject({ status: 404 });
  });
  it("reserves the country list to full plans", () => {
    expect(canListCountries("anonymous")).toBe(false);
    expect(canListCountries("free")).toBe(false);
    expect(canListCountries("internal")).toBe(true);
    const body = countriesBody("internal", { day, countries: [{ code: "FR", name: "France", heat: 0, heat_level: null, trend: null }] });
    expect(body.countries[0]).toEqual({ code: "FR", name: "France", heat: null, heat_level: null, trend: null });
  });
});

describe("single trend endpoint", () => {
  const full = (v: TrendView) => ({ ...v, full_history: v.history.map((h, i) => ({ ...h, rank: i + 1 })) });
  it("serves only the top trend without a key", () => {
    expect(trendBody("anonymous", full(views[1]), day)).toMatchObject({ status: 403 });
    const ok = trendBody("anonymous", full(views[0]), day) as { trend: { history: unknown[]; forecast: number[] } };
    expect(ok.trend.history).toHaveLength(1);
    expect(ok.trend.forecast).toHaveLength(5);
  });
  it("limits history by plan and 404s unknown trends", () => {
    const ok = trendBody("internal", full(views[0]), day) as { trend: { history: unknown[] } };
    expect(ok.trend.history).toHaveLength(7);
    expect(trendBody("pro", null, day)).toMatchObject({ status: 404 });
  });
  it("top endpoint returns a trend or null", () => {
    expect(topBody("anonymous", { day, trend: null }).trend).toBeNull();
    expect(topBody("pro", { day, trend: views[0] }, "fr").country).toBe("FR");
  });
});

describe("keys", () => {
  it("generates tk_ keys stored as SHA-256 only", () => {
    const k = generateApiKey();
    expect(k.key.startsWith("tk_")).toBe(true);
    expect(k.hash).toBe(hashApiKey(k.key));
    expect(k.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(k.hash).not.toContain(k.key);
  });
  it("parses bearer headers", () => {
    expect(bearerKey(null)).toBeNull();
    expect(bearerKey("Basic abc")).toBe("invalid");
    expect(bearerKey("Bearer tk_short")).toBe("invalid");
    expect(bearerKey("Bearer tk_abcdefghijklmnopqrstuvwxyz")).toBe("tk_abcdefghijklmnopqrstuvwxyz");
  });
});

describe("rate limits", () => {
  it("blocks the 31st anonymous request of the day", () => {
    const lim = new MemoryLimiter("salt");
    const now = new Date("2026-11-22T10:00:00Z");
    let last;
    for (let i = 0; i < 31; i++) last = lim.hit("1.2.3.4", 30, now);
    expect(last!.allowed).toBe(false);
    expect(lim.hit("5.6.7.8", 30, now).allowed).toBe(true);
    expect(lim.hit("1.2.3.4", 30, new Date("2026-11-23T00:00:01Z")).allowed).toBe(true);
    expect(secondsUntilNextUtcDay(now)).toBe(14 * 3600);
  });
  it("resets an hourly window on the next UTC hour", () => {
    const lim = new MemoryLimiter("salt");
    const t1 = new Date("2026-11-22T10:59:00Z");
    for (let i = 0; i < 5; i++) expect(lim.hit("1.2.3.4", 5, t1, hourWindow(t1)).allowed).toBe(true);
    expect(lim.hit("1.2.3.4", 5, t1, hourWindow(t1)).allowed).toBe(false);
    const t2 = new Date("2026-11-22T11:00:01Z");
    expect(hourWindow(t2)).toBe("2026-11-22T11");
    expect(lim.hit("1.2.3.4", 5, t2, hourWindow(t2)).allowed).toBe(true);
  });
  it("matches the documented limits", () => {
    expect(entitlements("anonymous").requests).toEqual({ limit: 30, per: "day" });
    expect(entitlements("free").requests).toEqual({ limit: 1000, per: "month" });
    expect(entitlements("starter").requests).toEqual({ limit: 20000, per: "month" });
    expect(entitlements("pro").requests).toEqual({ limit: 100000, per: "month" });
    expect(entitlements("internal").requests).toBeNull();
  });
});

describe("handleApi", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  it("answers 429 with Retry-After once the anonymous quota is used", async () => {
    const { handleApi } = await import("./handler");
    const req = () => new Request("https://trends.uptake.me/api/v1/trends", { headers: { "x-forwarded-for": "9.9.9.9" } });
    let res: Response | undefined;
    for (let i = 0; i < 30; i++) res = await handleApi(req(), async () => ({ ok: true }));
    expect(res!.status).toBe(200);
    expect(res!.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res!.headers.get("Cache-Control")).toContain("max-age=600");
    res = await handleApi(req(), async () => ({ ok: true }));
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(await res.json()).toEqual({ error: { code: "rate_limited", message: "Too many requests for your plan" } });
  });
  it("rejects malformed keys and hides internal errors", async () => {
    const { handleApi } = await import("./handler");
    const bad = await handleApi(new Request("https://x/api", { headers: { authorization: "Bearer nope" } }), async () => ({}));
    expect(bad.status).toBe(401);
    const boom = await handleApi(new Request("https://x/api", { headers: { "x-forwarded-for": "8.8.8.8" } }), async () => {
      throw new Error("postgres: connection refused at 10.0.0.1");
    });
    expect(boom.status).toBe(500);
    expect(JSON.stringify(await boom.json())).not.toContain("postgres");
  });
});
