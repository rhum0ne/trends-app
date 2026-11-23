// Lecture des variables d'environnement au moment de l'exécution (jamais au build : l'image Docker
// est construite sans secrets). Ne jamais inventer de valeur : .env.example + l'humain les remplit.

function flag(name: string): boolean {
  return (process.env[name] ?? "").trim().toLowerCase() === "true";
}

/** Drapeaux de phase (CLAUDE.md § 3). Un drapeau à false cache entièrement la fonction. */
export const flags = {
  publicSite: () => flag("PUBLIC_SITE"),
  publicApiKeys: () => flag("PUBLIC_API_KEYS"),
  paidPlans: () => flag("PAID_PLANS"),
};

export function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

export function requireEnv(name: string): string {
  const v = env(name);
  if (!v) throw new MissingEnvError(name);
  return v;
}

export class MissingEnvError extends Error {
  constructor(public readonly variable: string) {
    super(`Missing environment variable ${variable}`);
    this.name = "MissingEnvError";
  }
}

export type AiEffort = "low" | "medium" | "high" | "xhigh";
const EFFORTS: readonly AiEffort[] = ["low", "medium", "high", "xhigh"];

/** Effort de l'analyse (AI_EFFORT) : low, medium, high (défaut) ou xhigh. Valeur inconnue = high. */
export function aiEffort(): AiEffort {
  const v = (env("AI_EFFORT") ?? "").toLowerCase();
  return (EFFORTS as readonly string[]).includes(v) ? (v as AiEffort) : "high";
}

export function aiDailyBudgetUsd(): number {
  const n = Number(env("AI_DAILY_BUDGET_USD") ?? "2");
  return Number.isFinite(n) && n >= 0 ? n : 2;
}

export function adminEmails(): string[] {
  return (env("ADMIN_EMAILS") ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}
