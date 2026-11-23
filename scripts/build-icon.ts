// `pnpm build:icon` : génère l'icône « t° » de trends° à partir de la police Archivo.
// Aucun dessin à la main : le « t » est le glyphe d'Archivo figé en wdth 62 / wght 800, converti
// en <path> ; le ° est un anneau calculé (src/lib/brand/icon.ts). Les fichiers produits sont commités ;
// relancer ce script seulement si le dessin change.

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import * as fontkit from "fontkit";
import sharp from "sharp";
import {
  buildIconSvg,
  encodeIco,
  layoutMark,
  markReach,
  prepareGlyph,
  ringFor,
  VIEWBOX,
  type IconSvgOptions,
  type PathCommand,
} from "../src/lib/brand/icon";

// Police variable Archivo du dépôt google/fonts, à un commit fixé (licence OFL 1.1, docs/sources.md).
const FONT_COMMIT = "95f4904fc8bcf26d3420fe315560c96417c6dec7";
const FONT_URL = `https://raw.githubusercontent.com/google/fonts/${FONT_COMMIT}/ofl/archivo/Archivo%5Bwdth%2Cwght%5D.ttf`;
const FONT_SHA256 = "0e094a7d3c7c4c25cf1310c4b30014f1dae9332220b1c2c88f4fa996f0b05053";
const INSTANCE = { wdth: 62, wght: 800 };

const ROOT = path.resolve(import.meta.dirname, "..");
const CACHE = path.join(ROOT, "node_modules", ".cache", "trends-icon", `Archivo-${FONT_COMMIT.slice(0, 7)}.ttf`);

async function loadFont(): Promise<Buffer> {
  if (existsSync(CACHE)) {
    const cached = await readFile(CACHE);
    if (sha256(cached) === FONT_SHA256) return cached;
  }
  console.log(`Downloading Archivo from google/fonts@${FONT_COMMIT.slice(0, 7)}…`);
  const res = await fetch(FONT_URL, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Font download failed: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (sha256(buf) !== FONT_SHA256) throw new Error("Font checksum mismatch: refusing to use it");
  await mkdir(path.dirname(CACHE), { recursive: true });
  await writeFile(CACHE, buf);
  return buf;
}

const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");

async function png(svg: string, size: number): Promise<Buffer> {
  return sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toBuffer();
}

async function main() {
  const font = fontkit.create(await loadFont());
  if (!("getVariation" in font)) throw new Error("Expected a single font, got a collection");
  const instance = font.getVariation(INSTANCE);
  const t = instance.glyphForCodePoint("t".codePointAt(0)!);
  const glyph = prepareGlyph(t.path.commands as PathCommand[]);
  const h = glyph.bbox.maxY - glyph.bbox.minY;
  console.log(`Glyph "t" (wdth ${INSTANCE.wdth}, wght ${INSTANCE.wght}): height ${h}, stem ${glyph.stem.toFixed(1)} units`);

  // Chaque PNG est rendu depuis un SVG à sa taille exacte, avec l'anneau adapté à cette taille.
  const svg = (o: Omit<IconSvgOptions, "variant">, size: number) => buildIconSvg(glyph, { ...o, variant: ringFor(size), size, snap: size <= 48 ? size : undefined });
  const rounded = { shape: "rounded" } as const;
  const square = { shape: "square" } as const;
  const maskable = { shape: "square", safeRadius: 0.4 } as const;

  const outputs: [string, string | Buffer | Uint8Array][] = [
    ["src/app/icon.svg", buildIconSvg(glyph, { shape: "rounded", variant: "responsive" })],
    [
      "src/app/favicon.ico",
      encodeIco(await Promise.all([16, 32, 48].map(async (size) => ({ size, png: await png(svg(rounded, size), size) })))),
    ],
    ["src/app/apple-icon.png", await png(svg(square, 180), 180)],
    ["public/icon-192.png", await png(svg(rounded, 192), 192)],
    ["public/icon-512.png", await png(svg(rounded, 512), 512)],
    ["public/icon-maskable-512.png", await png(svg(maskable, 512), 512)],
    ["public/og-avatar.png", await png(svg(square, 400), 400)],
  ];
  for (const [file, data] of outputs) {
    await writeFile(path.join(ROOT, file), data);
    console.log(`  ${file}`);
  }

  const reach = markReach(glyph, layoutMark(glyph, "normal", VIEWBOX, maskable), VIEWBOX);
  console.log(`Maskable: farthest point at ${(reach * 100).toFixed(1)} % of the side from the centre (limit 40 %)`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
