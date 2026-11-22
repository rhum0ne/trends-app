import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { ArrowRight, Shuffle } from "lucide-react";
import { HeatBadge, HeatScale } from "@/components/HeatBadge";
import { ThermalImage } from "@/components/ThermalImage";
import { TrendCard, CooledCard } from "@/components/TrendCard";
import { TrendRow } from "@/components/TrendRow";
import { Forecast } from "@/components/Forecast";
import { HeatCurve } from "@/components/HeatCurve";
import { Ticker } from "@/components/Ticker";
import { Sticker, CategorySticker, SafetySticker, HeatwaveSticker } from "@/components/Sticker";
import { CountryTile } from "@/components/CountryTile";
import { Flag } from "@/components/Flag";
import { AngleCard } from "@/components/AngleCard";
import { Button, ButtonLink } from "@/components/Button";
import { PoweredBy } from "@/components/PoweredBy";
import { ApiSnippet } from "@/components/ApiSnippet";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/Logo";
import { EXAMPLE_COOLED, EXAMPLE_COUNTRIES, EXAMPLE_TRENDS } from "@/lib/examples";
import { getSampleImage } from "@/lib/trends/queries";
import type { TrendImage } from "@/lib/types";

export const metadata: Metadata = {
  title: "Styleguide · trends°",
  robots: { index: false, follow: false },
};

