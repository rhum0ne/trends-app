import { HeatScale } from "@/components/HeatBadge";
import { ButtonLink } from "@/components/Button";
import { AutoRefresh } from "./AutoRefresh";
import { forecastStatus, type RunSummary } from "@/lib/pipeline/schedule";

// Écran d'accueil sans aucune prévision publiée (premier jour, ou base vide) : dit ce qui se passe vraiment,
// avec les mêmes règles que le superviseur, explique le produit et se met à jour tout seul.

function clock(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
}

function when(date: Date): string {
  return `${clock(date, "Europe/Paris")} Paris time (${clock(date, "UTC")} UTC)`;
}

const STEPS = [
  {
    title: "signals",
    text: "Every morning we read what people search, read and discuss: Google Trends, Wikipedia, Bluesky and Hacker News.",
  },
  {
    title: "analysis",
    text: "Each rising topic is checked against the news: why it's heating up, how long it should last, and whether a brand can use it safely.",
  },
  {
    title: "forecast",
    text: "Each trend gets a temperature, a 5-day forecast, the countries where it's hot, and 2 or 3 post angles for your product.",
  },
];

export function EmptyForecast({ runs, now }: { runs: RunSummary[]; now: Date }) {
  const status = forecastStatus(now, runs);
  const copy =
    status.state === "running" || status.state === "ready"
      ? {
          label: "Forecast in progress",
          text: "We're reading today's signals and checking every trend. It usually lands within a few minutes; this page updates by itself.",
          refresh: 30,
        }
      : status.state === "scheduled"
        ? {
            label: "Next forecast",
            text: `The next forecast lands at ${when(status.nextAt)}. Every morning we publish the trends of the day and how to use them for your product.`,
            refresh: 300,
          }
        : status.state === "retrying"
          ? {
              label: "Running late",
              text: `Today's forecast is running late. Next attempt around ${when(status.nextAt)}; this page updates by itself.`,
              refresh: 60,
            }
          : {
              label: "Delayed",
              text: "Today's forecast couldn't be prepared. The next one lands tomorrow at 06:30 Paris time (05:30 UTC).",
              refresh: 600,
            };

  return (
    <div className="tr-wrap flex flex-col gap-16 py-16">
      <AutoRefresh seconds={copy.refresh} />
      <section className="flex min-h-[44vh] flex-col justify-center gap-5" aria-labelledby="empty-title">
        <p className="m-0 inline-flex items-center gap-2 self-start rounded-full border border-line px-3 py-1 text-xs font-bold uppercase tracking-wide" role="status">
          <span className={`tr-status-dot${status.state === "running" ? " pulse" : ""}`} aria-hidden="true" />
          {copy.label}
        </p>
        <h1 id="empty-title" className="tr-display m-0 text-[clamp(64px,10vw,140px)]">
          today&apos;s forecast
        </h1>
        <p className="m-0 max-w-2xl text-lg">{copy.text}</p>
        <div className="flex flex-wrap gap-3 pt-2">
          <ButtonLink href="/api" variant="primary">
            Explore the API
          </ButtonLink>
        </div>
      </section>

      <section className="flex flex-col gap-6" aria-labelledby="how-title">
        <h2 id="how-title" className="tr-section-title">
          how it works
        </h2>
        <ol className="m-0 grid list-none gap-4 p-0 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex flex-col gap-2 rounded-[20px] border border-line bg-surface p-6">
              <span className="tr-muted text-sm font-bold tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="tr-display m-0 text-[40px]">{s.title}</h3>
              <p className="tr-muted m-0">{s.text}</p>
            </li>
          ))}
        </ol>
        <div className="flex max-w-xl flex-col gap-2">
          <p className="m-0 text-sm font-bold">How hot is hot</p>
          <HeatScale />
        </div>
      </section>
    </div>
  );
}
