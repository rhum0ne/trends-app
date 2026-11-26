import { describe, expect, it } from "vitest";
import { DAY_PALETTE, NIGHT_PALETTE, TONE_STEPS, isTone, tableValue, thermalLut, toneCurve, toneKey } from "./thermal";

const fill = (n: number, v: number) => new Array<number>(n).fill(v);

describe("toneCurve", () => {
  it("returns 11 increasing values from 0 to 1", () => {
    const t = toneCurve([...fill(500, 20), ...fill(500, 200)]);
    expect(t).toHaveLength(TONE_STEPS + 1);
    expect(t[0]).toBe(0);
    expect(t[TONE_STEPS]).toBe(1);
    expect(isTone(t)).toBe(true);
  });

  it("lifts a dark photo and darkens a bright one towards the middle of the scale", () => {
    const dark = toneCurve([...fill(900, 15), ...fill(100, 120)]);
    const bright = toneCurve([...fill(100, 120), ...fill(900, 235)]);
    // Une ombre de la photo sombre monte, un ton clair de la photo claire descend
    expect(dark[1]).toBeGreaterThan(0.5);
    expect(bright[TONE_STEPS - 1]).toBeLessThan(0.5);
  });

  it("is the identity when strength is 0 or the photo is empty", () => {
    const id = Array.from({ length: TONE_STEPS + 1 }, (_, k) => k / TONE_STEPS);
    expect(toneCurve(fill(100, 30), 0)).toEqual(id);
    expect(toneCurve([])).toEqual(id);
  });
});

describe("isTone", () => {
  it("rejects malformed curves", () => {
    expect(isTone(null)).toBe(false);
    expect(isTone([0, 1])).toBe(false);
    expect(isTone([0, 0.5, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.99, 1])).toBe(false);
    expect(isTone([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.2])).toBe(false);
  });
});

describe("palettes", () => {
  it("have six stops in 0–1", () => {
    for (const p of [NIGHT_PALETTE, DAY_PALETTE]) {
      for (const c of [p.r, p.g, p.b]) {
        expect(c).toHaveLength(6);
        for (const v of c) expect(v >= 0 && v <= 1).toBe(true);
      }
    }
  });

  it("day shadows stay well above black so the photo reads on a light page", () => {
    const lum = (i: number) => 0.2126 * DAY_PALETTE.r[i] + 0.7152 * DAY_PALETTE.g[i] + 0.0722 * DAY_PALETTE.b[i];
    expect(lum(0)).toBeGreaterThan(0.3);
    expect(lum(5)).toBeGreaterThan(0.85);
  });
});

describe("thermalLut", () => {
  it("maps black and white to the palette ends", () => {
    const lut = thermalLut(NIGHT_PALETTE);
    expect([lut[0], lut[1], lut[2]]).toEqual([11, 10, 18]);
    expect([lut[255 * 3], lut[255 * 3 + 1], lut[255 * 3 + 2]]).toEqual([255, 216, 77]);
  });

  it("applies the tone curve before the palette", () => {
    const lifted = thermalLut(NIGHT_PALETTE, [0, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 0.93, 0.96, 0.98, 1]);
    const plain = thermalLut(NIGHT_PALETTE);
    const v = 26; // ~0.1
    expect(lifted[v * 3 + 1]).not.toBe(plain[v * 3 + 1]);
  });

  it("tableValue interpolates like feComponentTransfer", () => {
    expect(tableValue([0, 1], 0.25)).toBeCloseTo(0.25);
    expect(tableValue([0, 0.5, 1], 0.75)).toBeCloseTo(0.75);
    expect(tableValue([0.2, 0.8], 2)).toBe(0.8);
  });
});

describe("toneKey", () => {
  it("is stable and differs between curves", () => {
    const a = toneCurve(fill(10, 30));
    const b = toneCurve(fill(10, 200));
    expect(toneKey(a)).toBe(toneKey([...a]));
    expect(toneKey(a)).not.toBe(toneKey(b));
    expect(toneKey(a)).toMatch(/^[a-z0-9]+$/);
  });
});
