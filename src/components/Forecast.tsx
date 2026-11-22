import { heatVar } from "@/lib/heat/levels";
import { addDays, weekdayLong, weekdayShort } from "@/lib/format";

interface Props {
  /** 5 valeurs : aujourd'hui puis les 4 jours suivants (docs/heat.md). */
  forecast: number[];
  /** Jour de forecast[0], YYYY-MM-DD. */
  startDay: string;
  /** Indices des jours conseillés (best window), 2 au plus. */
  best?: number[];
  title?: string;
  example?: boolean;
}

export function bestWindowLabel(best: number[], startDay: string): string {
  if (best.length === 0) return "today";
  const names = best.map((i) => (i === 0 ? "today" : i === 1 ? "tomorrow" : weekdayLong(addDays(startDay, i))));
  return names.join(" and ");
}

/** Prévision sur 5 jours : barres colorées par niveau, « best window to post ». */
export function Forecast({ forecast, startDay, best = [], title = "5-day forecast", example = false }: Props) {
  const label = bestWindowLabel(best, startDay);
  return (
    <section className="tr-forecast" aria-label={title}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="m-0 text-[15px] font-bold">{title}</h3>
        {example ? <span className="tr-example">Example</span> : null}
      </div>
      <p className="tr-muted m-0 mt-1 text-[13px]">
        Best window to post: <b className="text-ink">{label.charAt(0).toUpperCase() + label.slice(1)}</b>
      </p>
      <ol className="tr-days m-0 list-none p-0">
        {forecast.slice(0, 5).map((h, i) => {
          const day = addDays(startDay, i);
          return (
            <li key={day} className={`tr-day ${best.includes(i) ? "best" : ""}`}>
              <b>{h}°</b>
              <span className="t" aria-hidden="true">
                <i style={{ height: `${Math.max(6, h)}%`, background: heatVar(h) }} />
              </span>
              <span>{i === 0 ? "Today" : weekdayShort(day)}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
