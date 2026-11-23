// Icône « t° » de trends° : géométrie et encodage, sans entrée/sortie (testé).
// Le glyphe « t » vient d'Archivo (wdth 62, wght 800) ; il est lu et figé par `scripts/build-icon.ts`,
// qui passe ses commandes de tracé ici. Couleurs lues dans `docs/design/tokens.json` (CLAUDE.md § 10).

import tokens from "../../../docs/design/tokens.json";

/** Commande de tracé telle que la donne fontkit (unités de la police, axe y vers le haut). */
export type PathCommand = { command: string; args: number[] };

export type Box = { minX: number; minY: number; maxX: number; maxY: number };

/** Le « t » figé : son tracé et ce qu'on en mesure. */
export type Glyph = {
  /** Attribut `d` du tracé, en unités de la police (y vers le haut). */
  d: string;
  bbox: Box;
  /** Épaisseur du fût, mesurée sur le contour, et abscisse de son bord gauche. */
  stem: number;
  stemX: number;
  /** Points du contour aplati (courbes découpées), pour les distances. */
  points: [number, number][];
};

/** Anneau du degré, en proportions du « t » : diamètre extérieur × hauteur, trait et écart × fût. */
export type RingSpec = { diameter: number; stroke: number; gap: number };

export const RINGS = {
  /**
   * Taille normale. Un trait égal au fût (×1) boucherait le trou (diamètre 0,45 h → trou d'environ
   * 0,06 h) : on garde 0,72 du fût, l'anneau reste plus gras que le ° d'Archivo (≈ 0,55 du fût).
   */
  normal: { diameter: 0.45, stroke: 0.72, gap: 0.4 },
  /** 16 et 32 px : anneau plus grand et plus gras, trou ouvert d'au moins ~2,5 px en 16 px, écart d'au moins 1 px. */
  small: { diameter: 0.56, stroke: 0.8, gap: 0.6 },
} as const satisfies Record<string, RingSpec>;

export type RingVariant = keyof typeof RINGS;

/** Tailles de rendu (px) qui prennent l'anneau `small`. */
export const SMALL_SIZES = [16, 32] as const;
export const ringFor = (px: number): RingVariant => (px <= 32 ? "small" : "normal");

export type Shape = "rounded" | "square";

export type MarkOptions = {
  /** Part du côté occupée par le plus grand côté du groupe « t° ». */
  fill?: number;
  /** Rayon de la zone de sécurité, en part du côté (0,4 = cercle de 80 % pour `maskable`). */
  safeRadius?: number;
  /** Décalage optique vers le bas, en part du côté. */
  nudge?: number;
  /**
   * Taille de rendu en px d'un PNG : le fût est calé sur la grille de pixels (largeur entière,
   * bord gauche sur un pixel) pour rester net en 16 et 32 px. Sans effet sur le SVG.
   */
  snap?: number;
};

export const MARK_DEFAULTS = { fill: 0.62, nudge: 0.012 } as const;
/** Coins arrondis de `icon.svg` et des icônes PWA : 22,5 % du côté. */
export const CORNER = 0.225;
/** Côté du `viewBox` de tous les SVG produits. */
export const VIEWBOX = 512;

// ---------------------------------------------------------------------------
// Couleurs

type TokenValue = string | { night: string; day: string };

export function tokenColor(name: string, theme: "night" | "day" = "night"): string {
  const t = (tokens.color.tokens as { name: string; value: TokenValue }[]).find((x) => x.name === name);
  if (!t) throw new Error(`Unknown colour token: ${name}`);
  return typeof t.value === "string" ? t.value : t.value[theme];
}

export const iconColors = () => ({
  ground: tokenColor("night", "night"),
  ink: tokenColor("ink", "night"),
  ring: tokenColor("heat-4"),
});

// ---------------------------------------------------------------------------
// Tracé du glyphe

/** Aplatit les commandes (M, L, Q, C, Z) en contours fermés de points. */
export function flatten(commands: PathCommand[], steps = 12): [number, number][][] {
  const contours: [number, number][][] = [];
  let cur: [number, number][] = [];
  let x = 0;
  let y = 0;
  for (const { command, args } of commands) {
    switch (command) {
      case "moveTo":
        if (cur.length) contours.push(cur);
        [x, y] = args;
        cur = [[x, y]];
        break;
      case "lineTo":
        [x, y] = args;
        cur.push([x, y]);
        break;
      case "quadraticCurveTo": {
        const [cx, cy, ex, ey] = args;
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const u = 1 - t;
          cur.push([u * u * x + 2 * u * t * cx + t * t * ex, u * u * y + 2 * u * t * cy + t * t * ey]);
        }
        [x, y] = [ex, ey];
        break;
      }
      case "bezierCurveTo": {
        const [c1x, c1y, c2x, c2y, ex, ey] = args;
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const u = 1 - t;
          cur.push([
            u * u * u * x + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * ex,
            u * u * u * y + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * ey,
          ]);
        }
        [x, y] = [ex, ey];
        break;
      }
      case "closePath":
        if (cur.length) contours.push(cur);
        cur = [];
        break;
    }
  }
  if (cur.length) contours.push(cur);
  return contours;
}

