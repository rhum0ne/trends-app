import { countryName } from "@/lib/format";

interface Props {
  code: string;
  size?: "xs" | "sm" | "lg";
  className?: string;
  /** Mettre à false quand le nom ou le code est déjà écrit juste à côté. */
  label?: boolean;
}

/**
 * Drapeau dessiné (SVG de flag-icons, licence MIT, copiés dans public/flags par postinstall).
 * Jamais d'emoji (CLAUDE.md § 9). Toujours accompagné du code ou du nom du pays dans l'interface.
 */
export function Flag({ code, size = "sm", className = "", label = true }: Props) {
  const c = code.toLowerCase();
  const safe = /^[a-z]{2}$/.test(c) ? c : "xx";
  return (
    <span
      className={`tr-flag ${size} ${className}`}
      style={{ backgroundImage: `url(/flags/${safe}.svg)` }}
      {...(label ? { role: "img", "aria-label": countryName(code) } : { "aria-hidden": true })}
    />
  );
}
