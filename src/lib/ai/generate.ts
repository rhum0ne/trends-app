// generateStructured : SEUL point d'appel à l'API Claude (CLAUDE.md § 6).
// Gère la recherche web (facultative), la sortie structurée validée par zod, le nouvel essai,
// le plafond de dépense quotidien et le suivi du coût (table ai_usage).

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { aiDailyBudgetUsd, aiEffort, env, requireEnv, type AiEffort } from "@/lib/env";
import { parisToday } from "@/lib/format";
import { db, hasDb } from "@/lib/supabase/server";
import { DEFAULT_MODEL, estimateCost, type UsageLike } from "./pricing";

export class BudgetExceededError extends Error {
  constructor(spent: number, budget: number) {
    super(`AI daily budget reached (${spent.toFixed(2)} / ${budget.toFixed(2)} USD)`);
    this.name = "BudgetExceededError";
  }
}

export class StructuredOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StructuredOutputError";
  }
}

export interface SearchResult {
  url: string;
  title: string;
}

export interface Research {
  text: string;
  results: SearchResult[];
  citedTexts: string[];
  searches: number;
}

export interface GenerateOptions<S extends z.ZodType> {
  purpose: string;
  system: string;
  prompt: string;
  /** Schéma envoyé à l'API (sans contraintes non gérées par les sorties structurées). */
  schema: S;
  /** Validation stricte après coup ; par défaut `schema`. */
  validate?: (data: z.infer<S>) => z.infer<S>;
  /** Phase de recherche web avant la sortie structurée ; 8 recherches au plus. */
  webSearch?: { maxUses: number; instructions: string };
  model?: string;
  effort?: AiEffort;
}

export interface GenerateResult<T> {
  data: T;
  research: Research | null;
  model: string;
  usage: { input_tokens: number; output_tokens: number; web_searches: number };
  costUsd: number;
}

const BETAS = ["server-side-fallback-2026-07-01"];
export const MAX_SEARCHES = 8;

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY"), maxRetries: 2, timeout: 10 * 60 * 1000 });
  return client;
}

/** Dépense IA du jour (heure de Paris), depuis ai_usage. */
export async function spentToday(): Promise<number> {
  if (!hasDb()) return 0;
  const { data, error } = await db().from("ai_usage").select("cost_usd").eq("day", parisToday());
  if (error) throw error;
  return (data ?? []).reduce((a, r) => a + Number(r.cost_usd ?? 0), 0);
}

async function assertBudget(): Promise<void> {
  const budget = aiDailyBudgetUsd();
  const spent = await spentToday();
  if (spent >= budget) throw new BudgetExceededError(spent, budget);
}

async function recordUsage(model: string, purpose: string, usage: UsageLike): Promise<number> {
  const cost = estimateCost(model, usage);
  if (hasDb()) {
    const { error } = await db()
      .from("ai_usage")
      .insert({
        day: parisToday(),
        model,
        purpose,
        input_tokens: (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0),
        output_tokens: usage.output_tokens ?? 0,
        web_searches: usage.server_tool_use?.web_search_requests ?? 0,
        cost_usd: cost,
      });
    if (error) console.error("ai_usage insert failed", error.message);
  }
  return cost;
}

/** Extrait les résultats de recherche réellement renvoyés et les passages cités. */
export function extractResearch(content: Anthropic.Beta.BetaContentBlock[]): Omit<Research, "searches"> {
  const results: SearchResult[] = [];
  const citedTexts: string[] = [];
  const text: string[] = [];
  for (const block of content) {
    if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
      for (const r of block.content) if (r.type === "web_search_result") results.push({ url: r.url, title: r.title });
    } else if (block.type === "text") {
      text.push(block.text);
      for (const c of block.citations ?? []) {
        if (c.type === "web_search_result_location") {
          citedTexts.push(c.cited_text);
          if (c.title) results.push({ url: c.url, title: c.title });
        }
      }
    }
  }
  const seen = new Set<string>();
  return {
    text: text.join("").trim(),
    results: results.filter((r) => (seen.has(r.url) ? false : (seen.add(r.url), true))),
    citedTexts,
  };
}

