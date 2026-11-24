import { describe, expect, it } from "vitest";
import {
  computeCountryHeat,
  computeHeat,
  computeOutlook,
  expiresAt,
  growthFactor,
  heatLevel,
  heatwaveDays,
  projection,
  rankByHeat,
  rankMove,
  weeklyAverage,
  MAX_LIFETIME_DAYS,
} from "./index";

const ranks = (n: number, rank = 1) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`C${i}`, rank]));

describe("heat", () => {
  it("stays within 0–100", () => {
    const max = computeHeat({ trackedCountries: 10, countryRanks: ranks(10), prevSpread: null, sourceCount: 4 });
    expect(max.heat).toBe(100);
    const min = computeHeat({ trackedCountries: 50, countryRanks: {}, prevSpread: 0.9, sourceCount: 0 });
    expect(min.heat).toBe(0);
    const weird = computeHeat({ trackedCountries: 0, countryRanks: { A: 999 }, prevSpread: null, sourceCount: 99 });
    expect(weird.heat).toBeGreaterThanOrEqual(0);
    expect(weird.heat).toBeLessThanOrEqual(100);
  });

  it("is monotonic: more countries means hotter", () => {
    let last = -1;
    for (let n = 0; n <= 50; n += 5) {
      const { heat } = computeHeat({ trackedCountries: 50, countryRanks: ranks(n, 5), prevSpread: 0.1, sourceCount: 2 });
      expect(heat).toBeGreaterThanOrEqual(last);
      last = heat;
    }
  });

  it("gives a new topic full momentum", () => {
    const fresh = computeHeat({ trackedCountries: 50, countryRanks: ranks(5), prevSpread: null, sourceCount: 2 });
    expect(fresh.components.momentum).toBe(1);
    const flat = computeHeat({ trackedCountries: 50, countryRanks: ranks(5), prevSpread: 0.1, sourceCount: 2 });
    expect(flat.components.momentum).toBe(0.5);
    expect(fresh.heat).toBeGreaterThan(flat.heat);
  });

  it("follows the documented weights", () => {
    // spread 0.5, strength 1, sources 0.5, momentum 0.5 → 100 × (0.175 + 0.25 + 0.1 + 0.1) = 62.5 → 63
    const { heat } = computeHeat({ trackedCountries: 10, countryRanks: ranks(5, 1), prevSpread: 0.5, sourceCount: 2 });
    expect(heat).toBe(63);
  });

  it("maps levels at the documented thresholds", () => {
    expect([0, 39, 40, 59, 60, 74, 75, 89, 90, 100].map(heatLevel)).toEqual([
      "cold", "cold", "mild", "mild", "warm", "warm", "hot", "hot", "scorching", "scorching",
    ]);
  });
});

describe("country heat", () => {
  it("rewards rank and progression", () => {
    expect(computeCountryHeat(1, null)).toBe(100);
    expect(computeCountryHeat(1, 1)).toBe(80);
    expect(computeCountryHeat(25, 25)).toBeLessThan(computeCountryHeat(5, 25));
    expect(computeCountryHeat(10, 2)).toBeLessThan(computeCountryHeat(10, 10));
  });
});

describe("ranks", () => {
  it("ranks by heat with stable tie-breaks", () => {
    const out = rankByHeat([
      { key: "b", heat: 50, sourceCount: 1 },
      { key: "a", heat: 80 },
      { key: "c", heat: 50, sourceCount: 3 },
    ]);
    expect(out.map((o) => [o.key, o.rank])).toEqual([["a", 1], ["c", 2], ["b", 3]]);
  });
  it("describes rank moves", () => {
    expect(rankMove(1, null)).toEqual({ kind: "new" });
    expect(rankMove(1, 3)).toEqual({ kind: "up", by: 2 });
    expect(rankMove(4, 2)).toEqual({ kind: "down", by: 2 });
    expect(rankMove(2, 2)).toEqual({ kind: "same" });
  });
  it("averages a week with missing days as 0", () => {
    const days = ["d1", "d2", "d3", "d4", "d5", "d6", "d7"];
    expect(weeklyAverage({ d6: 70, d7: 70 }, days)).toBe(20);
  });
});

