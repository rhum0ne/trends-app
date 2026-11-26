import Image from "next/image";
import type { CSSProperties } from "react";
import type { TrendImage } from "@/lib/types";
import { PEXELS_URL } from "@/lib/links";
import { DAY_PALETTE, NIGHT_PALETTE, toneKey, type Palette } from "@/lib/images/thermal";

export type ThermalVariant = "thermal" | "natural" | "cooled";

interface Props {
  image: TrendImage | null;
  /** Utilisé si l'image n'a pas de texte alternatif (jamais vide). */
  alt: string;
  /** Ignoré : le repli sans photo est le même dégradé chaud pour toutes les catégories. */
  category?: string;
  variant?: ThermalVariant;
  sizes?: string;
  priority?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Affiche « Photo: {name} on Pexels » en bas à droite. */
  credit?: boolean;
  /** Ajoute un dégradé sombre pour poser du texte : "b" (bas) ou "l" (gauche). */
  scrim?: "b" | "l";
}

/**
 * La photo de la tendance, passée dans le filtre thermique #thermal défini dans le layout.
 * Le conteneur doit avoir une taille (position relative + dimensions ou aspect-ratio).
 */
export function ThermalImage({
  image,
  alt,
  variant = "thermal",
  sizes = "100vw",
  priority = false,
  className = "",
  style,
  credit = false,
  scrim,
}: Props) {
  const cls = ["tr-photo", variant, scrim ? `tr-scrim-${scrim}` : "", className].filter(Boolean).join(" ");
  if (!image) {
    return (
      <div className={cls} style={style} role="img" aria-label={`${alt} (no photo)`}>
        <div className="ph-fallback" />
      </div>
    );
  }
  // Courbe de tonalité propre à la photo : filtres night et day dédiés, choisis par le CSS selon le thème
  const tone = variant === "thermal" && image.tone ? image.tone : null;
  const key = tone ? toneKey(tone) : null;
  const toneStyle = key ? ({ "--th-night": `url(#th-n-${key})`, "--th-day": `url(#th-d-${key})` } as CSSProperties) : undefined;
  return (
    <div className={cls} style={toneStyle ? { ...style, ...toneStyle } : style}>
      {tone && key ? (
        <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: "absolute" }}>
          <ThermalFilter id={`th-n-${key}`} palette={NIGHT_PALETTE} tone={tone} />
          <ThermalFilter id={`th-d-${key}`} palette={DAY_PALETTE} tone={tone} />
        </svg>
      ) : null}
      {image.avg_color ? <div className="ph-bg" style={{ background: image.avg_color }} aria-hidden="true" /> : null}
      <Image
        src={image.url}
        alt={image.alt || alt}
        fill
        sizes={sizes}
        priority={priority}
        title={`Photo: ${image.credit.name} on Pexels`}
      />
      {credit ? (
        <p className="tr-credit absolute bottom-2 right-3 z-10 m-0">
          Photo:{" "}
          <a href={image.credit.url} target="_blank" rel="noopener">
            {image.credit.name}
          </a>{" "}
          on{" "}
          <a href={image.source_url || PEXELS_URL} target="_blank" rel="noopener">
            Pexels
          </a>
        </p>
      ) : null}
    </div>
  );
}

/** Un filtre thermique : niveaux de gris, courbe de tonalité de la photo (si connue), puis palette. */
function ThermalFilter({ id, palette, tone }: { id: string; palette: Palette; tone?: number[] | null }) {
  const t = tone?.join(" ");
  return (
    <filter id={id} colorInterpolationFilters="sRGB">
      <feColorMatrix type="saturate" values="0" />
      {t ? (
        <feComponentTransfer>
          <feFuncR type="table" tableValues={t} />
          <feFuncG type="table" tableValues={t} />
          <feFuncB type="table" tableValues={t} />
        </feComponentTransfer>
      ) : null}
      <feComponentTransfer>
        <feFuncR type="table" tableValues={palette.r.join(" ")} />
        <feFuncG type="table" tableValues={palette.g.join(" ")} />
        <feFuncB type="table" tableValues={palette.b.join(" ")} />
      </feComponentTransfer>
    </filter>
  );
}

/**
 * Les filtres communs, définis une seule fois dans le layout (docs/images.md § 4) : #thermal (night,
 * noir → heat-0 → … → heat-4) et #thermal-day (mêmes couleurs, éclaircies). Ils servent aux photos dont
 * la courbe de tonalité n'est pas encore calculée et au fond avg_color pendant le chargement.
 */
export function ThermalFilterDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }} focusable="false">
      <ThermalFilter id="thermal" palette={NIGHT_PALETTE} />
      <ThermalFilter id="thermal-day" palette={DAY_PALETTE} />
    </svg>
  );
}
