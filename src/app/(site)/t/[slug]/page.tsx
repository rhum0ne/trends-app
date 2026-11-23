import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { ArrowRight, ExternalLink } from "lucide-react";
import { getRelated, getTrend, getCountries, trendDaysPresent } from "@/lib/trends/queries";
import { ThermalImage } from "@/components/ThermalImage";
import { HeatBadge } from "@/components/HeatBadge";
import { CategorySticker, HeatwaveSticker, SafetySticker } from "@/components/Sticker";
import { ButtonLink } from "@/components/Button";
import { TrendCard, CooledCard } from "@/components/TrendCard";
import { HeatCurve } from "@/components/HeatCurve";
import { AngleCard } from "@/components/AngleCard";
import { Flag } from "@/components/Flag";
import { ShareButton } from "@/components/site/ShareButton";
import { ReportDialog } from "@/components/site/ReportDialog";
import { heatChangeLabel } from "@/components/site/TrendHero";
import { CATEGORY_LABEL, countryName, coolsInLabel, formatDay, pageTitle } from "@/lib/format";
import { heatVar } from "@/lib/heat/levels";
import { GOOGLE_TRENDS_URL, SITE_URL } from "@/lib/links";
import type { TrendView } from "@/lib/types";
import { JsonLd } from "@/components/JsonLd";
import { trendJsonLd } from "@/lib/seo/jsonld";

export async function generateMetadata({ params }: PageProps<"/t/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const trend = await getTrend(slug);
  if (!trend) return { title: "Trend not found · trends°", robots: { index: false } };
  const days = await trendDaysPresent(trend.id);
  return {
    title: trend.cooled ? pageTitle(trend.title, "has cooled") : pageTitle(trend.title),
    description: trend.why,
    alternates: { canonical: `/t/${trend.slug}` },
    // noindex tant que la tendance n'a pas été présente au moins 2 jours (docs/pages.md)
    robots: days >= 2 ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: { title: `${trend.title} · trends°`, description: trend.why, url: `/t/${trend.slug}`, type: "article" },
    twitter: { card: "summary_large_image" },
  };
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-bold tracking-wide uppercase opacity-80">{label}</span>
      <span className="tr-num text-2xl font-extrabold" style={color ? { color } : undefined}>
        {value}
      </span>
    </div>
  );
}

function SectionTitle({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="tr-section-title scroll-mt-16">
      {children}
    </h2>
  );
}

