// Corps des réponses de /api/v1 (CLAUDE.md § 7), à partir des vues déjà calculées. Pur et testé.
// Jamais dans une réponse : signals, volumes ou rangs bruts des sources, texte des pages trouvées.

import type { CountryOverview, TrendView } from "@/lib/types";
import { entitlements, type PlanId } from "@/lib/plans";
import { POWERED_BY } from "@/lib/links";
import { addDays } from "@/lib/format";
import { toPublicTrend } from "@/lib/trends/view";
import { listLimit, type ApiError } from "./access";

function envelope<T extends object>(plan: PlanId, body: T): T & { powered_by?: typeof POWERED_BY } {
  return entitlements(plan).poweredBy ? { ...body, powered_by: POWERED_BY } : body;
}

export function listBody(plan: PlanId, data: { day: string | null; trends: TrendView[] }, params: { country?: string | null; category?: string | null }) {
  const all = data.trends;
  const picked = entitlements(plan).content === "top" ? all.filter((t) => t.is_top).slice(0, 1) : all.slice(0, listLimit(plan));
  return envelope(plan, {
    day: data.day,
    country: params.country ? params.country.toUpperCase() : null,
    category: params.category ?? null,
    count: picked.length,
    trends: picked.map((t) => toPublicTrend(t, plan)),
  });
}

export function topBody(plan: PlanId, data: { day: string | null; trend: TrendView | null }, country?: string | null) {
  return envelope(plan, {
    day: data.day,
    country: country ? country.toUpperCase() : null,
    trend: data.trend ? toPublicTrend(data.trend, plan) : null,
  });
}

export function trendBody(plan: PlanId, view: (TrendView & { full_history: { day: string; heat: number; rank: number }[] }) | null, latestDay: string | null): unknown | ApiError {
  if (!view) return { status: 404, code: "not_found", message: "Unknown trend" } satisfies ApiError;
  const ent = entitlements(plan);
  const ref = latestDay ?? view.day;
  if (ent.content === "top" && !(view.is_top && view.day === ref)) {
    return { status: 403, code: "trend_not_included", message: "Without a key, only the trend of the day is available" } satisfies ApiError;
  }
  const oldest = addDays(ref, -ent.historyDays);
  if (view.day < oldest) return { status: 403, code: "history_not_included", message: `Your plan includes ${ent.historyDays} days of history` } satisfies ApiError;
  const history = view.full_history.filter((h) => h.day >= oldest).map((h) => ({ day: h.day, heat: h.heat, rank: h.rank }));
  return envelope(plan, { trend: { ...toPublicTrend(view, plan), history } });
}

export function countriesBody(plan: PlanId, data: { day: string | null; countries: CountryOverview[] }) {
  return envelope(plan, {
    day: data.day,
    count: data.countries.length,
    countries: data.countries.map((c) => ({
      code: c.code,
      name: c.name,
      heat: c.trend ? c.heat : null,
      heat_level: c.heat_level,
      trend: c.trend ? { slug: c.trend.slug, title: c.trend.title, heat: c.trend.heat } : null,
    })),
  });
}
