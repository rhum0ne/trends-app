import type { ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Ban,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  ImageOff,
  Info,
  KeyRound,
  LogOut,
  Play,
  RefreshCw,
  Star,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { HeatBadge } from "@/components/HeatBadge";
import { ThermalImage } from "@/components/ThermalImage";
import { SafetySticker, Sticker } from "@/components/Sticker";
import { NewKeyNotice } from "@/components/admin/NewKeyNotice";
import { CATEGORY_LABEL, durationLabel, formatDay, parisDateTime } from "@/lib/format";
import { planLabel, type KeyPlan } from "@/lib/plans";
import type { TrendImage } from "@/lib/types";
import type { AnalysisRunRow, CronRunRow } from "@/lib/supabase/database.types";
import {
  createKey,
  hideTrend,
  makeTop,
  nextPhoto,
  removePhoto,
  resolveReport,
  revokeKey,
  runNow,
  signOut,
} from "@/app/admin/actions";

// Écran d'administration (CLAUDE.md § 9), sans lecture en base : `app/admin/page.tsx` lit les données,
// `/styleguide/admin` montre le même écran avec des données d'exemple.

export type AdminTrend = {
  id: string;
  slug: string;
  title: string;
  category: string;
  why: string;
  risk: string | null;
  lifespan: string;
  brand_safe: boolean;
  image_query: string | null;
  rank: number;
  heat: number;
  is_top: boolean;
  manual_top: boolean;
  image: TrendImage | null;
};

export type AdminData = {
  email: string;
  notice: "started" | "limited" | null;
  lastRun: Pick<AnalysisRunRow, "day" | "status" | "attempt" | "candidates" | "searches" | "cost_usd" | "trends_count" | "error" | "started_at" | "finished_at"> | null;
  maxSearches: number;
  spent: number;
  budget: number;
  sources: { name: string; ok: boolean; items: number; ms: number; error?: string }[];
  incidents: { id: string; kind: string; opened_at: string; notified_at: string | null }[];
  cronRuns: Pick<CronRunRow, "id" | "job" | "status" | "started_at" | "finished_at" | "error">[];
  day: string | null;
  trends: AdminTrend[];
  hidden: { id: string; title: string }[];
  rejected: { topic: string; reason: string }[];
  reports: { id: string; slug: string | null; reason: string; message: string | null; created_at: string }[];
  keys: { id: string; prefix: string; plan: KeyPlan; label: string | null; email: string | null; active: boolean; last_used_at: string | null; calls: number }[];
  plans: KeyPlan[];
  waitlist: { email: string; kind: string; created_at: string }[];
};

// ---------------------------------------------------------------------------
// Pièces communes

type Tone = "ok" | "bad" | "busy" | "idle";

const SOURCE_LABEL: Record<string, string> = { google: "Google Trends", wikipedia: "Wikipedia", bluesky: "Bluesky", hackernews: "Hacker News" };

function toneOf(status: string): Tone {
  if (status === "ok") return "ok";
  if (status === "failed" || status === "fallback") return "bad";
  if (status === "running") return "busy";
  return "idle";
}

const STATUS_LABEL: Record<string, string> = { ok: "Done", failed: "Failed", fallback: "Fallback", running: "Running", skipped: "Skipped" };

/** Point d'état, toujours accompagné d'un mot (jamais la couleur seule). */
function Status({ status, label }: { status: string; label?: string }) {
  const tone = toneOf(status);
  // Couleur en style : `.tr-status-dot` (hors calque) l'emporterait sur une classe Tailwind.
  const color = { ok: "var(--safe)", bad: "var(--caution)", busy: "var(--ink)", idle: "var(--ink-muted)" }[tone];
  return (
    <span className="inline-flex items-center gap-2 font-bold">
      <span className={`tr-status-dot shrink-0 ${tone === "busy" ? "pulse" : ""}`} style={{ background: color }} aria-hidden="true" />
      {label ?? STATUS_LABEL[status] ?? status}
    </span>
  );
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[14px] bg-surface shadow-[inset_0_0_0_1px_var(--line)] ${className}`}>{children}</div>;
}

function Section({ title, aside, children, className = "" }: { title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`flex min-w-0 flex-col gap-3 ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="tr-display m-0 text-[30px]">{title}</h2>
        {aside ? <span className="tr-muted text-sm">{aside}</span> : null}
      </div>
      {children}
    </section>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">{children}</span>;
}

function Stat({ label, value, sub, children }: { label: string; value: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <Panel className="flex min-w-0 flex-col gap-2 p-4">
      <Label>{label}</Label>
      <span className="tr-num text-[24px] font-extrabold leading-none sm:text-[28px]">{value}</span>
      {children}
      {sub ? <span className="tr-muted text-[13px] leading-[18px]">{sub}</span> : null}
    </Panel>
  );
}

function Notice({ tone, children }: { tone: "ok" | "bad" | "info"; children: ReactNode }) {
  const Icon = tone === "ok" ? CheckCircle2 : tone === "bad" ? AlertTriangle : Info;
  const bar = { ok: "var(--safe)", bad: "var(--caution)", info: "var(--ink-muted)" }[tone];
  return (
    <Panel className="flex items-start gap-3 px-4 py-3 text-sm">
      <Icon strokeWidth={1.75} className="mt-[2px] size-4 shrink-0" style={{ color: bar }} aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </Panel>
  );
}

/** Bouton d'action dans un formulaire de server action, avec ses champs cachés. */
function Action({
  action,
  fields = {},
  icon,
  children,
  variant = "line",
}: {
  action: (form: FormData) => Promise<void>;
  fields?: Record<string, string>;
  icon?: ReactNode;
  children: ReactNode;
  variant?: "line" | "ink" | "primary";
}) {
  return (
    <form action={action}>
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button type="submit" className={`tr-btn ${variant} small min-h-[34px] px-3`}>
        {icon}
        {children}
      </button>
    </form>
  );
}

const icon = (I: typeof Play) => <I strokeWidth={1.75} aria-hidden="true" />;

const field = "min-h-[40px] rounded-[8px] border border-line bg-surface-2 px-3 text-sm font-normal text-ink";

function Empty({ children }: { children: ReactNode }) {
  return <p className="tr-muted m-0 px-4 py-6 text-center text-sm">{children}</p>;
}

// ---------------------------------------------------------------------------
// Blocs

function Header({ email }: { email: string }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
      <div className="flex items-center gap-3">
        <Logo href="/" size={34} />
        <Sticker variant={["ghost", "flat"]}>Admin</Sticker>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="tr-muted mr-2 text-sm max-sm:hidden">{email}</span>
        <Action action={signOut} icon={icon(LogOut)}>
          Sign out
        </Action>
        <Action action={runNow} icon={icon(Play)} variant="primary">
          Run now
        </Action>
      </div>
    </header>
  );
}

