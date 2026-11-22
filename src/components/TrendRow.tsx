import Link from "next/link";
import type { TrendImage } from "@/lib/types";
import { HeatBadge } from "./HeatBadge";
import { ThermalImage } from "./ThermalImage";
import { heatVar } from "@/lib/heat/levels";

export interface RowTrend {
  slug: string;
  title: string;
  category: string;
  heat: number;
  image: TrendImage | null;
  history: number[];
  subtitle?: string;
}

export function Sparkline({ values, label }: { values: number[]; label?: string }) {
  const vals = values.length > 1 ? values : [values[0] ?? 0, values[0] ?? 0];
  const w = 84;
  const h = 28;
  const x = (i: number) => 2 + (i * (w - 4)) / (vals.length - 1);
  const y = (v: number) => 3 + ((100 - Math.max(0, Math.min(100, v))) * (h - 6)) / 100;
  const d = vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = vals.at(-1) ?? 0;
  return (
    <svg className="tr-spark" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label ?? `Last ${vals.length} days: ${vals.join(", ")}`}>
      <path d={d} />
      <circle className="dot" cx={x(vals.length - 1)} cy={y(last)} r="3.5" fill={heatVar(last)} />
    </svg>
  );
}

function Delta({ rank, prevRank, isNew }: { rank: number; prevRank: number | null | undefined; isNew: boolean }) {
  if (isNew || prevRank === null) return <span className="tr-delta new">NEW</span>;
  // Rang de la veille inconnu : pas de flèche plutôt qu'une flèche fausse
  if (prevRank === undefined) return null;
  const diff = prevRank - rank;
  if (diff > 0) return <span className="tr-delta up" aria-label={`up ${diff}`}>▲{diff}</span>;
  if (diff < 0) return <span className="tr-delta down" aria-label={`down ${-diff}`}>▼{-diff}</span>;
  return <span className="tr-delta same" aria-label="no change">–</span>;
}

/** Ligne du classement façon hit-parade : rang, ▲ / ▼ / NEW, vignette, nom, courbe 7 jours, degré. */
export function TrendRow({
  trend,
  rank,
  prevRank,
  isNew = false,
}: {
  trend: RowTrend;
  rank: number;
  /** Rang de la veille ; null = nouveau ; absent = inconnu (pas de flèche). */
  prevRank?: number | null;
  isNew?: boolean;
}) {
  return (
    <Link href={`/t/${trend.slug}`} className="tr-row">
      <span className="tr-rank">
        {rank}
        <Delta rank={rank} prevRank={prevRank} isNew={isNew} />
      </span>
      <ThermalImage image={trend.image} alt={trend.title} category={trend.category} className="tr-thumb" sizes="46px" />
      <span className="tr-name">
        <b>{trend.title}</b>
        <span>{trend.subtitle ?? trend.category}</span>
      </span>
      <Sparkline values={trend.history} />
      <HeatBadge heat={trend.heat} />
    </Link>
  );
}
