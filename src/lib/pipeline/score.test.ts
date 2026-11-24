import { describe, expect, it } from "vitest";
import { refreshOutlook, scoreDay } from "./score";
import type { CheckedTrend } from "@/lib/ai/checks";
import type { SourceResult } from "@/lib/sources";

const trend = (topic: string, key: string, brand_safe = true): CheckedTrend => ({
  topic,
  topic_key: key,
  signal_key: key,
  slug: key.replace(/ /g, "-"),
  title: topic.toLowerCase(),
  category: "gaming",
  why: "why",
  lifespan: "3-7 days",
  brand_safe,
  risk: brand_safe ? null : "careful",
  audiences: [],
  angles: [],
  image_query: "a b",
  sources: [],
  notes: [],
});

const g = (country: string, key: string, rank: number) => ({ source: "google" as const, raw: key, key, country, rank, value: null });

const results: SourceResult[] = [
  {
    source: "google",
    ok: true,
    ms: 1,
    trackedCountries: ["US", "FR", "DE", "JP"],
    items: [g("US", "gta 6", 1), g("FR", "gta 6 trailer", 2), g("DE", "gta 6", 3), g("US", "black friday", 2), g("FR", "black friday", 1), g("JP", "anime thing", 1)],
  },
  { source: "wikipedia", ok: true, ms: 1, items: [{ source: "wikipedia", raw: "x", key: "gta 6", country: null, rank: 1, value: 10 }] },
];

describe("scoreDay", () => {
  it("publishes confirmed trends ranked by heat, with one brand-safe top", () => {
    const out = scoreDay({
      accepted: [trend("Black Friday", "black friday", false), trend("GTA VI", "gta 6"), trend("Unseen", "unseen topic")],
      results,
      prev: new Map(),
      yesterdayGoogle: [],
    });
    expect(out.unconfirmed.map((u) => u.topic)).toEqual(["Unseen"]);
    expect(out.published.map((p) => p.trend.topic)).toEqual(["GTA VI", "Black Friday"]);
    expect(out.published[0]).toMatchObject({ rank: 1, isTop: true, sourceCount: 2, isNew: true, heatChange: 0 });
    expect(out.published[1].isTop).toBe(false);
    expect(out.published[0].countries.map((c) => c.code)).toEqual(["US", "FR", "DE"]);
    expect(out.published[0].top3Countries).toBe(3);
  });

  it("ranks trends inside each country", () => {
    const out = scoreDay({ accepted: [trend("GTA VI", "gta 6"), trend("Black Friday", "black friday")], results, prev: new Map(), yesterdayGoogle: [] });
    const fr = out.published.map((p) => p.countries.find((c) => c.code === "FR"));
    expect(fr.map((c) => c?.rank).sort()).toEqual([1, 2]);
  });

  it("uses yesterday's state for momentum and heat change", () => {
    const prev = new Map([["gta 6", { prevSpread: 0.75, hPrev: 90, hPrev2: 80 }]]);
    const out = scoreDay({ accepted: [trend("GTA VI", "gta 6")], results, prev, yesterdayGoogle: [g("US", "gta 6", 1)] });
    const p = out.published[0];
    expect(p.isNew).toBe(false);
    expect(p.components.momentum).toBe(0.5);
    expect(p.heatChange).toBe(p.heat - 90);
    expect(p.countries.find((c) => c.code === "US")!.heat).toBe(80);
  });

  it("publishes 10 trends at most", () => {
    const many = Array.from({ length: 14 }, (_, i) => trend(`T${i}`, `topic ${i}`));
    const r: SourceResult[] = [{ source: "wikipedia", ok: true, ms: 1, items: many.map((t) => ({ source: "wikipedia" as const, raw: t.topic, key: t.topic_key, country: null, rank: 1, value: 1 })) }];
    expect(scoreDay({ accepted: many, results: r, prev: new Map(), yesterdayGoogle: [] }).published).toHaveLength(10);
  });
});

describe("refreshOutlook", () => {
  it("moves the forecast, expiry and peak with the hourly heat", () => {
    const r = refreshOutlook({ day: "2026-11-24", heat: 35, hPrev: 30, hPrev2: null, lifespan: "3-7 days", peakHeat: 30 });
    expect(r.forecast[0]).toBe(35);
    expect(r.forecast).toHaveLength(5);
    expect(r.expires_at).toBe("2026-11-25T08:00:00.000Z");
    expect(r.peak).toEqual({ peak_heat: 35, peak_day: "2026-11-24" });
  });
  it("keeps the peak when the heat stays below it", () => {
    expect(refreshOutlook({ day: "2026-11-24", heat: 25, hPrev: 30, hPrev2: null, lifespan: "3-7 days", peakHeat: 30 }).peak).toBeNull();
  });
});