describe("heatwave", () => {
  it("needs two days at 90 or more", () => {
    expect(heatwaveDays([80, 95])).toBe(0);
    expect(heatwaveDays([90, 92])).toBe(2);
    expect(heatwaveDays([91, 99, 88, 90, 93, 97])).toBe(3);
    expect(heatwaveDays([])).toBe(0);
  });
});

describe("forecast", () => {
  it("peaks tomorrow after two rising days, then decays", () => {
    const input = { h0: 80, hPrev: 70, hPrev2: 60, lifespan: "3-7 days" as const };
    const o = computeOutlook(input);
    expect(o.peakTomorrow).toBe(true);
    expect(o.forecast[0]).toBe(80);
    expect(o.forecast[1]).toBe(85); // 80 + (80 − 70) / 2
    expect(o.forecast[2]).toBeLessThan(o.forecast[1]);
    expect(o.forecast[4]).toBeLessThan(o.forecast[3]);
    expect(o.curveTitle).toBe("peak tomorrow, then it cools");
  });

  it("decays from today when not rising", () => {
    const o = computeOutlook({ h0: 80, hPrev: 85, hPrev2: 70, lifespan: "3-7 days" });
    expect(o.peakTomorrow).toBe(false);
    expect(o.forecast[3]).toBe(40); // 80 × 0.5^(3/3)
    expect(o.curveTitle).toBe("past its peak");
  });

  it("cools faster with a short lifespan", () => {
    const base = { h0: 90, hPrev: 90, hPrev2: 90 };
    const short = computeOutlook({ ...base, lifespan: "1-2 days" });
    const long = computeOutlook({ ...base, lifespan: "2+ weeks" });
    expect(short.coolsInDays!).toBeLessThan(long.coolsInDays ?? 99);
    expect(short.expiresInDays).toBeLessThan(long.expiresInDays);
    expect(long.curveTitle).toBe("holding steady");
  });

  it("chooses at most two best days, else today", () => {
    const hot = computeOutlook({ h0: 95, hPrev: 90, hPrev2: 80, lifespan: "2+ weeks" });
    expect(hot.bestWindow.length).toBeLessThanOrEqual(2);
    expect(hot.bestWindow.every((i) => hot.forecast[i] >= 75)).toBe(true);
    const cold = computeOutlook({ h0: 50, hPrev: null, hPrev2: null, lifespan: "3-7 days" });
    expect(cold.bestWindow).toEqual([]);
    expect(cold.coolsInDays).toBe(0);
    expect(cold.curveTitle).toBe("just heating up");
  });

  it("never lives more than 14 days", () => {
    const o = computeOutlook({ h0: 100, hPrev: 99, hPrev2: 98, lifespan: "2+ weeks" });
    expect(o.expiresInDays).toBeLessThanOrEqual(MAX_LIFETIME_DAYS);
    expect(expiresAt("2026-11-22", 99)).toBe("2026-12-06T08:00:00.000Z");
  });

  it("expires at 09:00 Paris, never before the next morning's analysis", () => {
    // 30° sans Google : la prévision passe sous 40 dès J+1
    const cold = computeOutlook({ h0: 30, hPrev: null, hPrev2: null, lifespan: "2+ weeks" });
    expect(cold.expiresInDays).toBe(1);
    expect(expiresAt("2026-11-23", cold.expiresInDays)).toBe("2026-11-24T08:00:00.000Z");
    expect(expiresAt("2026-11-22", 0)).toBe("2026-11-23T08:00:00.000Z");
    // Heure d'été : Paris = UTC+2
    expect(expiresAt("2026-07-01", 2)).toBe("2026-07-03T07:00:00.000Z");
    expect(projection({ h0: 100, hPrev: 99, hPrev2: 98, lifespan: "2+ weeks" }, 14)).toBeLessThan(100);
  });
});

describe("signal factors", () => {
  it("compares today with the 7-day average", () => {
    expect(growthFactor(62, [10, 10, 10, 10, 10, 10, 10])).toBe(6.2);
    expect(growthFactor(5, [])).toBeNull();
    expect(growthFactor(5, [0, 0])).toBeNull();
  });
});
