import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { Logo } from "@/components/Logo";
import { HeatBadge } from "@/components/HeatBadge";
import { ThermalImage } from "@/components/ThermalImage";
import { SafetySticker } from "@/components/Sticker";
import { NewKeyNotice } from "@/components/admin/NewKeyNotice";
import { requireAdmin } from "@/lib/supabase/auth";
import { db, publicImageUrl } from "@/lib/supabase/server";
import { aiDailyBudgetUsd, flags } from "@/lib/env";
import { parisToday } from "@/lib/format";
import { imageFromRow } from "@/lib/trends/view";
import { spentToday } from "@/lib/ai/generate";
import { assignablePlans, planLabel, type PlanId } from "@/lib/plans";
import { monthPeriod } from "@/lib/api/ratelimit";
import type { TrendImageRow, TrendRow } from "@/lib/supabase/database.types";
import { createKey, hideTrend, makeTop, nextPhoto, removePhoto, resolveReport, revokeKey, runNow, signOut } from "./actions";

export const metadata: Metadata = { title: "Admin · trends°", robots: { index: false, follow: false } };

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-[14px] bg-surface p-4">
      <h2 className="m-0 text-lg font-extrabold">{title}</h2>
      {children}
    </section>
  );
}

function Small({ children }: { children: React.ReactNode }) {
  return <span className="tr-muted text-xs">{children}</span>;
}

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
  const last = runs.data?.[0];
  const latestDay = dayRows.data?.[0]?.day ?? null;
  const todays = (dayRows.data ?? []).filter((r) => r.day === latestDay);
  const ids = todays.map((r) => r.trend_id);
  const [trendsRes, imagesRes] = ids.length
    ? await Promise.all([client.from("trends").select("*").in("id", ids), client.from("trend_images").select("*").in("trend_id", ids).eq("active", true)])
    : [{ data: [] as TrendRow[] }, { data: [] as TrendImageRow[] }];
  // Les tendances masquées n'ont plus de ligne visible : on les liste à part
  const hiddenRes = await client.from("trends").select("*").eq("hidden", true).gte("last_seen", latestDay ?? day).limit(20);
  const trends = new Map((trendsRes.data ?? []).map((t) => [t.id, t as TrendRow]));
  const images = new Map((imagesRes.data ?? []).map((i) => [i.trend_id, i as TrendImageRow]));
  const usageBy = new Map((usage.data ?? []).map((u) => [u.key_id, u.count]));
  const sources = (last?.sources ?? {}) as Record<string, { ok: boolean; items: number; ms: number; error?: string }>;
  const rejected = (last?.rejected ?? []) as { topic: string; reason: string }[];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <Logo href="/" size={36} />
          <span className="tr-muted text-sm">admin · {email}</span>
        </div>
        <div className="flex gap-2">
          <form action={runNow}>
            <button className="tr-btn primary small" type="submit">
              Run now
            </button>
          </form>
          <form action={signOut}>
            <button className="tr-btn line small" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>
      {sp.run === "started" ? <p className="m-0 font-bold">Pipeline started in the background. Refresh in a few minutes.</p> : null}
      {sp.run === "limited" ? <p className="m-0 text-caution">Too many runs this hour.</p> : null}
      <NewKeyNotice />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Last analysis">
          {last ? (
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="font-bold">Day</dt>
              <dd className="m-0">{last.day}</dd>
              <dt className="font-bold">Status</dt>
              <dd className="m-0">{last.status} (attempt {last.attempt})</dd>
              <dt className="font-bold">Candidates</dt>
              <dd className="m-0">{last.candidates}</dd>
              <dt className="font-bold">Searches</dt>
              <dd className="m-0">{last.searches}</dd>
              <dt className="font-bold">Cost</dt>
              <dd className="m-0">${Number(last.cost_usd).toFixed(4)}</dd>
              <dt className="font-bold">Trends</dt>
              <dd className="m-0">{last.trends_count}</dd>
              {last.error ? (
                <>
                  <dt className="font-bold">Error</dt>
                  <dd className="m-0 text-caution">{last.error}</dd>
                </>
              ) : null}
            </dl>
          ) : (
            <p className="tr-muted m-0">No analysis yet.</p>
          )}
          <p className="m-0 text-sm">
            AI spend today: <b>${spent.toFixed(2)}</b> / ${aiDailyBudgetUsd().toFixed(2)}
          </p>
        </Card>
        <Card title="Sources">
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
            {Object.entries(sources).map(([name, s]) => (
              <li key={name}>
                <b>{name}</b>: {s.ok ? `${s.items} items, ${s.ms} ms` : <span className="text-caution">failed ({s.error})</span>}
              </li>
            ))}
            {Object.keys(sources).length === 0 ? <li className="tr-muted">—</li> : null}
          </ul>
          {(incidents.data ?? []).map((i) => (
            <p key={i.id} className="m-0 text-sm text-caution">
              Open incident: {i.kind} since {new Date(i.opened_at).toUTCString()} {i.notified_at ? "(emailed)" : "(email not configured)"}
            </p>
          ))}
        </Card>
        <Card title="Scheduled runs">
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
            {(cronRuns.data ?? []).map((c) => (
              <li key={c.id}>
                {c.job} · {c.status} · <Small>{new Date(c.started_at).toUTCString().slice(5, 22)} UTC</Small>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title={`Trends of ${latestDay ?? "—"}`}>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {todays.map((r) => {
            const t = trends.get(r.trend_id);
            if (!t || t.hidden) return null;
            const img = imageFromRow(images.get(t.id) ?? null, publicImageUrl);
            return (
              <li key={t.id} className="grid items-center gap-3 rounded-[14px] bg-surface-2 p-3 md:grid-cols-[120px_1fr_auto]">
                <ThermalImage image={img} alt={t.title} category={t.category} variant="natural" className="aspect-[4/3] w-[120px] rounded-[10px]" sizes="120px" />
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <b>
                      #{r.rank} {t.title}
                    </b>
                    <HeatBadge heat={r.heat} />
                    {r.is_top ? <span className="text-xs font-bold">TOP{r.manual_top ? " (manual)" : ""}</span> : null}
                    <SafetySticker brandSafe={t.brand_safe} tilt="flat" />
                  </div>
                  <p className="m-0 text-sm">{t.why}</p>
                  {t.risk ? <p className="m-0 text-sm text-caution">{t.risk}</p> : null}
                  <Small>
                    {t.category} · {t.lifespan} · image query: {t.image_query} · {img ? `photo by ${img.credit.name}` : "no photo"} ·{" "}
                    <Link href={`/t/${t.slug}`}>/t/{t.slug}</Link>
                  </Small>
                </div>
                <div className="flex flex-wrap gap-2 md:flex-col">
                  <form action={hideTrend}>
                    <input type="hidden" name="id" value={t.id} />
                    <button className="tr-btn line small" type="submit">
                      Hide
                    </button>
                  </form>
                  {t.brand_safe && !r.is_top ? (
                    <form action={makeTop}>
                      <input type="hidden" name="id" value={t.id} />
                      <button className="tr-btn line small" type="submit">
                        Make top
                      </button>
                    </form>
                  ) : null}
                  <form action={nextPhoto}>
                    <input type="hidden" name="id" value={t.id} />
                    <button className="tr-btn line small" type="submit">
                      Next photo
                    </button>
                  </form>
                  {img ? (
                    <form action={removePhoto}>
                      <input type="hidden" name="id" value={t.id} />
                      <button className="tr-btn line small" type="submit">
                        Remove photo
                      </button>
                    </form>
                  ) : null}
                </div>
              </li>
            );
          })}
          {todays.length === 0 ? <li className="tr-muted">No trends published yet.</li> : null}
        </ul>
        {(hiddenRes.data ?? []).length ? (
          <div className="flex flex-col gap-2">
            <b className="text-sm">Hidden</b>
            {(hiddenRes.data ?? []).map((t) => (
              <form key={t.id} action={hideTrend} className="flex items-center gap-3 text-sm">
                <input type="hidden" name="id" value={t.id} />
                <input type="hidden" name="hidden" value="false" />
                <span>{t.title}</span>
                <button className="tr-btn line small" type="submit">
                  Unhide
                </button>
              </form>
            ))}
          </div>
        ) : null}
        {rejected.length ? (
          <details>
            <summary className="cursor-pointer text-sm font-bold">Rejected by the checks ({rejected.length})</summary>
            <ul className="m-0 mt-2 flex flex-col gap-1 pl-5 text-sm">
              {rejected.map((r, i) => (
                <li key={i}>
                  {r.topic}: <span className="tr-muted">{r.reason}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`Reports (${reports.data?.length ?? 0})`}>
          <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
            {(reports.data ?? []).map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3">
                <span>
                  <b>{r.slug}</b> · {r.reason} {r.message ? <span className="tr-muted">— {r.message}</span> : null}
                  <br />
                  <Small>{new Date(r.created_at).toUTCString()}</Small>
                </span>
                <form action={resolveReport}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className="tr-btn line small" type="submit">
                    Resolve
                  </button>
                </form>
              </li>
            ))}
            {!reports.data?.length ? <li className="tr-muted">No open report.</li> : null}
          </ul>
        </Card>

        <Card title="API keys">
          <form action={createKey} className="flex flex-wrap items-end gap-2 text-sm">
            <label className="flex flex-col gap-1">
              Plan
              <select name="plan" className="rounded-[8px] border border-line bg-surface-2 px-2 py-2 text-ink" defaultValue="internal">
                {assignablePlans({ paidPlans: flags.paidPlans() }).map((p) => (
                  <option key={p} value={p}>
                    {planLabel(p)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              Label
              <input name="label" placeholder="upTake production" className="rounded-[8px] border border-line bg-surface-2 px-2 py-2 text-ink" />
            </label>
            <label className="flex flex-col gap-1">
              Email
              <input name="email" type="email" className="rounded-[8px] border border-line bg-surface-2 px-2 py-2 text-ink" />
            </label>
            <button className="tr-btn ink small" type="submit">
              Create key
            </button>
          </form>
          <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
            {(keys.data ?? []).map((k) => (
              <li key={k.id} className="flex items-center justify-between gap-3">
                <span>
                  <code className="font-[family-name:var(--font-code)]">{k.prefix}…</code> · {planLabel(k.plan as PlanId)} · {k.label ?? k.email ?? "—"} · {usageBy.get(k.id) ?? 0} calls this month
                  {!k.active ? <span className="text-caution"> · revoked</span> : null}
                  <br />
                  <Small>last used {k.last_used_at ? new Date(k.last_used_at).toUTCString() : "never"}</Small>
                </span>
                {k.active ? (
                  <form action={revokeKey}>
                    <input type="hidden" name="id" value={k.id} />
                    <button className="tr-btn line small" type="submit">
                      Revoke
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title={`Waitlist (${waitlist.data?.length ?? 0})`}>
        <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
          {(waitlist.data ?? []).map((w) => (
            <li key={`${w.email}-${w.kind}`}>
              {w.email} · {w.kind} · <Small>{new Date(w.created_at).toISOString().slice(0, 10)}</Small>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
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
