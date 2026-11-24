import { describe, expect, it } from "vitest";
import type { Candidate } from "@/lib/sources";
import type { TrendRow } from "@/lib/supabase/database.types";
import { alignWithKnown, heatJumped, refreshReason, splitCandidates, stillAllowed, trendFromRow, type KnownTrend } from "./incremental";

const DAY = "2026-11-23";
const NOW = new Date("2026-11-23T06:30:00+01:00");

const cand = (key: string): Candidate => ({
  key,
  label: key,
  sources: ["wikipedia"],
  googleCountries: 0,
  googleBestRank: null,
  wikiViews: 0,
  hnPoints: 0,
  blueskyRank: null,
  score: 1,
});

const known = (over: Partial<KnownTrend> & Pick<KnownTrend, "topic_key">): KnownTrend => ({
  id: over.topic_key,
  slug: over.topic_key.replace(/ /g, "-"),
  topic: over.topic_key,
  title: over.topic_key,
  signal_key: null,
  last_seen: "2026-11-22",
  expires_at: "2026-11-26T00:00:00Z",
  analyzed_at: "2026-11-22T06:40:00Z",
  hidden: false,
  ...over,
});

describe("refreshReason", () => {
  it("keeps an analysis younger than 3 days that has not expired", () => {
    expect(refreshReason(known({ topic_key: "a" }), DAY, NOW)).toBeNull();
  });
  it("refreshes an analysis of 3 days or more", () => {
    expect(refreshReason(known({ topic_key: "a", analyzed_at: "2026-11-20T06:40:00Z" }), DAY, NOW)).toBe("stale");
    expect(refreshReason(known({ topic_key: "a", analyzed_at: "2026-11-21T06:40:00Z" }), DAY, NOW)).toBeNull();
  });
  it("refreshes an expired trend and one never analyzed", () => {
    expect(refreshReason(known({ topic_key: "a", expires_at: "2026-11-23T00:00:00Z" }), DAY, NOW)).toBe("expired");
    // Expire aujourd'hui à 09:00, après l'analyse de 06:30 : sa prévision passe sous 40, on la refait
    expect(refreshReason(known({ topic_key: "a", expires_at: "2026-11-23T08:00:00Z" }), DAY, NOW)).toBe("expired");
    expect(refreshReason(known({ topic_key: "a", expires_at: "2026-11-24T08:00:00Z" }), DAY, NOW)).toBeNull();
    expect(refreshReason(known({ topic_key: "a", analyzed_at: null }), DAY, NOW)).toBe("never_analyzed");
  });
});

describe("splitCandidates", () => {
  it("sends only new topics and trends to refresh to the analysis", () => {
    const list = [
      known({ topic_key: "gta 6" }),
      known({ topic_key: "black friday", analyzed_at: "2026-11-19T06:40:00Z" }),
    ];
    const out = splitCandidates(DAY, NOW, [cand("gta 6 trailer"), cand("black friday deals"), cand("new phone")], list);
    expect(out.keep.map((k) => k.topic_key)).toEqual(["gta 6"]);
    expect(out.refresh.map((r) => [r.trend.topic_key, r.candidate.key])).toEqual([["black friday", "black friday deals"]]);
    expect(out.fresh.map((c) => c.key)).toEqual(["new phone"]);
  });
  it("matches a known trend by its signal key too", () => {
    const out = splitCandidates(DAY, NOW, [cand("rockstar trailer")], [known({ topic_key: "gta 6", signal_key: "rockstar trailer" })]);
    expect(out.keep).toHaveLength(1);
    expect(out.fresh).toHaveLength(0);
  });
  it("does not treat a second candidate of the same topic as new", () => {
    const out = splitCandidates(DAY, NOW, [cand("gta 6"), cand("gta 6 trailer")], [known({ topic_key: "gta 6" })]);
    expect(out.keep).toHaveLength(1);
    expect(out.fresh).toHaveLength(0);
  });
  it("never analyzes a hidden trend", () => {
    const out = splitCandidates(DAY, NOW, [cand("gta 6")], [known({ topic_key: "gta 6", hidden: true })]);
    expect(out).toMatchObject({ fresh: [], keep: [], refresh: [], hidden: 1 });
  });
  it("treats a trend not seen for more than 2 days as a new topic", () => {
    const out = splitCandidates(DAY, NOW, [cand("gta 6")], [known({ topic_key: "gta 6", last_seen: "2026-11-20" })]);
    expect(out.fresh.map((c) => c.key)).toEqual(["gta 6"]);
  });
  it("needs no analysis at all on a day without anything new", () => {
    const out = splitCandidates(DAY, NOW, [cand("gta 6")], [known({ topic_key: "gta 6" })]);
    expect(out.fresh.length + out.refresh.length).toBe(0);
  });
});

describe("heatJumped", () => {
  it("is true from +25° vs yesterday", () => {
    expect(heatJumped(80, 55)).toBe(true);
    expect(heatJumped(79, 55)).toBe(false);
    expect(heatJumped(90, null)).toBe(false);
  });
});

const row = (over: Partial<TrendRow> = {}): TrendRow => ({
  id: "1",
  slug: "gta-6",
  topic: "GTA 6",
  topic_key: "gta 6",
  signal_key: "gta 6 trailer",
  title: "gta 6",
  category: "gaming",
  why: "A new trailer is out.",
  lifespan: "3-7 days",
  brand_safe: true,
  risk: null,
  audiences: [{ label: "gamers", share: 100 }],
  angles: [{ tag: "launch", title: "Ship day", example: "We shipped while everyone watched the trailer.", fits: "X" }],
  image_query: "gaming night controller",
  sources: [{ title: "a", url: "https://example.com" }],
  first_seen: "2026-11-21",
  last_seen: "2026-11-22",
  expires_at: "2026-11-26T00:00:00Z",
  hidden: false,
  hidden_at: null,
  peak_heat: 80,
  peak_day: "2026-11-22",
  analyzed_at: "2026-11-22T06:40:00Z",
  created_at: "2026-11-21T06:40:00Z",
  updated_at: "2026-11-22T06:40:00Z",
  ...over,
});

describe("kept trends", () => {
  it("rebuilds the stored analysis", () => {
    const t = trendFromRow(row());
    expect(t).toMatchObject({ topic_key: "gta 6", signal_key: "gta 6 trailer", slug: "gta-6", lifespan: "3-7 days", notes: [] });
    expect(t.angles[0].title).toBe("Ship day");
  });
  it("re-checks the blocklist", () => {
    expect(stillAllowed(trendFromRow(row()))).toBe(true);
    expect(stillAllowed(trendFromRow(row({ why: "An attack on the studio." })))).toBe(false);
  });
});

describe("alignWithKnown", () => {
  it("reuses the known topic key and slug for the same topic", () => {
    const fresh = { ...trendFromRow(row()), topic_key: "gta 6 trailer", slug: "gta-6-trailer", signal_key: "x" };
    expect(alignWithKnown(fresh, [known({ topic_key: "gta 6" })])).toMatchObject({ topic_key: "gta 6", slug: "gta-6" });
  });
  it("leaves a new topic untouched", () => {
    const fresh = { ...trendFromRow(row()), topic_key: "new phone", slug: "new-phone", signal_key: "new phone" };
    expect(alignWithKnown(fresh, [known({ topic_key: "gta 6" })])).toMatchObject({ topic_key: "new phone", slug: "new-phone" });
  });
});