export function boundsOf(points: [number, number][]): Box {
  const box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const [x, y] of points) {
    box.minX = Math.min(box.minX, x);
    box.minY = Math.min(box.minY, y);
    box.maxX = Math.max(box.maxX, x);
    box.maxY = Math.max(box.maxY, y);
  }
  return box;
}

/** Abscisses où l'horizontale `y` coupe les contours, triées. */
export function scanline(contours: [number, number][][], y: number): number[] {
  const xs: number[] = [];
  for (const c of contours) {
    for (let i = 0; i < c.length; i++) {
      const [x1, y1] = c[i];
      const [x2, y2] = c[(i + 1) % c.length];
      if (y1 === y2) continue;
      if ((y >= Math.min(y1, y2)) && (y < Math.max(y1, y2))) xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
    }
  }
  return xs.sort((a, b) => a - b);
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function commandsToD(commands: PathCommand[]): string {
  const letter: Record<string, string> = { moveTo: "M", lineTo: "L", quadraticCurveTo: "Q", bezierCurveTo: "C", closePath: "Z" };
  return commands.map(({ command, args }) => letter[command] + args.map(r2).join(" ")).join("");
}

/**
 * Prépare le « t » : tracé, boîte, points et épaisseur du fût, mesurée sur une horizontale à 30 %
 * de la hauteur (sous la barre, au-dessus du crochet).
 */
export function prepareGlyph(commands: PathCommand[]): Glyph {
  const contours = flatten(commands);
  const points = contours.flat();
  const bbox = boundsOf(points);
  const xs = scanline(contours, bbox.minY + 0.3 * (bbox.maxY - bbox.minY));
  if (xs.length < 2) throw new Error("Could not measure the stem of the glyph");
  return { d: commandsToD(commands), bbox, stem: xs[1] - xs[0], stemX: xs[0], points };
}

// ---------------------------------------------------------------------------
// Composition

export type Ring = { cx: number; cy: number; outer: number; stroke: number };

/** Place l'anneau (unités de la police) : haut aligné sur le haut du t, à `gap` du contour le plus proche. */
export function placeRing(glyph: Glyph, spec: RingSpec): Ring {
  const h = glyph.bbox.maxY - glyph.bbox.minY;
  const outer = (spec.diameter * h) / 2;
  const cy = glyph.bbox.maxY - outer;
  const gap = spec.gap * glyph.stem;
  const clearance = (cx: number) => Math.min(...glyph.points.map(([x, y]) => Math.hypot(x - cx, y - cy))) - outer;
  // La distance au contour croît avec cx une fois l'anneau à droite du t : recherche par dichotomie.
  let lo = glyph.bbox.minX;
  let hi = glyph.bbox.maxX + outer + gap * 4;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (clearance(mid) < gap) lo = mid;
    else hi = mid;
  }
  return { cx: hi, cy, outer, stroke: spec.stroke * glyph.stem };
}

/** Transformation du groupe vers le carré : x' = s·x + tx, y' = −s·y + ty (y vers le bas). */
export type Mark = { s: number; tx: number; ty: number; ring: Ring };

export function layoutMark(glyph: Glyph, variant: RingVariant, side: number, opts: MarkOptions = {}): Mark {
  const fill = opts.fill ?? MARK_DEFAULTS.fill;
  const nudge = (opts.nudge ?? MARK_DEFAULTS.nudge) * side;
  const ring = placeRing(glyph, RINGS[variant]);
  const box = {
    minX: Math.min(glyph.bbox.minX, ring.cx - ring.outer),
    maxX: Math.max(glyph.bbox.maxX, ring.cx + ring.outer),
    minY: Math.min(glyph.bbox.minY, ring.cy - ring.outer),
    maxY: Math.max(glyph.bbox.maxY, ring.cy + ring.outer),
  };
  const midX = (box.minX + box.maxX) / 2;
  const midY = (box.minY + box.maxY) / 2;
  let s = (fill * side) / Math.max(box.maxX - box.minX, box.maxY - box.minY);
  const at = (scale: number) => ({ s: scale, tx: side / 2 - scale * midX, ty: side / 2 + nudge + scale * midY, ring });

  if (opts.safeRadius) {
    // Zone de sécurité (maskable) : tout point du groupe dans le cercle centré de rayon safeRadius·side.
    const limit = opts.safeRadius * side;
    for (let i = 0; i < 8; i++) {
      const m = at(s);
      const reach = Math.max(
        ...glyph.points.map(([x, y]) => Math.hypot(m.s * x + m.tx - side / 2, -m.s * y + m.ty - side / 2)),
        Math.hypot(m.s * ring.cx + m.tx - side / 2, -m.s * ring.cy + m.ty - side / 2) + m.s * ring.outer,
      );
      if (reach <= limit) break;
      s *= (limit / reach) * 0.999;
    }
  }
  if (opts.snap) {
    const px = side / opts.snap;
    const stemPx = Math.max(1, Math.round((s * glyph.stem) / px));
    s = (stemPx * px) / glyph.stem;
    const m = at(s);
    const left = s * glyph.stemX + m.tx;
    return { ...m, tx: m.tx + Math.round(left / px) * px - left };
  }
  return at(s);
}

