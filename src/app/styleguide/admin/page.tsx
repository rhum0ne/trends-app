import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminDashboard, type AdminData } from "@/components/admin/AdminDashboard";
import { EXAMPLE_TRENDS } from "@/lib/examples";
import { getSampleImage } from "@/lib/trends/queries";
import type { TrendImage } from "@/lib/types";

// L'écran /admin avec des données d'exemple, pour en valider le rendu sans connexion ni base.
// Les boutons appellent les vraies actions, qui exigent une session admin (requireAdmin).

export const metadata: Metadata = {
  title: "Admin preview · Styleguide · trends°",
  robots: { index: false, follow: false },
};

const at = (hhmm: string, day = "2026-11-23") => new Date(`${day}T${hhmm}:00+01:00`).toISOString();

function exampleData(sample: TrendImage | null): AdminData {
  return {
    email: "admin@example.com",
    notice: null,
    lastRun: {
      day: "2026-11-23",
      status: "ok",
      attempt: 1,
      candidates: 143,
      searches: 6,
      cost_usd: 0.4123,
      trends_count: EXAMPLE_TRENDS.length,
      error: null,
      started_at: at("06:30"),
      finished_at: at("06:33"),
    },
    maxSearches: 8,
    spent: 0.41,
    budget: 2,
    sources: [
      { name: "google", ok: true, items: 1840, ms: 2310 },
      { name: "wikipedia", ok: true, items: 300, ms: 940 },
      { name: "bluesky", ok: false, items: 0, ms: 10000, error: "Timed out after 10 s" },
      { name: "hackernews", ok: true, items: 30, ms: 420 },
    ],
    incidents: [{ id: "i1", kind: "sources_down", opened_at: at("06:31"), notified_at: null }],
    cronRuns: [
      { id: "c1", job: "hourly", status: "running", started_at: at("13:00"), finished_at: null, error: null },
      { id: "c2", job: "hourly", status: "ok", started_at: at("12:00"), finished_at: "2026-11-23T11:00:14.000Z", error: null },
      { id: "c3", job: "manual", status: "skipped", started_at: at("09:12"), finished_at: at("09:12"), error: null },
      { id: "c4", job: "daily", status: "ok", started_at: at("06:30"), finished_at: at("06:33"), error: null },
      { id: "c5", job: "daily", status: "failed", started_at: at("06:30", "2026-11-22"), finished_at: at("06:31", "2026-11-22"), error: "AI budget reached" },
    ],
    day: "2026-11-23",
    trends: EXAMPLE_TRENDS.map((t, i) => ({
      id: `example-${i}`,
      slug: t.slug,
      title: t.title,
      category: t.category,
      why: t.why,
      risk: t.risk,
      lifespan: t.lifespan,
      brand_safe: t.brand_safe,
      image_query: ["night city skyline", "stadium crowd lights", "laptop on desk", "concert stage"][i % 4],
      rank: i + 1,
      heat: t.heat,
      is_top: t.is_top,
      manual_top: false,
      image: i < 2 ? sample : null,
    })),
    hidden: [{ id: "h1", title: "example hidden" }],
    rejected: [
      { topic: "Example election debate", reason: "blocklist: election" },
      { topic: "Example storm warning", reason: "AI: not brand-safe" },
    ],
    reports: [{ id: "r1", slug: EXAMPLE_TRENDS[1]?.slug ?? null, reason: "wrong", message: "Example: the date in the why is off by a day.", created_at: at("10:05") }],
    keys: [
      { id: "k1", prefix: "tk_9f2c", plan: "internal", label: "upTake production", email: null, active: true, last_used_at: at("12:58"), calls: 18432 },
      { id: "k2", prefix: "tk_41ab", plan: "free", label: null, email: "maker@example.com", active: true, last_used_at: null, calls: 0 },
      { id: "k3", prefix: "tk_07de", plan: "free", label: "Old test key", email: null, active: false, last_used_at: at("08:00", "2026-11-20"), calls: 12 },
    ],
    plans: ["free", "internal"],
    waitlist: [
      { email: "maker@example.com", kind: "api", created_at: at("09:00") },
      { email: "studio@example.com", kind: "paid", created_at: at("18:20", "2026-11-22") },
      { email: "indie@example.com", kind: "api", created_at: at("11:45", "2026-11-21") },
    ],
  };
}

async function Preview() {
  let sample: TrendImage | null = null;
  try {
    sample = await getSampleImage();
  } catch {
    sample = null;
  }
  return <AdminDashboard data={exampleData(sample)} />;
}

export default function AdminPreviewPage() {
  return (
    <main className="tr-wrap flex flex-col gap-6 py-8">
      <p className="tr-example m-0">Styleguide · /admin with example data · Example</p>
      <Suspense fallback={<p className="tr-muted">Loading…</p>}>
        <Preview />
      </Suspense>
    </main>
  );
}
