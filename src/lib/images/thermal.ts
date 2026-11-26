// Filtre thermique (docs/images.md § 4) : palettes night et day, et courbe de tonalité propre à chaque photo.
// Fonctions pures, sans sharp : utilisées par le composant ThermalImage et par les images Open Graph.

export interface Palette {
  r: number[];
  g: number[];
  b: number[];
}

function fromHex(stops: string[]): Palette {
  const c = stops.map((h) => [1, 3, 5].map((i) => Math.round((parseInt(h.slice(i, i + 2), 16) / 255) * 1000) / 1000));
  return { r: c.map((x) => x[0]), g: c.map((x) => x[1]), b: c.map((x) => x[2]) };
}

/** Night : noir → heat-0 → heat-1 → heat-2 → heat-3 → heat-4 (zones claires = zones chaudes). */
export const NIGHT_PALETTE: Palette = {
  r: [0.043, 0.141, 0.482, 0.894, 1, 1],
  g: [0.039, 0.341, 0.235, 0.208, 0.478, 0.847],
  b: [0.071, 1, 1, 0.549, 0.102, 0.302],
};

/**
 * Day : même ordre de couleurs, éclaircies, et les ombres partent d'un indigo moyen au lieu du noir.
 * La photo reste lisible sur le fond clair sans être estompée.
 */
export const DAY_PALETTE: Palette = fromHex(["#5a4fc4", "#6f8fff", "#ad8cff", "#f58fbe", "#ffb27a", "#fff0b8"]);

/** Nombre d'intervalles de la courbe de tonalité (11 valeurs). */
export const TONE_STEPS = 10;
/** Part de l'égalisation dans la courbe : 0 = photo telle quelle, 1 = histogramme entièrement aplani. */
export const TONE_STRENGTH = 0.7;

/**
 * Courbe de tonalité d'une photo, à partir de ses niveaux de gris (0–255) : égalisation partielle de
 * l'histogramme, pour qu'une photo sombre ou claire occupe toute l'échelle thermique.
 * Rend TONE_STEPS + 1 valeurs croissantes de 0 à 1 (tableValues d'un feComponentTransfer).
 */
export function toneCurve(grey: ArrayLike<number>, strength = TONE_STRENGTH): number[] {
  const n = grey.length;
  const identity = Array.from({ length: TONE_STEPS + 1 }, (_, k) => k / TONE_STEPS);
  if (n === 0) return identity;
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < n; i++) hist[Math.max(0, Math.min(255, Math.round(grey[i])))]++;
  const cdf = new Array<number>(256);
  let sum = 0;
  for (let v = 0; v < 256; v++) {
    sum += hist[v];
    cdf[v] = sum / n;
  }
  const s = Math.max(0, Math.min(1, strength));
  const out = identity.map((x) => {
    const c = cdf[Math.round(x * 255)];
    return Math.round((s * c + (1 - s) * x) * 1000) / 1000;
  });
  out[0] = 0;
  out[TONE_STEPS] = 1;
  // Croissante (garde-fou contre les arrondis)
  for (let k = 1; k <= TONE_STEPS; k++) out[k] = Math.max(out[k], out[k - 1]);
  return out;
}

/** Une courbe lue en base est-elle utilisable ? (11 nombres croissants entre 0 et 1) */
export function isTone(v: unknown): v is number[] {
  return (
    Array.isArray(v) &&
    v.length === TONE_STEPS + 1 &&
    v.every((x, i) => typeof x === "number" && x >= 0 && x <= 1 && (i === 0 || x >= v[i - 1]))
  );
}

/** Interpolation « table » de feComponentTransfer pour une valeur 0–1. */
export function tableValue(values: number[], c: number): number {
  const n = values.length - 1;
  const x = Math.max(0, Math.min(1, c));
  if (x === 1) return values[n];
  const k = Math.floor(x * n);
  return values[k] + (x * n - k) * (values[k + 1] - values[k]);
}

/** Table gris (0–255) → RGB (256 × 3 octets) : courbe de tonalité, puis palette. */
export function thermalLut(palette: Palette = NIGHT_PALETTE, tone?: number[] | null): Uint8Array {
  const lut = new Uint8Array(256 * 3);
  for (let v = 0; v < 256; v++) {
    const c = tone ? tableValue(tone, v / 255) : v / 255;
    lut[v * 3] = Math.round(tableValue(palette.r, c) * 255);
    lut[v * 3 + 1] = Math.round(tableValue(palette.g, c) * 255);
    lut[v * 3 + 2] = Math.round(tableValue(palette.b, c) * 255);
  }
  return lut;
}

/** Identifiant court et stable d'une courbe (deux photos à la même courbe partagent leur filtre). */
export function toneKey(tone: number[]): string {
  let h = 2166136261;
  for (const ch of tone.join(",")) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}
