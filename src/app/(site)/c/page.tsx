import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { CountryTile } from "@/components/CountryTile";
import { getCountries } from "@/lib/trends/queries";
import { GOOGLE_TRENDS_URL } from "@/lib/links";

export const metadata: Metadata = {
  title: "The world in thermal · trends°",
  description: "Every country we follow, coloured by its hottest trend today.",
  alternates: { canonical: "/c" },
};

async function Countries() {
  await connection();
  const { countries } = await getCountries();
  if (countries.length === 0) return <p className="tr-muted">No country data yet. Come back after the morning update.</p>;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {countries.map((c) => (
        <CountryTile key={c.code} code={c.code} heat={c.trend ? c.heat : null} trendTitle={c.trend?.title ?? null} />
      ))}
    </div>
  );
}

export default function CountriesPage() {
  return (
    <div className="tr-wrap flex flex-col gap-6 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="tr-display m-0 text-[clamp(64px,10vw,120px)]">by country</h1>
        <p className="tr-muted m-0 max-w-2xl">
          Each tile takes the colour of the hottest trend we cover in that country today. Grey means none of today&apos;s trends is heating up there. Data source:{" "}
          <a href={GOOGLE_TRENDS_URL} target="_blank" rel="noopener">
            Google Trends
          </a>
          .
        </p>
      </div>
      <Suspense fallback={<p className="tr-muted">Loading countries…</p>}>
        <Countries />
      </Suspense>
    </div>
  );
}
