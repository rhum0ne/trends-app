// Contrôles après génération (CLAUDE.md § 6) — fonctions pures, testées.
// Au moindre doute on retire : un chiffre non vérifié, une source non trouvée, un angle hors règles.

import type { Angle, Audience, Category, SourceLink } from "@/lib/types";
import { checkImageQuery } from "@/lib/images/queries";
import { findBlockedWord } from "@/lib/blocklist";
import { matchesTopic, normalizeTopic, slugify } from "@/lib/normalize";
import type { SearchResult } from "./generate";
import { LIMITS, type TrendAnalysis } from "./schema";

export interface CheckContext {
  /** Résultats de recherche réellement renvoyés par l'outil. */
  searchResults: SearchResult[];
  /** Passages cités et titres des pages trouvées. */
  evidenceTexts: string[];
  /** Clés des candidats issus des sources gratuites. */
  candidateKeys: string[];
  /** Libellés bruts des données collectées (pour les chiffres). */
  collectedTexts: string[];
}

export interface CheckedTrend {
  topic: string;
  topic_key: string;
  signal_key: string;
  slug: string;
  title: string;
  category: Category;
  why: string;
  lifespan: TrendAnalysis["lifespan"];
  brand_safe: boolean;
  risk: string | null;
  audiences: Audience[];
  angles: Angle[];
  image_query: string;
  sources: SourceLink[];
  notes: string[];
}

export type CheckOutcome = { ok: true; trend: CheckedTrend } | { ok: false; topic: string; reason: string };

// ─── Adresses ──────────────────────────────────────────────────────────────

export function normalizeUrl(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    for (const p of [...u.searchParams.keys()]) if (/^utm_|^fbclid$|^gclid$/i.test(p)) u.searchParams.delete(p);
    const s = u.toString();
    return s.endsWith("/") ? s.slice(0, -1) : s;
  } catch {
    return null;
  }
}

/** Garde les sources en http(s) présentes parmi les résultats de recherche ; titre de la page trouvée si vide. */
export function verifySources(sources: SourceLink[], results: SearchResult[]): SourceLink[] {
  const found = new Map<string, SearchResult>();
  for (const r of results) {
    const n = normalizeUrl(r.url);
    if (n) found.set(n, r);
  }
  const out: SourceLink[] = [];
  const seen = new Set<string>();
  for (const s of sources) {
    const n = normalizeUrl(s.url);
    if (!n || !found.has(n) || seen.has(n)) continue;
    seen.add(n);
    const title = (s.title || found.get(n)!.title || "").trim().slice(0, 140);
    out.push({ title: title || new URL(n).hostname, url: found.get(n)!.url });
  }
  return out;
}

// ─── Chiffres ──────────────────────────────────────────────────────────────

/** Nombres présents dans un texte, normalisés (« 1,000 » → « 1000 », « 6.2 » → « 6.2 »). */
export function extractNumbers(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\d[\d,.\s]*\d|\d/g)) {
    let n = m[0].replace(/\s/g, "");
    // Séparateurs de milliers : « 1,000,000 » ou « 1.000.000 »
    if (/^\d{1,3}([,.]\d{3})+$/.test(n)) n = n.replace(/[,.]/g, "");
    else n = n.replace(/,/g, ".");
    out.push(n.replace(/\.$/, ""));
  }
  return out;
}

export function allowedNumbers(texts: string[]): Set<string> {
  const s = new Set<string>();
  for (const t of texts) for (const n of extractNumbers(t)) s.add(n);
  return s;
}

export function hasUnverifiedNumber(text: string, allowed: Set<string>): boolean {
  return extractNumbers(text).some((n) => !allowed.has(n));
}

