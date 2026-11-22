import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { ApiSnippet } from "@/components/ApiSnippet";
import { PoweredBy } from "@/components/PoweredBy";
import { AccessForm } from "@/components/site/AccessForm";
import { flags } from "@/lib/env";
import { entitlements, planLabel, type PlanId } from "@/lib/plans";
import { SITE_URL } from "@/lib/links";
import { CATEGORIES } from "@/lib/types";

export const metadata: Metadata = {
  title: "The forecast, as json · trends° API",
  description: "Daily trends with heat, forecast, countries and post angles. Free with a credit to upTake.",
  alternates: { canonical: "/api" },
};

const ENDPOINTS = [
  { path: "/api/v1/trends?day=YYYY-MM-DD&country=FR&category=…", what: "Today's trends (default: today, worldwide), sorted by heat" },
  { path: "/api/v1/trends/top?country=FR", what: "The trend of the day (worldwide, or in one country)" },
  { path: "/api/v1/trends/{slug}", what: "One trend, with its heat history and forecast" },
  { path: "/api/v1/countries", what: "Countries we follow, with the hottest trend in each" },
];

const FIELDS: [string, string][] = [
  ["topic, slug, title", "The trend; title is lowercase, 28 characters at most"],
  ["category", CATEGORIES.join(", ")],
  ["why", "Why it's heating up, one sentence"],
  ["lifespan", "1-2 days, 3-7 days or 2+ weeks"],
  ["brand_safe, risk", "Whether a brand can use it, and why to handle it with care"],
  ["audiences", "2 to 4 groups with estimated shares (they add up to 100)"],
  ["angles", "Post ideas: tag, title, example, fits"],
  ["sources", "Pages the analysis is based on"],
  ["heat, heat_level, heat_change", "0–100 heat, cold → scorching, change since yesterday"],
  ["rank, is_top", "Rank of the day, and whether it's the trend of the day"],
  ["forecast", "5 values: today then the next 4 days"],
  ["countries", "{ code, heat, rank } where it heats up"],
  ["first_seen, last_seen, expires_at", "Dates; an expired trend has cooled"],
  ["image", "{ url, width, height, alt, avg_color, credit: { name, url }, source_url } or null. Show the credit with the photo."],
  ["powered_by", "Free plans: show “Powered by upTake” with this link wherever you display the data"],
];

const COLUMNS: PlanId[] = ["anonymous", "free"];

function limitsRow(plan: PlanId) {
  const e = entitlements(plan);
  return {
    requests: e.requests ? `${e.requests.limit.toLocaleString("en-US")} / ${e.requests.per}${plan === "anonymous" ? " / IP" : ""}` : "unlimited",
    content: e.content === "top" ? "Trend of the day" : e.content === "daily10" ? "Today's 10" : "Everything",
    angles: e.maxAngles === null ? "All" : e.maxAngles === 0 ? "None" : String(e.maxAngles),
    countries: e.countries === "world" ? "Worldwide" : e.countries === "world+1" ? "Worldwide + 1 country per request" : "All",
    history: e.historyDays === 0 ? "None" : `${e.historyDays} days`,
    powered: e.poweredBy ? "Required" : "No",
  };
}

async function Access() {
  await connection();
  return <AccessForm mode={flags.publicApiKeys() ? "key" : "waitlist"} />;
}

export default function ApiDocsPage() {
  const sample = {
    day: "2026-11-22",
    trend: {
      topic: "Example",
      slug: "example",
      title: "example",
      category: "gaming",
      heat: 94,
      heat_level: "scorching",
      forecast: [94, 97, 81, 66, 54],
      countries: [{ code: "US", heat: 96, rank: 1 }],
      image: null,
    },
    powered_by: { name: "upTake", url: "https://uptake.me/?ut=trends" },
  };
  return (
    <div className="tr-wrap flex flex-col gap-12 py-10">
      <header className="flex flex-col gap-4">
        <h1 className="tr-display m-0 text-[clamp(64px,10vw,130px)]">the forecast, as json</h1>
        <p className="m-0 max-w-2xl text-lg">Every trend we publish, with its heat, forecast, countries and post angles. Free, with a visible credit to upTake.</p>
        <PoweredBy className="self-start" />
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="tr-section-title">endpoints</h2>
        <p className="tr-muted m-0">JSON, UTF-8, read-only, open CORS, cached for 10 minutes. Versioned: v1 never loses a field.</p>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {ENDPOINTS.map((e) => (
            <li key={e.path} className="rounded-[14px] bg-surface p-3">
              <code className="font-[family-name:var(--font-code)] text-sm">GET {e.path}</code>
              <p className="tr-muted m-0 mt-1 text-sm">{e.what}</p>
            </li>
          ))}
        </ul>
        <ApiSnippet label="Example" request={`curl ${SITE_URL}/api/v1/trends/top`} response={sample} />
        <ApiSnippet label="With a key" request={`curl -H "Authorization: Bearer tk_…" "${SITE_URL}/api/v1/trends?country=FR"`} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="tr-section-title">fields</h2>
        <dl className="m-0 grid gap-x-6 gap-y-3 md:grid-cols-[260px_1fr]">
          {FIELDS.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-bold">{k}</dt>
              <dd className="tr-muted m-0">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="tr-muted m-0 text-sm">Never in a response: raw source lists, raw volumes or ranks from Google, Bluesky or Hacker News, or the text of pages found.</p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="tr-section-title">limits</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left text-sm">
            <thead>
              <tr>
                <th className="py-2 pr-4" />
                {COLUMNS.map((p) => (
                  <th key={p} className="py-2 pr-4">
                    {planLabel(p)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["Requests", "requests"],
                  ["Trends", "content"],
                  ["Post angles per trend", "angles"],
                  ["Countries", "countries"],
                  ["History", "history"],
                  ["“Powered by upTake”", "powered"],
                ] as const
              ).map(([label, key]) => (
                <tr key={key} className="border-t border-line">
                  <th className="py-2 pr-4 font-bold">{label}</th>
                  {COLUMNS.map((p) => (
                    <td key={p} className="tr-muted py-2 pr-4">
                      {limitsRow(p)[key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="tr-muted m-0 text-sm">Over the limit: HTTP 429 with a Retry-After header. Keys go in Authorization: Bearer tk_….</p>
      </section>

      <section className="flex flex-col gap-4" id="access">
        <h2 className="tr-section-title">get api access</h2>
        <p className="m-0 max-w-2xl">Free plans must show “Powered by upTake”, linked to the powered_by URL, wherever the data appears.</p>
        <div className="max-w-md">
          <Suspense fallback={null}>
            <Access />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
