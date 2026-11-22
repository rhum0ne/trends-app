// Règles d'accès de l'API v1 selon l'offre — pur et testé. Les droits viennent de plans.ts uniquement.

import { entitlements, type PlanId } from "@/lib/plans";
import { addDays } from "@/lib/format";
import { CATEGORIES } from "@/lib/types";

export interface ApiError {
  status: number;
  code: string;
  message: string;
}

export interface TrendsParams {
  day?: string | null;
  country?: string | null;
  category?: string | null;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const COUNTRY_RE = /^[A-Za-z]{2}$/;

export function validateDay(day: string | null | undefined, plan: PlanId, latestDay: string | null): ApiError | null {
  if (!day) return null;
  if (!DAY_RE.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00Z`))) return { status: 400, code: "invalid_day", message: "day must be YYYY-MM-DD" };
  const ent = entitlements(plan);
  const ref = latestDay ?? day;
  if (day > ref) return { status: 404, code: "not_found", message: "No forecast for that day yet" };
  if (day < addDays(ref, -ent.historyDays)) {
    return {
      status: 403,
      code: "history_not_included",
      message: ent.historyDays === 0 ? "History needs an API key" : `Your plan includes ${ent.historyDays} days of history`,
    };
  }
  return null;
}

export function validateCountry(country: string | null | undefined, plan: PlanId): ApiError | null {
  if (!country) return null;
  if (!COUNTRY_RE.test(country)) return { status: 400, code: "invalid_country", message: "country must be an ISO 3166-1 alpha-2 code" };
  if (entitlements(plan).countries === "world") return { status: 403, code: "country_not_included", message: "Country filters need an API key" };
  return null;
}

export function validateCategory(category: string | null | undefined, plan: PlanId): ApiError | null {
  if (!category) return null;
  if (!(CATEGORIES as readonly string[]).includes(category)) return { status: 400, code: "invalid_category", message: `category must be one of ${CATEGORIES.join(", ")}` };
  if (!entitlements(plan).categoryFilter) return { status: 403, code: "filter_not_included", message: "Category filters are not included in your plan" };
  return null;
}

export function validateTrendsQuery(params: TrendsParams, plan: PlanId, latestDay: string | null): ApiError | null {
  return validateDay(params.day, plan, latestDay) ?? validateCountry(params.country, plan) ?? validateCategory(params.category, plan);
}

/** Combien de tendances servir dans une liste. */
export function listLimit(plan: PlanId): number {
  const c = entitlements(plan).content;
  return c === "top" ? 1 : c === "daily10" ? 10 : 50;
}

export function canListCountries(plan: PlanId): boolean {
  return entitlements(plan).countries === "all";
}