function Overview({ d }: { d: AdminData }) {
  const run = d.lastRun;
  const share = d.budget > 0 ? Math.min(1, d.spent / d.budget) : 0;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat
        label="Last analysis"
        value={run ? <Status status={run.status} /> : <span className="tr-muted">none</span>}
        sub={run ? `${formatDay(run.day)} · started ${parisDateTime(run.started_at).split(", ")[1]} · attempt ${run.attempt}${durationLabel(run.started_at, run.finished_at) ? ` · ${durationLabel(run.started_at, run.finished_at)}` : ""}` : "Run the pipeline once to see it here."}
      />
      <Stat label="Published" value={run ? run.trends_count : "—"} sub={run ? `from ${run.candidates} candidates` : undefined} />
      <Stat label="Web searches" value={run ? `${run.searches} / ${d.maxSearches}` : "—"} sub={run ? `run cost $${Number(run.cost_usd).toFixed(4)}` : undefined} />
      <Stat label="AI spend today" value={`$${d.spent.toFixed(2)}`} sub={`of $${d.budget.toFixed(2)} daily budget`}>
        <span className="h-[6px] w-full overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${Math.round(share * 100)} % of the daily budget`}>
          <span className={`block h-full rounded-full ${share >= 0.8 ? "bg-caution" : "bg-ink"}`} style={{ width: `${share * 100}%` }} />
        </span>
      </Stat>
    </div>
  );
}

