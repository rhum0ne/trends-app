import { describe, expect, it } from "vitest";
import {
  buildIconSvg,
  encodeIco,
  layoutMark,
  markReach,
  placeRing,
  prepareGlyph,
  ringFor,
  RINGS,
  tokenColor,
  VIEWBOX,
  type PathCommand,
} from "./icon";

// Un « t » simplifié aux mesures du vrai (Archivo wdth 62 / wght 800) : fût 54–188, barre 13–246.
const poly = (pts: [number, number][]): PathCommand[] => [
  { command: "moveTo", args: pts[0] },
  ...pts.slice(1).map((p) => ({ command: "lineTo", args: p })),
  { command: "closePath", args: [] },
];
const T = poly([
  [54, -12],
  [188, -12],
  [188, 415],
  [246, 415],
  [246, 527],
  [188, 527],
  [188, 684],
  [81, 684],
  [57, 527],
  [13, 527],
  [13, 415],
  [54, 415],
]);
const glyph = prepareGlyph(T);

describe("tokenColor", () => {
  it("reads colours from docs/design/tokens.json", () => {
    expect(tokenColor("night")).toBe("#0b0a12");
    expect(tokenColor("ink")).toBe("#f5f3ff");
    expect(tokenColor("heat-4")).toBe("#ffd84d");
    expect(tokenColor("night", "day")).toBe("#f7f5fb");
    expect(() => tokenColor("nope")).toThrow();
  });
});

describe("prepareGlyph", () => {
  it("measures the bounding box and the stem", () => {
    expect(glyph.bbox).toEqual({ minX: 13, minY: -12, maxX: 246, maxY: 684 });
    expect(glyph.stem).toBeCloseTo(134);
    expect(glyph.stemX).toBeCloseTo(54);
    expect(glyph.d.startsWith("M54 -12L188 -12")).toBe(true);
    expect(glyph.d.endsWith("Z")).toBe(true);
  });

  it("flattens curves", () => {
    const g = prepareGlyph([
      { command: "moveTo", args: [0, 0] },
      { command: "lineTo", args: [100, 0] },
      { command: "quadraticCurveTo", args: [100, 200, 0, 200] },
      { command: "closePath", args: [] },
    ]);
    expect(g.bbox.maxX).toBeGreaterThan(50);
    expect(g.bbox.maxX).toBeLessThanOrEqual(100);
    expect(g.points.length).toBeGreaterThan(10);
  });
});

describe("placeRing", () => {
  it("aligns the top of the ring with the top of the t, at the given gap", () => {
    for (const spec of Object.values(RINGS)) {
      const ring = placeRing(glyph, spec);
      expect(ring.cy + ring.outer).toBeCloseTo(glyph.bbox.maxY);
      expect(ring.outer * 2).toBeCloseTo(spec.diameter * 696);
      expect(ring.stroke).toBeCloseTo(spec.stroke * 134);
      const clearance = Math.min(...glyph.points.map(([x, y]) => Math.hypot(x - ring.cx, y - ring.cy))) - ring.outer;
      expect(clearance).toBeCloseTo(spec.gap * 134, 0);
    }
  });

  it("keeps the hole of the ring open", () => {
    for (const spec of Object.values(RINGS)) {
      const ring = placeRing(glyph, spec);
      expect(ring.outer - ring.stroke).toBeGreaterThan(ring.outer * 0.3);
    }
  });
});

