import { describe, expect, it } from "vitest";
import { angleIsAllowed, checkTrend, clip, extractNumbers, normalizeAudiences, stripUnverifiedSentences, allowedNumbers, verifySources } from "./checks";
import { estimateCost } from "./pricing";
import { extractResearch } from "./generate";
import type { TrendAnalysis } from "./schema";

const base: TrendAnalysis = {
  signal_key: "gta 6",
  sensitive: false,
  topic: "GTA VI",
  slug: "gta-vi",
  title: "GTA VI",
  category: "gaming",
  why: "The new trailer dropped and every gaming channel is reacting.",
  lifespan: "3-7 days",
  brand_safe: true,
  risk: null,
  audiences: [
    { label: "Gamers", share: 60 },
    { label: "Streamers", share: 30 },
  ],
  angles: [
    { tag: "Countdown", title: "Share your own countdown", example: "Everyone is counting down this week. Here is what we shipped while waiting.", fits: "X, LinkedIn" },
    { tag: "Poll", title: "Ask your users", example: "Which launch would make you block an evening?", fits: "X" },
  ],
  image_query: "gaming night controller neon",
  sources: [
    { title: "Trailer", url: "https://news.example.com/gta?utm_source=x" },
    { title: "Reaction", url: "https://press.example.org/reaction/" },
  ],
};

const ctx = {
  searchResults: [
    { url: "https://news.example.com/gta", title: "GTA VI trailer 3 is out" },
    { url: "https://press.example.org/reaction", title: "Reactions to the trailer" },
  ],
  evidenceTexts: ["The trailer reached 90 million views in 24 hours."],
  candidateKeys: ["gta 6", "black friday"],
  collectedTexts: ["gta 6 trailer"],
};

describe("checkTrend", () => {
  it("accepts a clean trend and normalizes it", () => {
    const out = checkTrend(base, ctx);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.trend.title).toBe("gta vi");
    expect(out.trend.slug).toBe("gta-6");
    expect(out.trend.sources).toHaveLength(2);
    expect(out.trend.audiences.reduce((s, a) => s + a.share, 0)).toBe(100);
  });

  it("rejects sensitive or blocked topics", () => {
    expect(checkTrend({ ...base, sensitive: true }, ctx).ok).toBe(false);
    const blocked = checkTrend({ ...base, why: "A plane crash shocked the world." }, ctx);
    expect(blocked).toMatchObject({ ok: false, reason: expect.stringContaining("blocked") });
  });

  it("rejects topics no free source confirmed", () => {
    expect(checkTrend({ ...base, signal_key: "unknown", topic: "Mystery Thing" }, ctx)).toMatchObject({ ok: false, reason: "not confirmed by a free source" });
  });

  it("only keeps sources that the search actually returned", () => {
    const out = checkTrend({ ...base, sources: [...base.sources, { title: "Invented", url: "https://made-up.example/page" }, { title: "ftp", url: "ftp://x.example" }] }, ctx);
    expect(out.ok && out.trend.sources.map((s) => s.url)).toEqual(["https://news.example.com/gta", "https://press.example.org/reaction"]);
    expect(checkTrend({ ...base, sources: [base.sources[0]] }, ctx).ok).toBe(false);
  });

  it("removes sentences and angles with unverified numbers", () => {
    const out = checkTrend(
      {
        ...base,
        why: "The trailer passed 90 million views. Sales could reach 40 million copies.",
        angles: [...base.angles, { tag: "Stat", title: "Quote the 12 million preorders", example: "12 million people preordered.", fits: "X" }],
      },
      ctx,
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.trend.why).toBe("The trailer passed 90 million views.");
    expect(out.trend.angles).toHaveLength(2);
    expect(out.trend.notes.join(" ")).toContain("angle removed");
  });

  it("drops angles that suggest a partnership or a logo", () => {
    expect(angleIsAllowed({ tag: "x", title: "Partner with Rockstar", example: "…", fits: "X" })).toBe(false);
    expect(angleIsAllowed({ tag: "x", title: "Use the official logo", example: "…", fits: "X" })).toBe(false);
    expect(angleIsAllowed(base.angles[0])).toBe(true);
    const out = checkTrend({ ...base, angles: [base.angles[0], { tag: "x", title: "Partner with them", example: "Our partnership.", fits: "X" }] }, ctx);
    expect(out).toMatchObject({ ok: false, reason: "fewer than 2 post angles after checks" });
  });

  it("replaces a bad image query with the category default", () => {
    const out = checkTrend({ ...base, image_query: "GTA VI cover art" }, ctx);
    expect(out.ok && out.trend.image_query).toBe("gaming night controller neon");
  });

  it("enforces lengths", () => {
    const long = "word ".repeat(80);
    const out = checkTrend({ ...base, title: "a very very long trend title that goes on", why: `${long}.` }, ctx);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.trend.title.length).toBeLessThanOrEqual(28);
    expect(out.trend.why.length).toBeLessThanOrEqual(200);
  });

  it("adds a risk sentence when not brand-safe", () => {
    const out = checkTrend({ ...base, brand_safe: false, risk: null }, ctx);
    expect(out.ok && out.trend.risk).toMatch(/Handle with care/);
  });
});

describe("helpers", () => {
  it("extracts numbers with separators", () => {
    expect(extractNumbers("1,000 fans, 6.2 times, 90 million in 2026")).toEqual(["1000", "6.2", "90", "2026"]);
  });
  it("strips only unverified sentences", () => {
    const allowed = allowedNumbers(["90"]);
    expect(stripUnverifiedSentences("It has 90 fans. It has 91 fans. No number here.", allowed)).toBe("It has 90 fans. No number here.");
  });
  it("clips at a sentence or a word", () => {
    expect(clip("One. Two three four five six.", 12)).toBe("One.");
    expect(clip("alpha beta gamma delta", 12).length).toBeLessThanOrEqual(13);
  });
  it("normalizes audiences to 100", () => {
    expect(normalizeAudiences([{ label: "a", share: 1 }, { label: "b", share: 1 }, { label: "c", share: 1 }])!.reduce((s, a) => s + a.share, 0)).toBe(100);
    expect(normalizeAudiences([{ label: "a", share: 100 }])).toBeNull();
  });
  it("verifies sources against search results ignoring tracking params", () => {
    expect(verifySources([{ title: "", url: "https://a.example/x?utm_medium=y#top" }], [{ url: "https://a.example/x", title: "A" }])).toEqual([{ title: "A", url: "https://a.example/x" }]);
  });
});

describe("cost and research extraction", () => {
  it("estimates cost from usage, including web searches", () => {
    expect(estimateCost("claude-opus-5-5", { input_tokens: 1_000_000, output_tokens: 100_000, server_tool_use: { web_search_requests: 8 } })).toBe(6.08);
  });
  it("collects search results and cited passages", () => {
    const r = extractResearch([
      { type: "web_search_tool_result", tool_use_id: "1", content: [{ type: "web_search_result", url: "https://a.example", title: "A", encrypted_content: "", page_age: null }] },
      { type: "text", text: "Notes", citations: [{ type: "web_search_result_location", url: "https://b.example", title: "B", cited_text: "42 things", encrypted_index: "" }] },
    ] as never);
    expect(r.results.map((x) => x.url)).toEqual(["https://a.example", "https://b.example"]);
    expect(r.citedTexts).toEqual(["42 things"]);
    expect(r.text).toBe("Notes");
  });
});
