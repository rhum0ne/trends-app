import Image from "next/image";
import type { CSSProperties } from "react";
import type { TrendImage } from "@/lib/types";
import { PEXELS_URL } from "@/lib/links";

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
  return (
    <div className={cls} style={style}>
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

/** Le filtre SVG, défini une seule fois dans le layout (docs/images.md § 4). */
export function ThermalFilterDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }} focusable="false">
      <filter id="thermal" colorInterpolationFilters="sRGB">
        <feColorMatrix type="saturate" values="0" />
        <feComponentTransfer>
          <feFuncR type="table" tableValues="0.043 0.141 0.482 0.894 1 1" />
          <feFuncG type="table" tableValues="0.039 0.341 0.235 0.208 0.478 0.847" />
          <feFuncB type="table" tableValues="0.071 1 1 0.549 0.102 0.302" />
        </feComponentTransfer>
      </filter>
    </svg>
  );
}
