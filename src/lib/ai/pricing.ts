// Prix publics de l'API Claude (dollars par million de tokens), relevés le 2026-11-22.
// Servent à estimer le coût et à appliquer le plafond AI_DAILY_BUDGET_USD. À revoir si les prix changent.

export const DEFAULT_MODEL = "claude-opus-5-5";

const PRICES: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
  "claude-fable-5-2": { input: 8, output: 40, cacheRead: 0.2, cacheWrite: 10 },
  "claude-opus-4-8": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
};

/** Recherche web : 10 $ les 1 000 recherches (docs/business-plan.md). */
export const WEB_SEARCH_USD = 0.01;

export interface UsageLike {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number | null } | null;
}

export function estimateCost(model: string, usage: UsageLike): number {
  // Modèle inconnu : on prend le prix le plus élevé connu, pour ne jamais sous-estimer le plafond.
  const p = PRICES[model] ?? PRICES["claude-fable-5-2"];
  const cost =
    ((usage.input_tokens ?? 0) * p.input +
      (usage.output_tokens ?? 0) * p.output +
      (usage.cache_read_input_tokens ?? 0) * p.cacheRead +
      (usage.cache_creation_input_tokens ?? 0) * p.cacheWrite) /
      1_000_000 +
    (usage.server_tool_use?.web_search_requests ?? 0) * WEB_SEARCH_USD;
  return Math.round(cost * 10_000) / 10_000;
}
