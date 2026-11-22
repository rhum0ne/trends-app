import Link from "next/link";
import type { CountryHeat, TrendImage } from "@/lib/types";
import { HeatBadge } from "./HeatBadge";
import { ThermalImage } from "./ThermalImage";
import { Flag } from "./Flag";
import { CategorySticker, HeatwaveSticker, SafetySticker } from "./Sticker";
import { coolsInLabel, formatDay } from "@/lib/format";

export interface CardTrend {
  slug: string;
  title: string;
  category: string;
  why: string;
  heat: number;
  brand_safe: boolean;
  countries: CountryHeat[];
  cools_in_days: number | null;
  image: TrendImage | null;
  heatwave_days?: number;
  peak_heat?: number | null;
  peak_day?: string | null;
}

interface Props {
  trend: CardTrend;
  /** Barres de progression : position dans le fil. */
  index?: number;
  total?: number;
  /** La tendance du jour : seule carte avec glow-hot. */
  top?: boolean;
  example?: boolean;
  linked?: boolean;
  className?: string;
}

function CardBody({ trend, index = 0, total = 1, example }: Props) {
  const flags = trend.countries.slice(0, 3);
  return (
    <div className="in">
      <div className="tr-bars" aria-hidden="true">
        {Array.from({ length: Math.max(1, total) }, (_, i) => (
          <i key={i} className={i <= index ? "on" : ""} />
        ))}
      </div>
      <div className="tr-story-head">
        <span className="flex items-center gap-1">
          {flags.length > 0 ? (
            <>
              {flags.map((c) => (
                <Flag key={c.code} code={c.code} size="xs" label={false} />
              ))}
              <span>{flags.map((c) => c.code).join(" · ")}</span>
            </>
          ) : (
            <span>Worldwide</span>
          )}
        </span>
        {example ? <span className="tr-example" style={{ color: "#f5f3ff" }}>Example</span> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <CategorySticker category={trend.category} onPhoto />
        <SafetySticker brandSafe={trend.brand_safe} />
        {trend.heatwave_days && trend.heatwave_days >= 2 ? <HeatwaveSticker days={trend.heatwave_days} onPhoto /> : null}
      </div>
      <h3 className="tr-story-title">{trend.title}</h3>
      <p className="tr-story-why">{trend.why}</p>
      <div className="tr-story-meta">
        <HeatBadge heat={trend.heat} />
        <span className="tr-cools">{coolsInLabel(trend.cools_in_days)}</span>
      </div>
    </div>
  );
}

/** Carte story 9:16 : photo thermique en haut (60 %), barres, pays, stickers, titre, why, degré, « cools in ». */
export function TrendCard(props: Props) {
  const { trend, top = false, linked = true, className = "" } = props;
  const inner = (
    <>
      <ThermalImage image={trend.image} alt={trend.title} category={trend.category} className="tr-story-photo" sizes="(max-width: 640px) 90vw, 300px" />
      <CardBody {...props} />
    </>
  );
  const cls = `tr-story ${top ? "top" : ""} ${className}`;
  return linked ? (
    <Link href={`/t/${trend.slug}`} className={cls} aria-label={`${trend.title}, ${trend.heat} degrees`}>
      {inner}
    </Link>
  ) : (
    <article className={cls} aria-label={`${trend.title}, ${trend.heat} degrees`}>
      {inner}
    </article>
  );
}

/** Tendance passée : photo en niveaux de gris, jamais de suggestion de poster. */
export function CooledCard({ trend, example = false, linked = true, className = "" }: Props) {
  const peak =
    trend.peak_heat != null && trend.peak_day ? `It peaked at ${trend.peak_heat}° on ${formatDay(trend.peak_day)}.` : "";
  const inner = (
    <>
      <ThermalImage image={trend.image} alt={trend.title} category={trend.category} variant="cooled" className="tr-story-photo" sizes="300px" />
      <div className="in">
        <div className="tr-bars" aria-hidden="true">
          <i />
        </div>
        <div className="tr-story-head">
          <span>Cooled</span>
          {example ? <span className="tr-example" style={{ color: "#f5f3ff" }}>Example</span> : null}
        </div>
        <h3 className="tr-story-title">{trend.title}</h3>
        <p className="tr-story-why">
          This trend has cooled. {peak}
        </p>
        <div className="tr-story-meta">
          <HeatBadge heat={trend.heat} cooled />
          <span className="tr-cools">archive</span>
        </div>
      </div>
    </>
  );
  const cls = `tr-story cooled ${className}`;
  return linked ? (
    <Link href={`/t/${trend.slug}`} className={cls}>
      {inner}
    </Link>
  ) : (
    <article className={cls}>{inner}</article>
  );
}
