// Droits par offre — SEUL endroit du code qui connaît les noms d'offres (CLAUDE.md § 7).
// Les prix ne sont jamais ici : ils vivent chez Paddle (CLAUDE.md § 3).

export type PlanId = "anonymous" | "free" | "starter" | "pro" | "internal";
export type KeyPlan = Exclude<PlanId, "anonymous">;

export interface Entitlements {
  /** null = sans limite */
  requests: { limit: number; per: "day" | "month" } | null;
  /** "top" : la tendance du jour seulement ; "daily10" : les 10 du jour ; "all" : tout. */
  content: "top" | "daily10" | "all";
  /** Nombre d'angles servis par tendance ; null = tous. */
  maxAngles: number | null;
  /** "world" : pas de filtre pays ; "world+1" : un pays par requête ; "all" : tous (et /countries). */
  countries: "world" | "world+1" | "all";
  /** Jours d'historique accessibles (0 = aujourd'hui seulement). */
  historyDays: number;
  poweredBy: boolean;
  categoryFilter: boolean;
}

const PLANS: Record<PlanId, Entitlements> = {
  // Sans clé : 30 / jour / IP, tendance du jour, monde, pas d'historique, sans angle (docs/business-plan.md)
  anonymous: { requests: { limit: 30, per: "day" }, content: "top", maxAngles: 0, countries: "world", historyDays: 0, poweredBy: true, categoryFilter: false },
  free: { requests: { limit: 1000, per: "month" }, content: "daily10", maxAngles: 1, countries: "world+1", historyDays: 7, poweredBy: true, categoryFilter: false },
  starter: { requests: { limit: 20000, per: "month" }, content: "all", maxAngles: null, countries: "all", historyDays: 90, poweredBy: false, categoryFilter: true },
  pro: { requests: { limit: 100000, per: "month" }, content: "all", maxAngles: null, countries: "all", historyDays: 365, poweredBy: false, categoryFilter: true },
  // upTake : sans limite, tout, 90 jours d'historique
  internal: { requests: null, content: "all", maxAngles: null, countries: "all", historyDays: 90, poweredBy: false, categoryFilter: true },
};

export function entitlements(plan: PlanId): Entitlements {
  return PLANS[plan];
}

export function isKeyPlan(value: string): value is KeyPlan {
  return value === "free" || value === "starter" || value === "pro" || value === "internal";
}

/** Offres qu'on peut attribuer à une clé selon les drapeaux de phase (admin). */
export function assignablePlans(opts: { paidPlans: boolean }): KeyPlan[] {
  return opts.paidPlans ? ["free", "starter", "pro", "internal"] : ["free", "internal"];
}

export function planLabel(plan: PlanId): string {
  return { anonymous: "No key", free: "Free", starter: "Starter", pro: "Pro", internal: "Internal" }[plan];
}