function Pair({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-line py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="tr-section-title">{title}</h2>
        {note ? <p className="tr-muted m-0 text-sm">{note}</p> : null}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {(["night", "day"] as const).map((t) => (
          <div key={t} data-theme={t} className="min-w-0 rounded-[14px] p-4" style={{ background: "var(--night)", boxShadow: "inset 0 0 0 1px var(--line)" }}>
            <p className="tr-example m-0 mb-3">{t} · Example</p>
            <div className="flex flex-wrap items-start gap-4">{children}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

async function Gallery() {
  // Une vraie photo déjà stockée si la base en a une ; sinon le repli sans photo (jamais d'illustration).
  let sample: TrendImage | null = null;
  try {
    sample = await getSampleImage();
  } catch {
    sample = null;
  }
  const trends = EXAMPLE_TRENDS.map((t, i) => (i < 3 ? { ...t, image: sample } : t));
  const [top, second, third] = trends;
  const cooled = { ...EXAMPLE_COOLED, image: sample };
  const rows = trends.map((t) => ({ ...t, history: t.history.map((h) => h.heat), subtitle: `${t.category} · Example` }));

  return (
    <>
      <p className="tr-muted m-0 text-sm">
        {sample
          ? "Photos: a real stored trend photo, shown through the thermal filter."
          : "No photo stored yet (run pnpm run:daily with a Pexels key): components show the no-photo fallback."}
      </p>

      <Pair title="logo, powered by" note="Logo in condensed Archivo, upTake pill on every page">
        <Logo />
        <PoweredBy />
      </Pair>

      <Pair title="ticker" note="Ticker · LIVE strip at the top of every page">
        <div className="w-full">
          <Ticker items={trends.map((t) => ({ slug: t.slug, title: t.title, heat: t.heat, heat_change: t.heat_change }))} />
        </div>
      </Pair>

      <Pair title="heat badge" note="HeatBadge · l0 to l4, xl, cooled">
        {[22, 47, 64, 81, 94].map((h) => (
          <HeatBadge key={h} heat={h} />
        ))}
        <HeatBadge heat={12} cooled />
        <HeatBadge heat={94} size="xl" />
        <div className="w-full">
          <HeatScale />
        </div>
      </Pair>

      <Pair title="stickers" note="Sticker · three at most per card">
        <CategorySticker category="gaming" />
        <SafetySticker brandSafe />
        <SafetySticker brandSafe={false} tilt="left" />
        <HeatwaveSticker days={4} />
        <Sticker variant="flat">Flat</Sticker>
        <Sticker variant="ghost">Ghost</Sticker>
      </Pair>

      <Pair title="flags" note="Flag · drawn SVG, 26×18 and 40×28, always with a code or name">
        {["US", "FR", "GB", "DE", "JP", "BR", "IN", "NG"].map((c) => (
          <span key={c} className="flex items-center gap-2 text-sm font-bold">
            <Flag code={c} size="lg" label={false} /> {c}
          </span>
        ))}
        <span className="flex items-center gap-2 text-sm">
          <Flag code="FR" size="sm" label={false} /> France
        </span>
      </Pair>

      <Pair title="buttons" note="Button · one primary per screen">
        <Button variant="primary">
          Read the trend <ArrowRight strokeWidth={1.75} aria-hidden="true" />
        </Button>
        <Button variant="ink">Write it in upTake</Button>
        <Button variant="line">
          <Shuffle strokeWidth={1.75} aria-hidden="true" /> Shuffle
        </Button>
        <ButtonLink href="/api" variant="line" small>
          Read the API docs
        </ButtonLink>
      </Pair>

      <Pair title="thermal image" note="ThermalImage · thermal, natural (admin preview), cooled">
        {(["thermal", "natural", "cooled"] as const).map((v) => (
          <div key={v} className="flex w-[200px] flex-col gap-2">
            <ThermalImage image={sample} alt="Example trend photo" category="gaming" variant={v} className="aspect-[4/3] w-full rounded-[14px]" sizes="200px" credit={v === "thermal"} />
            <span className="tr-muted text-xs">{v}</span>
          </div>
        ))}
      </Pair>

      <Pair title="trend card" note="TrendCard · story 9:16, top card has the only glow">
        <TrendCard trend={top} top index={0} total={3} example linked={false} />
        <TrendCard trend={second} index={1} total={3} example linked={false} />
      </Pair>

      <Pair title="cooled card" note="CooledCard · a trend that has passed">
        <CooledCard trend={cooled} example linked={false} />
        <TrendCard trend={third} index={2} total={3} example linked={false} />
      </Pair>

      <Pair title="trend row" note="TrendRow · chart list with rank, ▲ / ▼ / NEW, 7-day curve">
        <div className="tr-list">
          <TrendRow trend={rows[0]} rank={1} prevRank={3} />
          <TrendRow trend={rows[1]} rank={2} prevRank={1} />
          <TrendRow trend={rows[2]} rank={3} isNew />
          <TrendRow trend={rows[3]} rank={4} prevRank={4} />
        </div>
      </Pair>

      <Pair title="forecast" note="Forecast · 5 bars, best window to post">
        <Forecast forecast={top.forecast} startDay={top.day} best={top.best_window} example />
      </Pair>

      <Pair title="heat curve" note="HeatCurve · 7 measured days, 4 forecast days dashed">
        <HeatCurve measured={top.history} forecast={top.forecast.slice(1)} title={top.curve_title} example caption="Example caption: heat combines how many countries search it, how high, how many sources, and momentum." />
      </Pair>

      <Pair title="country tile" note="CountryTile · coloured by its hottest trend">
        <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
          {EXAMPLE_COUNTRIES.map((c, i) => (
            <CountryTile key={c.code} code={c.code} heat={c.heat} trendTitle={c.title} href="#" pressed={i === 0} />
          ))}
        </div>
      </Pair>

      <Pair title="angle card" note="AngleCard · Copy and Write it in upTake">
        <div className="grid w-full gap-4 sm:grid-cols-2">
          {top.angles.map((a, i) => (
            <AngleCard key={a.title} angle={a} image={sample} category={top.category} trendTitle={top.title} index={i} example />
          ))}
        </div>
      </Pair>

      <Pair title="api snippet" note="ApiSnippet · the only monospace in the interface">
        <ApiSnippet
          label="Example"
          request="curl https://trends.uptake.me/api/v1/trends/top"
          response={{ trend: { slug: "gta-vi", title: "gta vi", heat: 94, heat_level: "scorching" }, powered_by: { name: "upTake", url: "https://uptake.me/?ut=trends" } }}
        />
      </Pair>
    </>
  );
}

export default function StyleguidePage() {
  return (
    <main className="tr-wrap flex flex-col gap-2 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="tr-example m-0">Internal · noindex</p>
          <h1 className="tr-display m-0 text-[64px]">styleguide</h1>
          <p className="tr-muted m-0">Every component, in both themes, with example data.</p>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <PoweredBy />
        </div>
      </header>
      <Suspense fallback={<p className="tr-muted">Loading components…</p>}>
        <Gallery />
      </Suspense>
    </main>
  );
}
