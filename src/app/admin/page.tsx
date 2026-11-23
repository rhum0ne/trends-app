import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { AdminDashboard, type AdminData, type AdminTrend } from "@/components/admin/AdminDashboard";
import { requireAdmin } from "@/lib/supabase/auth";
import { db, publicImageUrl } from "@/lib/supabase/server";
import { aiDailyBudgetUsd, flags } from "@/lib/env";
import { parisToday } from "@/lib/format";
import { imageFromRow } from "@/lib/trends/view";
import { MAX_SEARCHES, spentToday } from "@/lib/ai/generate";
import { assignablePlans, type KeyPlan } from "@/lib/plans";
import { monthPeriod } from "@/lib/api/ratelimit";
import type { TrendImageRow, TrendRow } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Admin · trends°", robots: { index: false, follow: false } };

async function Dashboard({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  await connection();
  const email = await requireAdmin();
  const sp = await searchParams;
  const client = db();
  const day = parisToday();
  const [runs, cronRuns, incidents, dayRows, reports, keys, usage, waitlist, spent] = await Promise.all([
    client.from("analysis_runs").select("*").order("started_at", { ascending: false }).limit(5),
    client.from("cron_runs").select("*").order("started_at", { ascending: false }).limit(8),
    client.from("incidents").select("*").is("closed_at", null),
    client.from("trend_days").select("*").order("day", { ascending: false }).order("rank").limit(30),
    client.from("reports").select("*").eq("resolved", false).order("created_at", { ascending: false }).limit(50),
    client.from("api_keys").select("id, prefix, plan, email, label, active, created_at, last_used_at").order("created_at", { ascending: false }),
    client.from("api_usage").select("key_id, count").eq("period", monthPeriod()),
    client.from("waitlist").select("email, kind, created_at").order("created_at", { ascending: false }).limit(200),
    spentToday(),
  ]);
  const last = runs.data?.[0] ?? null;
  const latestDay = dayRows.data?.[0]?.day ?? null;
  const todays = (dayRows.data ?? []).filter((r) => r.day === latestDay);
  const ids = todays.map((r) => r.trend_id);
  const [trendsRes, imagesRes] = ids.length
    ? await Promise.all([client.from("trends").select("*").in("id", ids), client.from("trend_images").select("*").in("trend_id", ids).eq("active", true)])
    : [{ data: [] as TrendRow[] }, { data: [] as TrendImageRow[] }];
  // Les tendances masquées n'ont plus de ligne visible : on les liste à part
  const hiddenRes = await client.from("trends").select("*").eq("hidden", true).gte("last_seen", latestDay ?? day).limit(20);
  const trendsById = new Map((trendsRes.data ?? []).map((t) => [t.id, t as TrendRow]));
  const images = new Map((imagesRes.data ?? []).map((i) => [i.trend_id, i as TrendImageRow]));
  const usageBy = new Map((usage.data ?? []).map((u) => [u.key_id, u.count]));
  const sources = (last?.sources ?? {}) as Record<string, { ok: boolean; items: number; ms: number; error?: string }>;

  const trends: AdminTrend[] = todays.flatMap((r) => {
    const t = trendsById.get(r.trend_id);
    if (!t || t.hidden) return [];
    return [
      {
        id: t.id,
        slug: t.slug,
        title: t.title,
        category: t.category,
        why: t.why,
        risk: t.risk,
        lifespan: t.lifespan,
        brand_safe: t.brand_safe,
        image_query: t.image_query,
        rank: r.rank,
        heat: r.heat,
        is_top: r.is_top,
        manual_top: r.manual_top,
        image: imageFromRow(images.get(t.id) ?? null, publicImageUrl),
      },
    ];
  });

  const data: AdminData = {
    email,
    notice: sp.run === "started" ? "started" : sp.run === "limited" ? "limited" : null,
    lastRun: last,
    maxSearches: MAX_SEARCHES,
    spent,
    budget: aiDailyBudgetUsd(),
    sources: Object.entries(sources).map(([name, s]) => ({ name, ...s })),
    incidents: incidents.data ?? [],
    cronRuns: cronRuns.data ?? [],
    day: latestDay,
    trends,
    hidden: (hiddenRes.data ?? []).map((t) => ({ id: t.id, title: t.title })),
    rejected: (last?.rejected ?? []) as { topic: string; reason: string }[],
    reports: reports.data ?? [],
    keys: (keys.data ?? []).map((k) => ({ ...k, plan: k.plan as KeyPlan, calls: usageBy.get(k.id) ?? 0 })),
    plans: assignablePlans({ paidPlans: flags.paidPlans() }),
    waitlist: waitlist.data ?? [],
  };
  return <AdminDashboard data={data} />;
}

export default function AdminPage({ searchParams }: PageProps<"/admin">) {
  return (
    <main className="tr-wrap py-8">
      <Suspense fallback={<p className="tr-muted">Loading…</p>}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