/** Point le plus éloigné du centre, en part du côté (contrôle de la zone de sécurité). */
export function markReach(glyph: Glyph, mark: Mark, side: number): number {
  const { s, tx, ty, ring } = mark;
  const c = side / 2;
  return (
    Math.max(
      ...glyph.points.map(([x, y]) => Math.hypot(s * x + tx - c, -s * y + ty - c)),
      Math.hypot(s * ring.cx + tx - c, -s * ring.cy + ty - c) + s * ring.outer,
    ) / side
  );
}

// ---------------------------------------------------------------------------
// SVG

export type IconSvgOptions = MarkOptions & {
  shape: Shape;
  /** `responsive` : les deux anneaux, `small` choisi par une media query sous 40 px de large. */
  variant: RingVariant | "responsive";
  /** Taille de rendu (attributs width/height) ; le viewBox reste VIEWBOX. */
  size?: number;
};

function markGroup(glyph: Glyph, mark: Mark, colors: ReturnType<typeof iconColors>, attrs = ""): string {
  const { s, tx, ty, ring } = mark;
  const cx = r2(s * ring.cx + tx);
  const cy = r2(-s * ring.cy + ty);
  const r = r2(s * (ring.outer - ring.stroke / 2));
  return (
    `<g${attrs}>` +
    `<use href="#t" transform="matrix(${Number(s.toFixed(5))} 0 0 ${-Number(s.toFixed(5))} ${r2(tx)} ${r2(ty)})"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${colors.ring}" stroke-width="${r2(s * ring.stroke)}"/>` +
    `</g>`
  );
}

export function buildIconSvg(glyph: Glyph, opts: IconSvgOptions): string {
  const colors = iconColors();
  const side = VIEWBOX;
  const size = opts.size ? ` width="${opts.size}" height="${opts.size}"` : "";
  const rx = opts.shape === "rounded" ? ` rx="${r2(CORNER * side)}"` : "";
  const defs = `<defs><path id="t" fill="${colors.ink}" d="${glyph.d}"/></defs>`;
  const ground = `<rect width="${side}" height="${side}"${rx} fill="${colors.ground}"/>`;
  let body: string;
  if (opts.variant === "responsive") {
    const style = `<style>.s{display:none}@media (max-width:40px){.n{display:none}.s{display:inline}}</style>`;
    body =
      style +
      markGroup(glyph, layoutMark(glyph, "normal", side, opts), colors, ` class="n"`) +
      // Calée sur la grille de 16 px, donc aussi sur celle de 32 px (onglets en densité 1 et 2).
      markGroup(glyph, layoutMark(glyph, "small", side, { ...opts, snap: SMALL_SIZES[0] }), colors, ` class="s"`);
  } else {
    body = markGroup(glyph, layoutMark(glyph, opts.variant, side, opts), colors);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}"${size}>${defs}${ground}${body}</svg>\n`;
}

// ---------------------------------------------------------------------------
// ICO

/** Assemble un .ico à partir de PNG (format accepté par tous les navigateurs actuels). */
export function encodeIco(images: { size: number; png: Uint8Array }[]): Uint8Array {
  const headerSize = 6 + 16 * images.length;
  const total = headerSize + images.reduce((n, i) => n + i.png.length, 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, images.length, true);
  let offset = headerSize;
  images.forEach(({ size, png }, i) => {
    const e = 6 + 16 * i;
    view.setUint8(e, size >= 256 ? 0 : size);
    view.setUint8(e + 1, size >= 256 ? 0 : size);
    view.setUint8(e + 2, 0);
    view.setUint8(e + 3, 0);
    view.setUint16(e + 4, 1, true);
    view.setUint16(e + 6, 32, true);
    view.setUint32(e + 8, png.length, true);
    view.setUint32(e + 12, offset, true);
    out.set(png, offset);
    offset += png.length;
  });
  return out;
}
