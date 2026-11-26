// Filtre thermique côté serveur, pour les images Open Graph et la carte partageable (docs/images.md § 4) :
// même courbe de tonalité et même palette night que le filtre SVG, appliquées avec sharp.

import sharp from "sharp";
import { NIGHT_PALETTE, thermalLut, toneCurve } from "@/lib/images/thermal";

/** Télécharge une photo, la recadre et la passe en thermique ; renvoie une data URL JPEG, ou null. */
export async function thermalDataUrl(url: string, width: number, height: number, variant: "thermal" | "cooled" = "thermal"): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const input = Buffer.from(await res.arrayBuffer());
    const { data, info } = await sharp(input).resize(width, height, { fit: "cover" }).greyscale().raw().toBuffer({ resolveWithObject: true });
    const count = info.width * info.height;
    const grey = new Uint8Array(count);
    for (let i = 0; i < count; i++) grey[i] = data[i * info.channels];
    const lut = variant === "thermal" ? thermalLut(NIGHT_PALETTE, toneCurve(grey)) : null;
    const out = Buffer.alloc(count * 3);
    for (let i = 0; i < count; i++) {
      const v = grey[i];
      if (!lut) {
        const g = Math.round(v * 0.6);
        out[i * 3] = out[i * 3 + 1] = out[i * 3 + 2] = g;
      } else {
        out[i * 3] = lut[v * 3];
        out[i * 3 + 1] = lut[v * 3 + 1];
        out[i * 3 + 2] = lut[v * 3 + 2];
      }
    }
    const jpeg = await sharp(out, { raw: { width: info.width, height: info.height, channels: 3 } }).jpeg({ quality: 82 }).toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return null;
  }
}