describe("layoutMark", () => {
  const groupBox = (variant: "normal" | "small", side: number, opts = {}) => {
    const m = layoutMark(glyph, variant, side, opts);
    const xs = [m.s * glyph.bbox.minX + m.tx, m.s * glyph.bbox.maxX + m.tx, m.s * (m.ring.cx - m.ring.outer) + m.tx, m.s * (m.ring.cx + m.ring.outer) + m.tx];
    const ys = [-m.s * glyph.bbox.maxY + m.ty, -m.s * glyph.bbox.minY + m.ty, -m.s * (m.ring.cy + m.ring.outer) + m.ty];
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  };

  it("fills about 62 % of the side and is centred (nudged slightly down)", () => {
    const b = groupBox("normal", 512);
    expect(Math.max(b.maxX - b.minX, b.maxY - b.minY)).toBeCloseTo(0.62 * 512);
    expect((b.minX + b.maxX) / 2).toBeCloseTo(256);
    const cy = (b.minY + b.maxY) / 2;
    expect(cy).toBeGreaterThan(256);
    expect(cy).toBeLessThan(256 + 0.03 * 512);
  });

  it("fits the maskable safe circle", () => {
    const m = layoutMark(glyph, "normal", VIEWBOX, { safeRadius: 0.4 });
    expect(markReach(glyph, m, VIEWBOX)).toBeLessThanOrEqual(0.4);
    const tight = layoutMark(glyph, "normal", VIEWBOX, { safeRadius: 0.3 });
    expect(markReach(glyph, tight, VIEWBOX)).toBeLessThanOrEqual(0.3);
  });

  it("snaps the stem to the pixel grid for small PNGs", () => {
    for (const size of [16, 32]) {
      const m = layoutMark(glyph, "small", VIEWBOX, { snap: size });
      const px = VIEWBOX / size;
      const left = (m.s * glyph.stemX + m.tx) / px;
      const width = (m.s * glyph.stem) / px;
      expect(left).toBeCloseTo(Math.round(left));
      expect(width).toBeCloseTo(Math.round(width));
      expect(width).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("ringFor", () => {
  it("uses the small ring at 16 and 32 px only", () => {
    expect(ringFor(16)).toBe("small");
    expect(ringFor(32)).toBe("small");
    expect(ringFor(48)).toBe("normal");
    expect(ringFor(512)).toBe("normal");
  });
});

describe("buildIconSvg", () => {
  it("draws the t as a path, never as text, with token colours", () => {
    const svg = buildIconSvg(glyph, { shape: "rounded", variant: "normal" });
    expect(svg).not.toContain("<text");
    expect(svg).toContain(`<path id="t" fill="#f5f3ff"`);
    expect(svg).toContain(`stroke="#ffd84d"`);
    expect(svg).toContain(`fill="#0b0a12"`);
    expect(svg).toContain(`rx="115.2"`);
  });

  it("is full-bleed when square", () => {
    const svg = buildIconSvg(glyph, { shape: "square", variant: "normal", size: 180 });
    expect(svg).not.toContain("rx=");
    expect(svg).toContain(`width="180" height="180"`);
  });

  it("switches to the small ring below 40 px when responsive", () => {
    const svg = buildIconSvg(glyph, { shape: "rounded", variant: "responsive" });
    expect(svg).toContain("@media (max-width:40px)");
    expect(svg.match(/<circle /g)).toHaveLength(2);
    expect(svg).toContain(`class="n"`);
    expect(svg).toContain(`class="s"`);
  });
});

describe("encodeIco", () => {
  it("writes a valid ICO header and directory", () => {
    const a = new Uint8Array([1, 2, 3]);
    const b = new Uint8Array([4, 5]);
    const ico = encodeIco([
      { size: 16, png: a },
      { size: 256, png: b },
    ]);
    const v = new DataView(ico.buffer);
    expect(v.getUint16(0, true)).toBe(0);
    expect(v.getUint16(2, true)).toBe(1);
    expect(v.getUint16(4, true)).toBe(2);
    expect(ico[6]).toBe(16);
    expect(ico[22]).toBe(0); // 256 s'écrit 0
    expect(v.getUint32(6 + 8, true)).toBe(3);
    expect(v.getUint32(6 + 12, true)).toBe(38);
    expect(v.getUint32(22 + 12, true)).toBe(41);
    expect(Array.from(ico.slice(38))).toEqual([1, 2, 3, 4, 5]);
  });
});