function Notices({ d }: { d: AdminData }) {
  const items: ReactNode[] = [];
  if (d.notice === "started") items.push(<Notice key="started" tone="ok">Pipeline started in the background. Refresh in a few minutes.</Notice>);
  if (d.notice === "limited") items.push(<Notice key="limited" tone="bad">Too many runs this hour. Try again later.</Notice>);
  for (const i of d.incidents) {
    items.push(
      <Notice key={i.id} tone="bad">
        <b>Open incident: {i.kind}</b> <span className="tr-muted">since {parisDateTime(i.opened_at)} · {i.notified_at ? "emailed" : "email not configured"}</span>
      </Notice>,
    );
  }
  if (d.lastRun?.error) {
    items.push(
      <Notice key="error" tone="bad">
        <b>Last analysis failed:</b> <span className="tr-muted break-words">{d.lastRun.error}</span>
      </Notice>,
    );
  }
  return items.length ? <div className="flex flex-col gap-2">{items}</div> : null;
}

function TrendItem({ t }: { t: AdminTrend }) {
  return (
    <li className="grid gap-4 p-4 sm:grid-cols-[112px_minmax(0,1fr)] sm:items-start">
      <ThermalImage image={t.image} alt={t.title} category={t.category} variant="natural" className="aspect-[4/3] w-[112px] rounded-[10px]" sizes="112px" />
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="tr-num tr-muted text-sm font-extrabold">#{t.rank}</span>
          <Link href={`/t/${t.slug}`} className="text-[17px] font-extrabold leading-tight no-underline hover:underline">
            {t.title}
          </Link>
          <HeatBadge heat={t.heat} />
          {t.is_top ? <Sticker variant="flat">Top{t.manual_top ? " · manual" : ""}</Sticker> : null}
          <SafetySticker brandSafe={t.brand_safe} tilt="flat" />
        </div>
        <p className="m-0 text-sm leading-[20px]">{t.why}</p>
        {t.risk ? (
          <p className="m-0 flex items-start gap-2 text-sm text-caution">
            <AlertTriangle strokeWidth={1.75} className="mt-[2px] size-4 shrink-0" aria-hidden="true" />
            {t.risk}
          </p>
        ) : null}
        <p className="tr-muted m-0 text-[13px] leading-[18px]">
          {CATEGORY_LABEL[t.category] ?? t.category} · {t.lifespan} · {t.image ? `photo by ${t.image.credit.name}` : "no photo"}
          {t.image_query ? ` · query “${t.image_query}”` : ""}
        </p>
        <div className="mt-1 flex flex-wrap gap-2">
          {t.brand_safe && !t.is_top ? (
            <Action action={makeTop} fields={{ id: t.id }} icon={icon(Star)}>
              Make top
            </Action>
          ) : null}
          <Action action={nextPhoto} fields={{ id: t.id }} icon={icon(RefreshCw)}>
            Next photo
          </Action>
          {t.image ? (
            <Action action={removePhoto} fields={{ id: t.id }} icon={icon(ImageOff)}>
              Remove photo
            </Action>
          ) : null}
          <Action action={hideTrend} fields={{ id: t.id }} icon={icon(EyeOff)} variant="ink">
            Hide
          </Action>
        </div>
      </div>
    </li>
  );
}