function Signals({ trend }: { trend: TrendView }) {
  const f = trend.factors ?? {};
  const rows = [
    { label: "search", value: f.search },
    { label: "Wikipedia reading", value: f.wikipedia },
    { label: "tech news", value: f.news },
  ].filter((r) => typeof r.value === "number" && r.value > 0);
  return (
    <div className="flex flex-col gap-4">
      <ul className="m-0 flex list-none flex-wrap gap-3 p-0">
        {rows.map((r) => (
          <li key={r.label} className="rounded-[14px] bg-surface px-4 py-3">
            <span className="tr-num text-xl font-extrabold">
              {r.value! >= 1 ? "▲" : "▼"} ×{r.value}
            </span>
            <span className="tr-muted block text-sm">{r.label}, vs its 7-day average</span>
          </li>
        ))}
        {trend.top3_countries > 0 ? (
          <li className="rounded-[14px] bg-surface px-4 py-3">
            <span className="tr-num text-xl font-extrabold">{trend.top3_countries}</span>
            <span className="tr-muted block text-sm">countries where it&apos;s in the top 3 searches</span>
          </li>
        ) : null}
      </ul>
      <p className="tr-muted m-0 text-sm">
        Updated {trend.updated_at ? new Date(trend.updated_at).toUTCString().replace(" GMT", " UTC") : formatDay(trend.day)}. Data source:{" "}
        <a href={GOOGLE_TRENDS_URL} target="_blank" rel="noopener">
          Google Trends
        </a>
        , Wikipedia, Bluesky and Hacker News (heat computed by trends°).
      </p>
      {trend.sources.length ? (
        <div>
          <h3 className="m-0 mb-2 text-base font-bold">Sources of the analysis</h3>
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
            {trend.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener" className="inline-flex items-center gap-1">
                  {s.title} <ExternalLink className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

async function TrendContent({ slug }: { slug: string }) {
  await connection();
  const trend = await getTrend(slug);
  if (!trend) notFound();
  const [related, { countries: tracked }] = await Promise.all([getRelated(trend), getCountries()]);
  const pageUrl = `${SITE_URL}/t/${trend.slug}`;
  const cardUrl = `/t/${trend.slug}/card`;
  const cooled = trend.cooled;
  const cat = CATEGORY_LABEL[trend.category] ?? trend.category;

  return (
    <>
      <JsonLd data={trendJsonLd(trend)} />
      <nav aria-label="Breadcrumb" className="tr-wrap py-3 text-sm">
        <ol className="tr-muted m-0 flex list-none flex-wrap gap-2 p-0">
          <li>
            <Link href="/">Today</Link> /
          </li>
          <li>{cat} /</li>
          <li aria-current="page" className="text-ink">
            {trend.title}
          </li>
        </ol>
      </nav>

      <section className="relative isolate overflow-hidden" aria-labelledby="trend-title">
        <ThermalImage image={trend.image} alt={trend.title} category={trend.category} variant={cooled ? "cooled" : "thermal"} className="absolute inset-0 -z-10" scrim="l" priority credit />
        <div className="tr-wrap tr-on-photo grid items-end gap-8 py-12 lg:grid-cols-[1fr_300px]">
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap gap-2">
              <CategorySticker category={trend.category} onPhoto />
              {!cooled ? <SafetySticker brandSafe={trend.brand_safe} /> : null}
              {!cooled ? <HeatwaveSticker days={trend.heatwave_days} onPhoto /> : null}
            </div>
            <h1 id="trend-title" className="tr-display m-0" style={{ fontSize: "clamp(80px, 13vw, 180px)", lineHeight: 0.82 }}>
              {trend.title}
            </h1>
            <p className="m-0 max-w-2xl text-lg">
              {cooled ? `This trend has cooled.${trend.peak_heat != null && trend.peak_day ? ` It peaked at ${trend.peak_heat}° on ${formatDay(trend.peak_day)}.` : ""}` : trend.why}
            </p>
            <div className="grid max-w-2xl grid-cols-2 gap-5 sm:grid-cols-4">
              <Stat label="Heat" value={`${trend.heat}°`} color={cooled ? "var(--cooled)" : heatVar(trend.heat)} />
              <Stat label="Since yesterday" value={heatChangeLabel(trend.heat_change, trend.is_new).replace(" since yesterday", "")} />
              <Stat label="First seen" value={formatDay(trend.first_seen)} />
              <Stat label="Cools" value={cooled ? "cooled" : coolsInLabel(trend.cools_in_days).replace("cools in ", "")} />
            </div>
            <div className="flex flex-wrap gap-3">
              {cooled ? (
                <ButtonLink href="/" variant="primary">
                  See today&apos;s forecast <ArrowRight strokeWidth={1.75} aria-hidden="true" />
                </ButtonLink>
              ) : (
                <>
                  {trend.angles.length ? (
                    <ButtonLink href="#angles" variant="primary">
                      See {trend.angles.length} post angles <ArrowRight strokeWidth={1.75} aria-hidden="true" />
                    </ButtonLink>
                  ) : null}
                  <ShareButton cardUrl={cardUrl} pageUrl={pageUrl} title={trend.title} onPhoto />
                </>
              )}
            </div>
          </div>
          <div className="hidden justify-self-end lg:block">
            {cooled ? <CooledCard trend={trend} linked={false} /> : <TrendCard trend={trend} top={trend.is_top} linked={false} />}
          </div>
        </div>
      </section>

      <div className="tr-wrap flex flex-col gap-16 pt-12">
        <section aria-labelledby="curve">
          <HeatCurve
            measured={trend.history}
            forecast={cooled ? [] : trend.forecast.slice(1)}
            title={cooled ? "it has cooled" : trend.curve_title}
            caption="Heat mixes how many countries search it, how high it ranks there, how many sources mention it, and how fast it rises. The dashed line is our forecast."
          />
        </section>

        {trend.countries.length ? (
          <section aria-labelledby="where" className="flex flex-col gap-4">
            <SectionTitle id="where">where it&apos;s hot</SectionTitle>
            <ul className="m-0 grid list-none gap-2 p-0 md:grid-cols-2">
              {trend.countries.slice(0, 8).map((c) => (
                <li key={c.code} className="grid grid-cols-[28px_1fr_auto] items-center gap-3 rounded-[14px] bg-surface px-3 py-2">
                  <Flag code={c.code} size="sm" label={false} />
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="truncate text-sm font-bold">
                      {countryName(c.code)} {c.rank > 1 ? <span className="tr-muted font-normal">· #{c.rank} there</span> : null}
                    </span>
                    <span className="h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                      <span className="block h-full rounded-full" style={{ width: `${c.heat}%`, background: heatVar(c.heat) }} />
                    </span>
                  </div>
                  <span className="tr-num font-extrabold">{c.heat}°</span>
                </li>
              ))}
            </ul>
            <p className="tr-muted m-0 text-sm">
              {trend.countries.length} of {tracked.length} countries.{" "}
              <Link href="/c" className="font-bold text-ink">
                All countries →
              </Link>{" "}
              Data source:{" "}
              <a href={GOOGLE_TRENDS_URL} target="_blank" rel="noopener">
                Google Trends
              </a>
            </p>
          </section>
        ) : null}

        {trend.audiences.length ? (
          <section aria-labelledby="audiences" className="flex flex-col gap-4">
            <div className="flex items-baseline gap-3">
              <SectionTitle id="audiences">audiences</SectionTitle>
              <span className="tr-example">estimated</span>
            </div>
            <ul className="m-0 flex max-w-2xl list-none flex-col gap-3 p-0">
              {trend.audiences.map((a) => (
                <li key={a.label} className="flex flex-col gap-1">
                  <span className="flex justify-between text-sm font-bold">
                    {a.label} <span className="tr-num">{a.share}%</span>
                  </span>
                  <span className="h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                    <span className="block h-full rounded-full bg-ink" style={{ width: `${a.share}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {!cooled && trend.angles.length ? (
          <section aria-labelledby="angles" className="flex flex-col gap-4">
            <SectionTitle id="angles">{trend.angles.length} ways to post about it</SectionTitle>
            <p className="tr-muted m-0">Talk about the moment, not the brand.</p>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {trend.angles.map((a, i) => (
                <AngleCard key={a.title} angle={a} image={trend.image} category={trend.category} trendTitle={trend.title} index={i} />
              ))}
            </div>
          </section>
        ) : null}

        <section aria-labelledby="safety" className="flex flex-col gap-4">
          <SectionTitle id="safety">brand safety</SectionTitle>
          <div>
            <SafetySticker brandSafe={trend.brand_safe} tilt="flat" />
          </div>
          <ul className="m-0 flex max-w-2xl flex-col gap-2 pl-5">
            <li>Talk about the moment and the conversation around it, from your product&apos;s point of view.</li>
            <li>No logo, official visual, screenshot or character from the brands involved.</li>
            <li>Don&apos;t imply a partnership or an endorsement.</li>
            {trend.risk ? <li className="font-bold">{trend.risk}</li> : null}
          </ul>
          <ReportDialog slug={trend.slug} label="Report this trend" />
        </section>

        <section aria-labelledby="signals" className="flex flex-col gap-4">
          <SectionTitle id="signals">signals</SectionTitle>
          <Signals trend={trend} />
        </section>

        {related.length ? (
          <section aria-labelledby="related" className="flex flex-col gap-4">
            <SectionTitle id="related">related trends</SectionTitle>
            <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-3">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link href={`/t/${r.slug}`} className="flex items-center gap-3 rounded-[14px] bg-surface p-3 no-underline hover:bg-surface-2">
                    <ThermalImage image={r.image} alt={r.title} category={r.category} className="h-16 w-16 flex-none rounded-[10px]" sizes="64px" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <b className="truncate">{r.title}</b>
                      <span className="tr-muted text-xs">{CATEGORY_LABEL[r.category]}</span>
                    </span>
                    <HeatBadge heat={r.heat} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}

async function FromParams({ params }: { params: PageProps<"/t/[slug]">["params"] }) {
  const { slug } = await params;
  return <TrendContent slug={slug} />;
}

export default function TrendPage({ params }: PageProps<"/t/[slug]">) {
  return (
    <Suspense
      fallback={
        <div className="tr-wrap py-24">
          <p className="tr-muted">Loading the forecast…</p>
        </div>
      }
    >
      <FromParams params={params} />
    </Suspense>
  );
}