async function runResearch(model: string, system: string, prompt: string, ws: NonNullable<GenerateOptions<z.ZodType>["webSearch"]>, purpose: string, effort: string): Promise<{ research: Research; usage: UsageLike }> {
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: `${prompt}\n\n${ws.instructions}` }];
  const all: Anthropic.Beta.BetaContentBlock[] = [];
  const total = { input_tokens: 0, output_tokens: 0, searches: 0 };
  const cap = Math.min(ws.maxUses, MAX_SEARCHES);
  for (let turn = 0; turn < 4; turn++) {
    // max_uses vaut par requête : on ne passe que les recherches restantes, relances (pause_turn) comprises
    const remaining = cap - total.searches;
    if (turn > 0 && remaining <= 0) break;
    await assertBudget();
    const stream = anthropic().beta.messages.stream({
      model,
      max_tokens: 32_000,
      system,
      messages,
      thinking: { type: "adaptive" },
      output_config: { effort: effort as "high" },
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: Math.max(1, remaining) }],
      betas: BETAS,
      fallbacks: "default",
    } as Anthropic.Beta.MessageCreateParamsStreaming);
    const msg = await stream.finalMessage();
    const u = msg.usage as UsageLike;
    total.input_tokens += (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
    total.output_tokens += u.output_tokens ?? 0;
    total.searches += u.server_tool_use?.web_search_requests ?? 0;
    await recordUsage(model, `${purpose}:research`, u);
    all.push(...msg.content);
    if (msg.stop_reason === "refusal") throw new StructuredOutputError("research refused");
    if (msg.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: msg.content as Anthropic.Beta.BetaContentBlockParam[] });
  }
  const r = extractResearch(all);
  return {
    research: { ...r, searches: total.searches },
    usage: { input_tokens: total.input_tokens, output_tokens: total.output_tokens, server_tool_use: { web_search_requests: total.searches } },
  };
}

export async function generateStructured<S extends z.ZodType>(opts: GenerateOptions<S>): Promise<GenerateResult<z.infer<S>>> {
  const model = opts.model ?? env("AI_MODEL") ?? DEFAULT_MODEL;
  const effort = opts.effort ?? aiEffort();
  let research: Research | null = null;
  const totals = { input_tokens: 0, output_tokens: 0, web_searches: 0 };
  let cost = 0;

  if (opts.webSearch) {
    const r = await runResearch(model, opts.system, opts.prompt, opts.webSearch, opts.purpose, effort);
    research = r.research;
    totals.input_tokens += r.usage.input_tokens ?? 0;
    totals.output_tokens += r.usage.output_tokens ?? 0;
    totals.web_searches += research.searches;
    cost += estimateCost(model, r.usage);
  }

  const userContent = research
    ? `${opts.prompt}\n\n<research_notes>\n${research.text}\n</research_notes>\n\n<search_results>\n${research.results
        .map((r) => `- ${r.title} — ${r.url}`)
        .join("\n")}\n</search_results>\n\nUse only URLs listed in <search_results> as sources.`
    : opts.prompt;

  let lastError = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    await assertBudget();
    const content = attempt === 1 ? userContent : `${userContent}\n\nYour previous answer was rejected: ${lastError}. Fix it and follow the schema exactly.`;
    const msg = await anthropic().beta.messages.parse({
      model,
      max_tokens: 16_000,
      system: opts.system,
      messages: [{ role: "user", content }],
      thinking: { type: "adaptive" },
      output_config: { effort, format: betaZodOutputFormat(opts.schema) },
      betas: BETAS,
      fallbacks: "default",
    } as Parameters<ReturnType<typeof anthropic>["beta"]["messages"]["parse"]>[0]);
    const u = msg.usage as UsageLike;
    totals.input_tokens += (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
    totals.output_tokens += u.output_tokens ?? 0;
    cost += await recordUsage(model, `${opts.purpose}:structured`, u);
    if (msg.stop_reason === "refusal") {
      lastError = "refused";
      continue;
    }
    try {
      const parsed = (msg as unknown as { parsed_output: unknown }).parsed_output;
      if (parsed == null) throw new StructuredOutputError("no parsed output");
      const data = opts.schema.parse(parsed) as z.infer<S>;
      return { data: opts.validate ? opts.validate(data) : data, research, model, usage: totals, costUsd: Math.round(cost * 10_000) / 10_000 };
    } catch (e) {
      lastError = (e as Error).message.slice(0, 500);
    }
  }
  throw new StructuredOutputError(`structured output failed twice: ${lastError}`);
}
