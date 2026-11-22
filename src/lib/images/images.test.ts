import { afterEach, describe, expect, it, vi } from "vitest";
import { checkImageQuery, CATEGORY_IMAGE_QUERY } from "./queries";
import { pickPhoto, searchPexels, searchUrl, type PexelsPhoto } from "./pexels";
import { findBlockedWord, isBlocked } from "@/lib/blocklist";

const photo = (id: number, width = 2000, height = 1300): PexelsPhoto => ({
  id,
  width,
  height,
  url: `https://www.pexels.com/photo/${id}/`,
  photographer: "Someone",
  photographer_url: "https://www.pexels.com/@someone",
  avg_color: "#334455",
  alt: "A photo",
  src: { original: "o", large2x: `https://images.pexels.com/${id}.jpeg`, large: "l", medium: "m" },
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("checkImageQuery", () => {
  it("accepts a generic scene", () => {
    expect(checkImageQuery("gaming night controller neon", "GTA VI", "gaming")).toEqual({ ok: true, query: "gaming night controller neon" });
  });
  it("rejects topic words, proper nouns, blocked words and bad lengths", () => {
    expect(checkImageQuery("gta night", "GTA VI", "gaming")).toMatchObject({ ok: false, query: CATEGORY_IMAGE_QUERY.gaming });
    expect(checkImageQuery("shopping in Paris", "Black Friday", "business").reason).toBe("proper noun");
    expect(checkImageQuery("war zone street", "Something", "other").reason).toBe("blocked word");
    expect(checkImageQuery("neon", "X", "tech").reason).toBe("word count");
    expect(checkImageQuery("one two three four five six", "X", "tech").reason).toBe("word count");
    expect(checkImageQuery("ps5 controller", "Y", "gaming").reason).toBe("not plain english words");
  });
});

describe("pickPhoto", () => {
  it("skips recently used photos and prefers wide landscapes", () => {
    const photos = [photo(1), photo(2, 1200, 800), photo(3, 2400, 1600)];
    expect(pickPhoto(photos, new Set([1]))?.id).toBe(3);
    expect(pickPhoto([photo(2, 1200, 800)], new Set())?.id).toBe(2);
  });
  it("returns null for an empty or exhausted list", () => {
    expect(pickPhoto([], new Set())).toBeNull();
    expect(pickPhoto([photo(1)], new Set([1]))).toBeNull();
  });
});

describe("searchPexels", () => {
  it("does nothing without a key", async () => {
    vi.stubEnv("PEXELS_API_KEY", "");
    const fetchMock = vi.fn();
    expect(await searchPexels("city", fetchMock as never)).toEqual({ ok: false, reason: "no_key" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("sends the key and the documented parameters", async () => {
    vi.stubEnv("PEXELS_API_KEY", "test-key");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ photos: [photo(7)] }), { status: 200 }));
    const res = await searchPexels("city lights", fetchMock as never);
    expect(res).toMatchObject({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(searchUrl("city lights"));
    expect(url).toContain("orientation=landscape");
    expect(url).toContain("per_page=15");
    expect(url).toContain("size=large");
    expect((init.headers as Record<string, string>).Authorization).toBe("test-key");
  });
  it("reports 429 and errors without throwing", async () => {
    vi.stubEnv("PEXELS_API_KEY", "test-key");
    expect(await searchPexels("x y", (async () => new Response("", { status: 429 })) as never)).toEqual({ ok: false, reason: "rate_limited", status: 429 });
    expect(await searchPexels("x y", (async () => new Response("", { status: 500 })) as never)).toMatchObject({ ok: false, reason: "error" });
    expect(await searchPexels("x y", (async () => { throw Object.assign(new Error("t"), { name: "AbortError" }); }) as never)).toEqual({ ok: false, reason: "timeout" });
  });
});

describe("blocklist", () => {
  it("blocks whole words and phrases, not substrings", () => {
    expect(findBlockedWord("Earthquake in the region")).toBe("earthquake");
    expect(isBlocked("Star Wars Day")).toBe(false);
    expect(isBlocked("Shooting stars meteor shower")).toBe(true);
    expect(findBlockedWord("Plane crash today")).toBe("crash");
    expect(isBlocked("Black Friday deals")).toBe(false);
    expect(isBlocked(null, undefined, "")).toBe(false);
  });
});
