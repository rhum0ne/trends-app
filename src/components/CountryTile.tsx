import Link from "next/link";
import { Flag } from "./Flag";
import { heatLevelIndex } from "@/lib/heat/levels";
import { countryName } from "@/lib/format";

interface Props {
  code: string;
  /** Chaleur de la tendance publiée la plus chaude du pays, ou null s'il n'en a aucune. */
  heat: number | null;
  trendTitle: string | null;
  pressed?: boolean;
  onSelect?: () => void;
  href?: string;
}

/** Tuile pays : fond de la couleur de sa tendance la plus chaude, drapeau, code, degré, nom de la tendance. */
export function CountryTile({ code, heat, trendTitle, pressed, onSelect, href }: Props) {
  const lvl = heat === null ? "none" : `l${heatLevelIndex(heat)}`;
  const name = countryName(code);
  const content = (
    <>
      <span className="top">
        <Flag code={code} size="sm" label={false} />
        <span className="code">{code.toUpperCase()}</span>
      </span>
      <span className="tr-sr">{name}</span>
      {heat === null ? (
        <span className="mt-auto text-xs">No trend we cover today</span>
      ) : (
        <>
          <span className="deg">{heat}°</span>
          <span className="nm">{trendTitle}</span>
        </>
      )}
    </>
  );
  if (onSelect) {
    return (
      <button type="button" className={`tr-tile ${lvl}`} aria-pressed={pressed ?? false} onClick={onSelect}>
        {content}
      </button>
    );
  }
  return (
    <Link href={href ?? `/c/${code.toLowerCase()}`} className={`tr-tile ${lvl}`}>
      {content}
    </Link>
  );
}
