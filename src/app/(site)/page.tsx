import Link from "next/link";
import { Suspense } from "react";
import { headers } from "next/headers";
import { connection } from "next/server";
import { BookOpen } from "lucide-react";
import { TrendHero } from "@/components/site/TrendHero";
import { ShuffleCards } from "@/components/site/ShuffleCards";
import { ByCountry, type CountryPanelData } from "@/components/site/ByCountry";
import { Forecast } from "@/components/Forecast";
import { HeatScale } from "@/components/HeatBadge";
import { TrendRow } from "@/components/TrendRow";
import { ButtonLink } from "@/components/Button";
import { ApiSnippet } from "@/components/ApiSnippet";
import { getCountries, getDailyTrends, getTodayRuns, getWeekly } from "@/lib/trends/queries";
import { EmptyForecast } from "@/components/site/EmptyForecast";
import { CATEGORY_LABEL, countryName } from "@/lib/format";
import { SITE_URL } from "@/lib/links";
import type { TrendView } from "@/lib/types";

function Section({ id, title, children, aside }: { id?: string; title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section id={id} className="tr-wrap tr-snap flex flex-col gap-6 py-8" aria-labelledby={id ? `${id}-title` : undefined}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id={id ? `${id}-title` : undefined} className="tr-section-title">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function rowOf(t: TrendView, subtitle?: string) {
  return {
    slug: t.slug,
    title: t.title,
    category: t.category,
    heat: t.heat,
    image: t.image,
    history: t.history.map((h) => h.heat),
    subtitle: subtitle ?? `${CATEGORY_LABEL[t.category] ?? t.category}${t.countries.length ? ` · ${t.countries.slice(0, 3).map((c) => c.code).join(" ")}` : ""}`,
  };
}

async function HomeContent() {
  await connection();
  const [{ day, stale, trends }, countriesRes, weekly, hdrs] = await Promise.all([getDailyTrends(), getCountries(), getWeekly({ limit: 8 }), headers()]);
  const top = trends.find((t) => t.is_top) ?? trends[0];
  if (!top || !day) return <EmptyForecast runs={await getTodayRuns()} now={new Date()} />;
  const others = trends.filter((t) => t.id !== top.id);
  const tracked = countriesRes.countries.length;

  // 12 pays les plus actifs ; celui du visiteur sélectionné par défaut (en-tête Cloudflare, jamais stocké)
  const active = countriesRes.countries.filter((c) => c.trend).slice(0, 12);
  const panel: CountryPanelData[] = active.map((c) => {
    const inCountry = trends
      .map((t) => ({ t, c: t.countries.find((x) => x.code === c.code) }))
      .filter((x) => x.c)
      .sort((a, b) => b.c!.heat - a.c!.heat)
      .slice(0, 3);
    return {
      code: c.code,
      name: countryName(c.code),
      heat: c.trend?.heat ?? null,
      top: inCountry.map((x, i) => ({ ...rowOf(x.t), heat: x.c!.heat, rank: i + 1 })),
    };
  });
  const visitor = (hdrs.get("cf-ipcountry") ?? "").toUpperCase();
  const initial = panel.some((p) => p.code === visitor) ? visitor : "US";

  return (
    <>
      <TrendHero trend={top} trackedCountries={tracked} stale={stale} />

      <section className="tr-wrap tr-snap grid gap-6 py-8 md:grid-cols-[1.2fr_1fr]" aria-label="Forecast">
        <Forecast forecast={top.forecast} startDay={day} best={top.best_window} title={`${top.title}: 5-day forecast`} />
        <div className="tr-forecast flex flex-col justify-center gap-3">
          <h3 className="m-0 text-[15px] font-bold">How hot is hot?</h3>
          <HeatScale />
          <p className="tr-muted m-0 text-[13px]">Heat mixes how many countries search a topic, how high it ranks, how many sources talk about it, and how fast it rises.</p>
        </div>
      </section>

      {others.length > 0 ? (
        <Section title="also heating up">
          <ShuffleCards trends={others} />
        </Section>
      ) : null}

      {panel.length > 0 ? (
        <Section
          id="countries"
          title="by country"
          aside={
            <Link href="/c" className="font-bold">
              All {tracked} countries →
            </Link>
          }
        >
          <p className="tr-muted m-0 -mt-3">The world in thermal: each country takes the colour of its hottest trend.</p>
          <ByCountry countries={panel} initial={initial} />
        </Section>
      ) : null}

      {weekly.entries.length > 0 ? (
        <Section id="week" title="this week, worldwide">
          <div className="tr-list">
            {weekly.entries.map((e) => (
              <TrendRow key={e.view.slug} trend={rowOf(e.view)} rank={e.rank} prevRank={e.prevRank} isNew={e.prevRank === null} />
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="the forecast, as json">
        <div className="grid items-start gap-6 md:grid-cols-[1fr_1.3fr]">
          <div className="flex flex-col gap-4">
            <p className="m-0 text-lg">Every trend, its heat, forecast and post angles, in one call. Free with a credit to upTake.</p>
            <ButtonLink href="/api" variant="ink">
              <BookOpen strokeWidth={1.75} aria-hidden="true" /> Read the API docs
            </ButtonLink>
          </div>
          <ApiSnippet
            request={`curl ${SITE_URL}/api/v1/trends/top`}
            response={{ day, trend: { slug: top.slug, title: top.title, heat: top.heat, heat_level: top.heat_level, forecast: top.forecast }, powered_by: { name: "upTake" } }}
          />
        </div>
      </Section>
    </>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="tr-wrap py-24">
          <p className="tr-muted">Loading today&apos;s forecast…</p>
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