function Trends({ d }: { d: AdminData }) {
  return (
    <Section title={d.day ? `trends of ${formatDay(d.day, { month: "long", day: "numeric" })}` : "trends"} aside={`${d.trends.length} published`}>
      <Panel>
        {d.trends.length ? (
          <ul className="m-0 flex list-none flex-col divide-y divide-line p-0">
            {d.trends.map((t) => (
              <TrendItem key={t.id} t={t} />
            ))}
          </ul>
        ) : (
          <Empty>No trends published yet.</Empty>
        )}
      </Panel>
      {d.hidden.length ? (
        <Panel className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
          <Label>Hidden</Label>
          {d.hidden.map((t) => (
            <form key={t.id} action={hideTrend} className="flex items-center gap-1 rounded-full bg-surface-2 py-1 pl-3 pr-1">
              <input type="hidden" name="id" value={t.id} />
              <input type="hidden" name="hidden" value="false" />
              <span className="font-bold">{t.title}</span>
              <button type="submit" className="tr-btn line small min-h-[28px] px-2 py-0 text-xs">
                {icon(Eye)} Unhide
              </button>
            </form>
          ))}
        </Panel>
      ) : null}
      {d.rejected.length ? (
        <Panel>
          <details>
            <summary className="cursor-pointer px-4 py-3 text-sm font-bold">Rejected by the checks ({d.rejected.length})</summary>
            <ul className="m-0 flex list-none flex-col divide-y divide-line border-t border-line p-0 text-sm">
              {d.rejected.map((r, i) => (
                <li key={i} className="flex flex-wrap gap-x-3 px-4 py-2">
                  <b>{r.topic}</b>
                  <span className="tr-muted">{r.reason}</span>
                </li>
              ))}
            </ul>
          </details>
        </Panel>
      ) : null}
    </Section>
  );
}

