import { addDays, weekdayShort } from "@/lib/format";

interface Props {
  /** 7 jours mesurés, du plus ancien au jour J (inclus). */
  measured: { day: string; heat: number }[];
  /** 4 jours prévus après J. */
  forecast: number[];
  title: string;
  caption?: string;
  example?: boolean;
}

const W = 720;
const H = 260;
const PAD = { l: 36, r: 16, t: 16, b: 30 };
const MARKS = [40, 60, 75, 90];

/**
 * Courbe de chaleur écrite à la main (pas de bibliothèque, CLAUDE.md § 4) :
 * 7 jours mesurés (trait coloré par l'échelle thermique, aire légère) + 4 jours prévus en pointillés.
 */
export function HeatCurve({ measured, forecast, title, caption, example = false }: Props) {
  const lastDay = measured.at(-1)?.day;
  const points = [
    ...measured.map((m) => ({ day: m.day, heat: m.heat, f: false })),
    ...forecast.slice(0, 4).map((h, i) => ({ day: lastDay ? addDays(lastDay, i + 1) : "", heat: h, f: true })),
  ];
  const n = Math.max(points.length, 2);
  const x = (i: number) => PAD.l + (i * (W - PAD.l - PAD.r)) / (n - 1);
  const y = (h: number) => PAD.t + ((100 - Math.max(0, Math.min(100, h))) * (H - PAD.t - PAD.b)) / 100;
  const mCount = measured.length;
  const mPts = points.slice(0, mCount);
  const fPts = points.slice(Math.max(0, mCount - 1));
  const path = (pts: typeof points, offset: number) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(i + offset).toFixed(1)},${y(p.heat).toFixed(1)}`).join(" ");
  const measuredPath = path(mPts, 0);
  const forecastPath = path(fPts, Math.max(0, mCount - 1));
  const area = mPts.length > 1 ? `${measuredPath} L${x(mCount - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z` : "";
  const fStartX = x(Math.max(0, mCount - 1));
  const summary = `${title}. Measured: ${mPts.map((p) => `${p.heat}°`).join(", ")}. Forecast: ${forecast
    .slice(0, 4)
    .map((h) => `${h}°`)
    .join(", ")}.`;

  return (
    <figure className="m-0 flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="tr-display m-0 text-[32px]">{title}</h3>
        <div className="flex items-center gap-4 text-xs">
          {example ? <span className="tr-example">Example</span> : null}
          <span className="flex items-center gap-2">
            <svg width="22" height="6" aria-hidden="true">
              <line x1="0" y1="3" x2="22" y2="3" stroke="var(--heat-3)" strokeWidth="3" strokeLinecap="round" />
            </svg>
            Measured
          </span>
          <span className="flex items-center gap-2">
            <svg width="22" height="6" aria-hidden="true">
              <line x1="0" y1="3" x2="22" y2="3" stroke="var(--ink-muted)" strokeWidth="2.5" strokeDasharray="4 4" />
            </svg>
            Forecast
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={summary}>
        <defs>
          {/* Dégradé vertical aligné sur les seuils : la couleur du trait dit le niveau de chaleur */}
          <linearGradient id="hc-stroke" gradientUnits="userSpaceOnUse" x1="0" y1={y(0)} x2="0" y2={y(100)}>
            <stop offset="0%" stopColor="var(--heat-0)" />
            <stop offset="40%" stopColor="var(--heat-1)" />
            <stop offset="60%" stopColor="var(--heat-2)" />
            <stop offset="75%" stopColor="var(--heat-3)" />
            <stop offset="90%" stopColor="var(--heat-4)" />
            <stop offset="100%" stopColor="var(--heat-4)" />
          </linearGradient>
          <linearGradient id="hc-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--heat-3)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--heat-3)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect x={fStartX} y={PAD.t} width={W - PAD.r - fStartX} height={H - PAD.t - PAD.b} fill="var(--surface-2)" rx="8" />
        {MARKS.map((m) => (
          <g key={m}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(m)} y2={y(m)} stroke="var(--line)" strokeDasharray="2 6" />
            <text x={PAD.l - 8} y={y(m) + 4} textAnchor="end" fontSize="11" fill="var(--ink-muted)">
              {m}°
            </text>
          </g>
        ))}
        {area ? <path d={area} fill="url(#hc-area)" /> : null}
        {mPts.length > 1 ? (
          <path d={measuredPath} fill="none" stroke="url(#hc-stroke)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        ) : null}
        {fPts.length > 1 ? (
          <path d={forecastPath} fill="none" stroke="var(--ink-muted)" strokeWidth="2.5" strokeDasharray="6 6" strokeLinecap="round" />
        ) : null}
        {points.map((p, i) => (
          <g key={`${p.day}-${i}`}>
            {i === mCount - 1 ? <circle cx={x(i)} cy={y(p.heat)} r="6" fill="var(--heat-4)" stroke="var(--night)" strokeWidth="2" /> : null}
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill={p.f ? "var(--ink-muted)" : "var(--ink)"}>
              {i === mCount - 1 ? "Today" : p.day ? weekdayShort(p.day) : ""}
            </text>
          </g>
        ))}
      </svg>
      {caption ? <figcaption className="tr-muted m-0 text-sm">{caption}</figcaption> : null}
    </figure>
  );
}
