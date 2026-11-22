import { ArrowRight } from "lucide-react";
import type { TrendView } from "@/lib/types";
import { ThermalImage } from "@/components/ThermalImage";
import { HeatBadge } from "@/components/HeatBadge";
import { CategorySticker, HeatwaveSticker, SafetySticker } from "@/components/Sticker";
import { ButtonLink } from "@/components/Button";
import { Flag } from "@/components/Flag";
import { countryName, formatDay } from "@/lib/format";

interface Props {
  trend: TrendView;
  trackedCountries: number;
  stale: boolean;
  label?: string;
}

export function heatChangeLabel(change: number, isNew: boolean): string {
  if (isNew) return "new today";
  if (change > 0) return `▲ ${change}° since yesterday`;
  if (change < 0) return `▼ ${Math.abs(change)}° since yesterday`;
  return "same as yesterday";
}

/** La tendance du moment en grand : photo thermique plein cadre, titre géant, degré, pays. */
export function TrendHero({ trend, trackedCountries, stale, label = "Right now · worldwide" }: Props) {
  const firstIn = trend.countries.filter((c) => c.rank === 1).length;
  const hottest = trend.countries.slice(0, 8);
  return (
    <section className="relative isolate overflow-hidden" aria-labelledby="hero-title">
      <ThermalImage image={trend.image} alt={trend.title} category={trend.category} className="absolute inset-0 -z-10" scrim="l" priority credit sizes="100vw" />
      <div className="tr-wrap flex min-h-[560px] flex-col justify-end gap-5 py-12 md:min-h-[640px]" style={{ color: "#f5f3ff" }}>
        <p className="m-0 text-sm font-bold tracking-wide uppercase">
          {label}
          {stale && trend.updated_at ? <span className="ml-2 font-normal normal-case opacity-80">Updated {formatDay(trend.day)}</span> : null}
        </p>
        <div className="flex flex-wrap gap-2">
          <CategorySticker category={trend.category} onPhoto />
          <SafetySticker brandSafe={trend.brand_safe} />
          <HeatwaveSticker days={trend.heatwave_days} onPhoto />
        </div>
        <h1 id="hero-title" className="tr-display m-0 max-w-5xl" style={{ fontSize: "clamp(96px, 16vw, 220px)", lineHeight: 0.82 }}>
          {trend.title}
        </h1>
        <p className="m-0 max-w-2xl text-lg leading-snug">{trend.why}</p>
        <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
          <HeatBadge heat={trend.heat} size="xl" />
          <div className="flex flex-col gap-2 pb-2">
            <span className="font-extrabold tr-num" style={{ color: trend.heat_change > 0 ? "var(--safe)" : "inherit" }}>
              {heatChangeLabel(trend.heat_change, trend.is_new)}
            </span>
            {firstIn > 0 && trackedCountries > 0 ? (
              <span className="flex flex-wrap items-center gap-2 text-sm">
                <span className="tr-num">
                  #1 in {firstIn} of {trackedCountries} countries
                </span>
                {hottest.map((c) => (
                  <span key={c.code} className="flex items-center gap-1" title={countryName(c.code)}>
                    <Flag code={c.code} size="sm" label={false} />
                    <span className="text-xs font-bold">{c.code}</span>
                  </span>
                ))}
              </span>
            ) : hottest.length ? (
              <span className="flex flex-wrap items-center gap-2 text-sm">
                {hottest.map((c) => (
                  <span key={c.code} className="flex items-center gap-1">
                    <Flag code={c.code} size="sm" label={false} />
                    <span className="text-xs font-bold">{c.code}</span>
                  </span>
                ))}
              </span>
            ) : (
              <span className="text-sm">Worldwide</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={`/t/${trend.slug}`} variant="primary">
            Read the trend <ArrowRight strokeWidth={1.75} aria-hidden="true" />
          </ButtonLink>
          {trend.angles.length > 0 ? (
            <ButtonLink href={`/t/${trend.slug}#angles`} variant="line" onPhoto>
              {trend.angles.length} ways to post about it
            </ButtonLink>
          ) : null}
        </div>
      </div>
    </section>
  );
}
