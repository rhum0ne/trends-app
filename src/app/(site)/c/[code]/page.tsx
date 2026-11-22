import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { Flag } from "@/components/Flag";
import { ThermalImage } from "@/components/ThermalImage";
import { HeatBadge } from "@/components/HeatBadge";
import { TrendRow } from "@/components/TrendRow";
import { CategorySticker, SafetySticker } from "@/components/Sticker";
import { countryDataDays, getDailyTrends, getWeekly } from "@/lib/trends/queries";
import { CATEGORY_LABEL, countryName } from "@/lib/format";
import { GOOGLE_TRENDS_URL } from "@/lib/links";

function validCode(code: string): string | null {
  const c = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return null;
  return countryName(c) !== c ? c : null;
}

export async function generateMetadata({ params }: PageProps<"/c/[code]">): Promise<Metadata> {
  const { code } = await params;
  const cc = validCode(code);
  if (!cc) return { title: "Country not found · trends°", robots: { index: false } };
  const days = await countryDataDays(cc);
  return {
    title: `What's heating up in ${countryName(cc)} · trends°`.slice(0, 60),
    description: `Today's hottest trends in ${countryName(cc)}, and this week's chart.`,
    alternates: { canonical: `/c/${cc.toLowerCase()}` },
    // noindex tant que le pays n'a pas 7 jours de données (docs/pages.md)
    robots: days >= 7 ? { index: true, follow: true } : { index: false, follow: true },
  };
}

async function CountryContent({ params }: { params: PageProps<"/c/[code]">["params"] }) {
  const { code } = await params;
  const cc = validCode(code);
  if (!cc) notFound();
  await connection();
  const [{ trends }, weekly] = await Promise.all([getDailyTrends({ country: cc }), getWeekly({ country: cc, limit: 10 })]);
  const name = countryName(cc);
  const heatIn = (t: (typeof trends)[number]) => t.countries.find((c) => c.code === cc)?.heat ?? 0;
  const top = trends[0];
  return (
    <div className="tr-wrap flex flex-col gap-10 py-10">
      <div className="flex items-center gap-4">
        <Flag code={cc} size="lg" label={false} />
        <h1 className="tr-display m-0 text-[clamp(56px,9vw,110px)]">{name}</h1>
      </div>

      {top ? (
        <Link href={`/t/${top.slug}`} className="relative isolate block overflow-hidden rounded-[24px] no-underline" style={{ color: "#f5f3ff" }}>
          <ThermalImage image={top.image} alt={top.title} category={top.category} className="absolute inset-0 -z-10" scrim="l" sizes="(max-width: 1240px) 100vw, 1180px" credit />
          <div className="flex min-h-[300px] flex-col justify-end gap-3 p-6">
            <p className="m-0 text-sm font-bold uppercase">#1 in {name} today</p>
            <div className="flex gap-2">
              <CategorySticker category={top.category} onPhoto />
              <SafetySticker brandSafe={top.brand_safe} />
            </div>
            <h2 className="tr-display m-0 text-[clamp(56px,9vw,120px)]">{top.title}</h2>
            <p className="m-0 max-w-xl">{top.why}</p>
            <HeatBadge heat={heatIn(top)} size="xl" />
          </div>
        </Link>
      ) : (
        <p className="tr-muted">None of today&apos;s trends is heating up in {name} yet.</p>
      )}

      {trends.length ? (
        <section className="flex flex-col gap-4">
          <h2 className="tr-section-title">today in {name.toLowerCase()}</h2>
          <div className="tr-list">
            {trends.slice(0, 10).map((t, i) => (
              <TrendRow
                key={t.slug}
                rank={i + 1}
                isNew={t.is_new}
                trend={{ slug: t.slug, title: t.title, category: t.category, heat: heatIn(t), image: t.image, history: t.history.map((h) => h.heat), subtitle: CATEGORY_LABEL[t.category] }}
              />
            ))}
          </div>
        </section>
      ) : null}

      {weekly.entries.length ? (
        <section className="flex flex-col gap-4">
          <h2 className="tr-section-title">this week in {name.toLowerCase()}</h2>
          <div className="tr-list">
            {weekly.entries.map((e) => (
              <TrendRow
                key={e.view.slug}
                rank={e.rank}
                prevRank={e.prevRank}
                isNew={e.prevRank === null}
                trend={{ slug: e.view.slug, title: e.view.title, category: e.view.category, heat: Math.round(e.average), image: e.view.image, history: e.view.history.map((h) => h.heat), subtitle: `${CATEGORY_LABEL[e.view.category]} · 7-day average` }}
              />
            ))}
          </div>
        </section>
      ) : null}

      <p className="tr-muted m-0 text-sm">
        Country heat is computed by trends° from{" "}
        <a href={GOOGLE_TRENDS_URL} target="_blank" rel="noopener">
          Google Trends
        </a>{" "}
        data (Data source: Google Trends). <Link href="/c">All countries →</Link>
      </p>
    </div>
  );
}

export default function CountryPage({ params }: PageProps<"/c/[code]">) {
  return (
    <Suspense fallback={<div className="tr-wrap py-24 tr-muted">Loading…</div>}>
      <CountryContent params={params} />
    </Suspense>
  );
}
