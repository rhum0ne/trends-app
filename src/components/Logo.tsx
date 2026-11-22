import Link from "next/link";

/** Logo trends° : Archivo condensé 800, minuscules, le signe ° est le glyphe de la marque
 * (couleur ink : l'échelle thermique est réservée à la chaleur). */
export function Logo({ size = 34, href = "/" }: { size?: number; href?: string | null }) {
  const mark = (
    <span className="tr-display inline-flex items-start leading-none" style={{ fontSize: size }}>
      trends°
    </span>
  );
  return href ? (
    <Link href={href} className="no-underline" aria-label="trends° home">
      {mark}
    </Link>
  ) : (
    mark
  );
}
