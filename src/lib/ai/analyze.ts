// Analyse quotidienne : une seule fois par jour pour tout le monde (CLAUDE.md § 5.2).
// Recherche web (8 au plus) puis sortie JSON validée par zod, puis contrôles (checks.ts).

import type { Candidate } from "@/lib/sources";
import { generateStructured, type GenerateResult } from "./generate";
import { AnalysisOutputSchema, LIMITS, type AnalysisOutput } from "./schema";
import { checkTrend, type CheckOutcome } from "./checks";
import { CATEGORIES } from "@/lib/types";

export const SYSTEM_PROMPT = `You are the analyst behind trends°, "the internet's weather report" for makers (solo founders and small product teams).
Every day you pick what everyone is talking about and explain how a maker can talk about it for their own product without looking ridiculous.

Voice: weather vocabulary (heat, heating up, cooling, forecast), short, honest, in English. Never write "viral", "buzz" or "insane". No emoji, no exclamation marks.

Hard rules:
- Only keep topics that are confirmed by the signals you are given. Never invent a topic.
- Mark sensitive=true for anything serious or risky for a brand: deaths, accidents, crime, war, disasters, health scares, elections and politics, religion, scandals, minors, or any drama. Never encourage riding on a tragedy. Those topics are never published.
- brand_safe=false (with a one-sentence "risk") when a brand can talk about it but must handle it with care.
- Numbers: never write a number in "why" or in angles unless it appears in the signals or in the pages you found. When in doubt, leave the number out.
- Post angles: talk about the moment, not the brand. Never suggest a partnership with or endorsement by a brand you mention. Never suggest using a logo, an official visual, a screenshot, a character or a trademark. No opportunistic tone. Skip an angle that would fit no product. 2 or 3 angles per trend.
- "fits": the networks or formats the angle suits, e.g. "X, LinkedIn".
- "title": lowercase, 28 characters at most, how the trend is shown in big letters (e.g. "gta vi", "black friday").
- "why": one sentence, 200 characters at most, "why it's heating up".
- "audiences": 2 to 4 groups with estimated shares that add up to 100.
- "image_query": English, 2 to 5 words, a generic scene a stock photographer could shoot that evokes the topic. Never the topic itself, never a brand, product, artwork or person name, no capital letters (e.g. GTA VI → "gaming night controller neon", Black Friday → "shopping bags city street").
- "sources": at least 2 pages you actually found with web search, with their exact URL.
- "signal_key": copy the exact "key" of the candidate this trend comes from.
- "slug": lowercase words joined by hyphens.
- "category": one of ${CATEGORIES.join(", ")}.
- "lifespan": "1-2 days", "3-7 days" or "2+ weeks".`;

export function buildPrompt(day: string, candidates: Candidate[]): string {
  const lines = candidates.map((c) =>
    JSON.stringify({
      key: c.key,
      label: c.label,
      sources: c.sources,
      google_countries: c.googleCountries || undefined,
      google_best_rank: c.googleBestRank ?? undefined,
      wikipedia_views: c.wikiViews || undefined,
      bluesky_rank: c.blueskyRank ?? undefined,
      hn_points: c.hnPoints || undefined,
    }),
  );
  return `Today is ${day}. Here are today's candidate topics from free public signals (Google Trends by country, Wikipedia most viewed pages, Bluesky trending topics, Hacker News front page), strongest first. They are internal data: never quote raw ranks or volumes.

<candidates>
${lines.join("\n")}
</candidates>

Select up to ${LIMITS.maxTrends} topics that a maker could use this week: things many people are talking about across countries or communities (games, tech, AI, entertainment, sport, culture, shopping moments, design, food, music…). Prefer fewer good trends over many weak ones. Merge candidates that are the same topic and use the strongest key.`;
}

const RESEARCH_INSTRUCTIONS = `First, research. Use web search (at most 8 searches in total) to understand why the strongest candidates are heating up right now and whether any is sensitive. Then write short research notes: for each topic you would keep, 2–3 factual lines with the URLs of the pages that support them. Do not output JSON yet.`;

export interface AnalysisResult {
  raw: AnalysisOutput;
  accepted: Extract<CheckOutcome, { ok: true }>["trend"][];
  rejected: { topic: string; reason: string }[];
  generation: Omit<GenerateResult<AnalysisOutput>, "data">;
}

export async function analyzeDay(day: string, candidates: Candidate[]): Promise<AnalysisResult> {
  const prompt = buildPrompt(day, candidates);
  const gen = await generateStructured({
    purpose: "daily-analysis",
    system: SYSTEM_PROMPT,
    prompt,
    schema: AnalysisOutputSchema,
    webSearch: { maxUses: 8, instructions: RESEARCH_INSTRUCTIONS },
  });
  const research = gen.research;
  const ctx = {
    searchResults: research?.results ?? [],
    evidenceTexts: [...(research?.citedTexts ?? []), research?.text ?? ""],
    candidateKeys: candidates.map((c) => c.key),
    collectedTexts: candidates.map((c) => `${c.label} ${c.key}`),
  };
  const accepted: AnalysisResult["accepted"] = [];
  const rejected: AnalysisResult["rejected"] = [];
  const seen = new Set<string>();
  for (const t of gen.data.trends.slice(0, LIMITS.maxTrends + 4)) {
    const out = checkTrend(t, ctx);
    if (!out.ok) {
      rejected.push({ topic: out.topic, reason: out.reason });
      continue;
    }
    if (seen.has(out.trend.topic_key)) {
      rejected.push({ topic: out.trend.topic, reason: "duplicate" });
      continue;
    }
    seen.add(out.trend.topic_key);
    accepted.push(out.trend);
  }
  const { data, ...generation } = gen;
  return { raw: data, accepted, rejected, generation };
}