function Sources({ d }: { d: AdminData }) {
  return (
    <Section title="sources" aside={`${d.sources.filter((s) => s.ok).length} of ${d.sources.length} answered`}>
      <Panel>
        {d.sources.length ? (
          <ul className="m-0 flex list-none flex-col divide-y divide-line p-0 text-sm">
            {d.sources.map((s) => (
              <li key={s.name} className="flex flex-col gap-1 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <Status status={s.ok ? "ok" : "failed"} label={SOURCE_LABEL[s.name] ?? s.name} />
                  <span className="tr-num tr-muted">{s.ok ? `${s.items.toLocaleString("en-US")} items ·${(s.ms / 1000).toFixed(1)} s` : "failed"}</span>
                </div>
                {!s.ok && s.error ? <span className="tr-muted break-words pl-4 text-[13px]">{s.error}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No collection yet.</Empty>
        )}
      </Panel>
    </Section>
  );
}

function Runs({ d }: { d: AdminData }) {
  return (
    <Section title="scheduled runs" aside="Paris time">
      <Panel>
        {d.cronRuns.length ? (
          <ul className="m-0 flex list-none flex-col divide-y divide-line p-0 text-sm">
            {d.cronRuns.map((c) => (
              <li key={c.id} className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-[10px]">
                <span className="font-bold">{c.job}</span>
                <Status status={c.status} />
                <span className="tr-num tr-muted text-right">
                  {parisDateTime(c.started_at)}
                  {durationLabel(c.started_at, c.finished_at) ? ` · ${durationLabel(c.started_at, c.finished_at)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No run yet.</Empty>
        )}
      </Panel>
    </Section>
  );
}

function Reports({ d }: { d: AdminData }) {
  return (
    <Section title="reports" aside={d.reports.length ? `${d.reports.length} open` : undefined}>
      <Panel>
        {d.reports.length ? (
          <ul className="m-0 flex list-none flex-col divide-y divide-line p-0 text-sm">
            {d.reports.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {r.slug ? (
                      <Link href={`/t/${r.slug}`} className="font-bold">
                        {r.slug}
                      </Link>
                    ) : (
                      <b>—</b>
                    )}
                    <Sticker variant={["ghost", "flat"]}>{r.reason}</Sticker>
                  </div>
                  {r.message ? <span className="break-words">{r.message}</span> : null}
                  <span className="tr-muted text-[13px]">{parisDateTime(r.created_at)}</span>
                </div>
                <Action action={resolveReport} fields={{ id: r.id }} icon={icon(Check)}>
                  Resolve
                </Action>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No open report.</Empty>
        )}
      </Panel>
    </Section>
  );
}

function Keys({ d }: { d: AdminData }) {
  return (
    <Section title="api keys" aside={`${d.keys.filter((k) => k.active).length} active · calls this month`}>
      <Panel>
        <form action={createKey} className="grid gap-3 border-b border-line p-4 sm:grid-cols-[140px_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
          <label className="flex flex-col gap-1">
            <Label>Plan</Label>
            <select name="plan" className={field} defaultValue="internal">
              {d.plans.map((p) => (
                <option key={p} value={p}>
                  {planLabel(p)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <Label>Label</Label>
            <input name="label" placeholder="upTake production" className={field} />
          </label>
          <label className="flex flex-col gap-1">
            <Label>Email</Label>
            <input name="email" type="email" placeholder="optional" className={field} />
          </label>
          <button className="tr-btn ink small min-h-[40px]" type="submit">
            {icon(KeyRound)} Create key
          </button>
        </form>
        {d.keys.length ? (
          <ul className="m-0 flex list-none flex-col divide-y divide-line p-0 text-sm">
            {d.keys.map((k) => (
              <li key={k.id} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 ${k.active ? "" : "opacity-60"}`}>
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="tr-num">{k.prefix}…</b>
                    <Sticker variant={["ghost", "flat"]}>{planLabel(k.plan)}</Sticker>
                    <span className="truncate">{k.label ?? k.email ?? "—"}</span>
                    {!k.active ? <span className="font-bold text-caution">revoked</span> : null}
                  </div>
                  <span className="tr-muted text-[13px]">
                    <span className="tr-num">{k.calls.toLocaleString("en-US")}</span> calls · last used {k.last_used_at ? parisDateTime(k.last_used_at) : "never"}
                  </span>
                </div>
                {k.active ? (
                  <Action action={revokeKey} fields={{ id: k.id }} icon={icon(Ban)}>
                    Revoke
                  </Action>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No key yet. Create the internal key for upTake first.</Empty>
        )}
      </Panel>
    </Section>
  );
}

function Waitlist({ d }: { d: AdminData }) {
  const api = d.waitlist.filter((w) => w.kind === "api").length;
  return (
    <Section title="waitlist" aside={`${d.waitlist.length} · ${api} API, ${d.waitlist.length - api} paid`}>
      <Panel>
        {d.waitlist.length ? (
          <ul className="m-0 grid list-none grid-cols-1 gap-x-6 p-0 text-sm md:grid-cols-2 lg:grid-cols-3">
            {d.waitlist.map((w) => (
              <li key={`${w.email}-${w.kind}`} className="flex items-center justify-between gap-3 border-b border-line px-4 py-2">
                <span className="truncate">{w.email}</span>
                <span className="tr-muted tr-num shrink-0 text-[13px]">
                  {w.kind} · {formatDay(w.created_at.slice(0, 10))}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Nobody on the waitlist yet.</Empty>
        )}
      </Panel>
    </Section>
  );
}

export function AdminDashboard({ data }: { data: AdminData }) {
  return (
    <div className="flex flex-col gap-8">
      <Header email={data.email} />
      <Notices d={data} />
      <NewKeyNotice />
      <Overview d={data} />
      <Trends d={data} />
      <div className="grid gap-8 lg:grid-cols-3">
        <Sources d={data} />
        <Runs d={data} />
        <Reports d={data} />
      </div>
      <Keys d={data} />
      <Waitlist d={data} />
    </div>
  );
}