/** Retire les phrases qui contiennent un chiffre non vérifié. */
export function stripUnverifiedSentences(text: string, allowed: Set<string>): string {
  const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [text];
  return sentences
    .filter((s) => !hasUnverifiedNumber(s, allowed))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Longueurs ─────────────────────────────────────────────────────────────

/** Coupe à `max` caractères : dernière phrase complète si possible, sinon dernier mot entier. */
export function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  if (lastStop > 0) return cut.slice(0, lastStop + 1).trim();
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : max).replace(/[,;:\-–]+$/, "").trim()}.`;
}

export function cleanTitle(title: string, topic: string): string {
  const base = (title || topic).toLowerCase().replace(/\s+/g, " ").trim();
  if (base.length <= LIMITS.title) return base;
  const cut = base.slice(0, LIMITS.title);
  const sp = cut.lastIndexOf(" ");
  return (sp > 8 ? cut.slice(0, sp) : cut).trim();
}

/** 2 à 4 audiences, parts entières qui font 100 (estimées). */
export function normalizeAudiences(list: Audience[]): Audience[] | null {
  const valid = list.filter((a) => a.label?.trim() && Number.isFinite(a.share) && a.share > 0).slice(0, LIMITS.audiencesMax);
  if (valid.length < LIMITS.audiencesMin) return null;
  const total = valid.reduce((s, a) => s + a.share, 0);
  const scaled = valid.map((a) => ({ label: a.label.trim().slice(0, 60), share: Math.max(1, Math.round((a.share / total) * 100)) }));
  const diff = 100 - scaled.reduce((s, a) => s + a.share, 0);
  scaled[0].share += diff;
  return scaled;
}

// ─── Angles ────────────────────────────────────────────────────────────────

// Partenariat, approbation, logo, visuel officiel, marque déposée : interdits dans les angles.
const ANGLE_FORBIDDEN = /\b(logos?|partner(ship|ed|ing)?|sponsor(ed|ship)?|endors\w*|collab(orat\w*)?|trademark\w*|official (art|artwork|trailer|footage|screenshots?|assets?|visuals?)|screenshots?|fan ?art|use (their|the brand'?s?) (name|imagery|assets))\b/i;

export function angleIsAllowed(angle: Angle): boolean {
  return !ANGLE_FORBIDDEN.test(`${angle.title} ${angle.example} ${angle.tag}`);
}

// ─── Contrôle complet d'une tendance ───────────────────────────────────────

export function checkTrend(t: TrendAnalysis, ctx: CheckContext): CheckOutcome {
  const topic = t.topic?.trim();
  if (!topic) return { ok: false, topic: "(empty)", reason: "empty topic" };
  const fail = (reason: string): CheckOutcome => ({ ok: false, topic, reason });
  const notes: string[] = [];

  if (t.sensitive) return fail("judged sensitive by the analysis");

  const blocked = findBlockedWord(topic, t.title, t.why, t.risk, ...t.angles.flatMap((a) => [a.title, a.example]));
  if (blocked) return fail(`blocked word: ${blocked}`);

  // Confirmé par au moins une source gratuite : le candidat doit exister
  const topicKey = normalizeTopic(topic);
  const signalKey = normalizeTopic(t.signal_key);
  const confirmed = ctx.candidateKeys.find((k) => k === signalKey || k === topicKey || matchesTopic(topicKey, k) || (signalKey && matchesTopic(signalKey, k)));
  if (!confirmed) return fail("not confirmed by a free source");

  const sources = verifySources(t.sources, ctx.searchResults);
  if (sources.length < LIMITS.sourcesMin) return fail(`only ${sources.length} source(s) found in the search results`);
  if (sources.length < t.sources.length) notes.push(`${t.sources.length - sources.length} source(s) removed (not in search results)`);

  const allowed = allowedNumbers([topic, ...ctx.collectedTexts, ...ctx.evidenceTexts, ...ctx.searchResults.map((r) => r.title)]);
  let why = stripUnverifiedSentences(t.why ?? "", allowed);
  if (why !== (t.why ?? "").replace(/\s+/g, " ").trim()) notes.push("why: sentence with an unverified number removed");
  why = clip(why, LIMITS.why);
  if (why.length < 20) return fail("why is empty after checks");

  const angles = t.angles
    .filter((a) => a.title?.trim() && a.example?.trim())
    .filter((a) => {
      const ok = angleIsAllowed(a) && !hasUnverifiedNumber(`${a.title} ${a.example}`, allowed);
      if (!ok) notes.push(`angle removed: ${a.title.slice(0, 40)}`);
      return ok;
    })
    .slice(0, LIMITS.anglesMax)
    .map((a) => ({
      tag: a.tag.trim().slice(0, 24),
      title: clip(a.title, 90).replace(/\.$/, ""),
      example: clip(a.example, LIMITS.example),
      fits: a.fits.trim().slice(0, 80),
    }));
  if (angles.length < LIMITS.anglesMin) return fail("fewer than 2 post angles after checks");

  const audiences = normalizeAudiences(t.audiences);
  if (!audiences) return fail("fewer than 2 audiences");

  const img = checkImageQuery(t.image_query, topic, t.category);
  if (!img.ok) notes.push(`image_query replaced (${img.reason})`);

  const risk = t.risk?.trim() ? clip(t.risk, 200) : null;

  return {
    ok: true,
    trend: {
      topic,
      topic_key: topicKey,
      signal_key: confirmed,
      slug: slugify(topic),
      title: cleanTitle(t.title, topic),
      category: t.category,
      why,
      lifespan: t.lifespan,
      brand_safe: t.brand_safe,
      risk: t.brand_safe ? risk : (risk ?? "Handle with care: check the context before posting."),
      audiences,
      angles,
      image_query: img.query,
      sources,
      notes,
    },
  };
}
