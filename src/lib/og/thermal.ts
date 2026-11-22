// Filtre thermique côté serveur, pour les images Open Graph et la carte partageable (docs/images.md § 4) :
// même table que le filtre SVG #thermal, appliquée avec sharp.

import sharp from "sharp";

// Valeurs de feFuncR/G/B (noir → heat-0 → heat-1 → heat-2 → heat-3 → heat-4)
export const TABLE = {
  r: [0.043, 0.141, 0.482, 0.894, 1, 1],
  g: [0.039, 0.341, 0.235, 0.208, 0.478, 0.847],
  b: [0.071, 1, 1, 0.549, 0.102, 0.302],
};

/** Interpolation « table » de feComponentTransfer pour une valeur 0–1. */
export function tableValue(values: number[], c: number): number {
  const n = values.length - 1;
  const x = Math.max(0, Math.min(1, c));
  if (x === 1) return values[n];
  const k = Math.floor(x * n);
  return values[k] + (x * n - k) * (values[k + 1] - values[k]);
}

/** Table de correspondance gris (0–255) → RGB, 256 × 3 octets. */
export function thermalLut(): Uint8Array {
  const lut = new Uint8Array(256 * 3);
  for (let v = 0; v < 256; v++) {
    const c = v / 255;
    lut[v * 3] = Math.round(tableValue(TABLE.r, c) * 255);
    lut[v * 3 + 1] = Math.round(tableValue(TABLE.g, c) * 255);
    lut[v * 3 + 2] = Math.round(tableValue(TABLE.b, c) * 255);
  }
  return lut;
}

const LUT = thermalLut();

/** Télécharge une photo, la recadre et la passe en thermique ; renvoie une data URL JPEG, ou null. */
export async function thermalDataUrl(url: string, width: number, height: number, variant: "thermal" | "cooled" = "thermal"): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const input = Buffer.from(await res.arrayBuffer());
    const { data, info } = await sharp(input).resize(width, height, { fit: "cover" }).greyscale().raw().toBuffer({ resolveWithObject: true });
    const out = Buffer.alloc(info.width * info.height * 3);
    for (let i = 0; i < info.width * info.height; i++) {
      const v = data[i * info.channels];
      if (variant === "cooled") {
        const g = Math.round(v * 0.6);
        out[i * 3] = out[i * 3 + 1] = out[i * 3 + 2] = g;
      } else {
        out[i * 3] = LUT[v * 3];
        out[i * 3 + 1] = LUT[v * 3 + 1];
        out[i * 3 + 2] = LUT[v * 3 + 2];
      }
    }
    const jpeg = await sharp(out, { raw: { width: info.width, height: info.height, channels: 3 } }).jpeg({ quality: 82 }).toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return null;
  }
}
