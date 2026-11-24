// Analyse incrémentale (CLAUDE.md § 5) : l'IA n'analyse que les sujets nouveaux et les tendances à rafraîchir.
// Une tendance connue garde son analyse (why, audiences, angles…) ; sa chaleur est recalculée chaque jour, sans IA.
// Fonctions pures, testées.

import type { CheckedTrend } from "@/lib/ai/checks";
import type { Candidate } from "@/lib/sources";
import type { TrendRow } from "@/lib/supabase/database.types";
import type { Angle, Audience, Category, SourceLink } from "@/lib/types";
import { addDays, daysBetween, parisToday } from "@/lib/format";
import { matchesTopic } from "@/lib/normalize";
import { findBlockedWord } from "@/lib/blocklist";

/** Une analyse de 3 jours ou plus est refaite (l'histoire a pu changer). */
export const REANALYZE_AFTER_DAYS = 3;
/** Bond de chaleur (en degrés, vs la veille) qui déclenche une nouvelle analyse. */
export const HEAT_JUMP = 25;
/** Une tendance est « connue » si elle a été publiée ces 2 derniers jours. */
export const KNOWN_WITHIN_DAYS = 2;

export type KnownTrend = Pick<TrendRow, "id" | "slug" | "topic" | "topic_key" | "signal_key" | "title" | "last_seen" | "expires_at" | "analyzed_at" | "hidden">;

export interface Split<K extends KnownTrend = KnownTrend> {
  /** Candidats sans tendance connue : à analyser. */
  fresh: Candidate[];
  /** Tendances connues dont l'analyse reste valable. */
  keep: K[];
  /** Tendances connues à réanalyser, avec le candidat qui les cite aujourd'hui. */
  refresh: { trend: K; candidate: Candidate }[];
  /** Candidats qui correspondent à une tendance masquée dans /admin : jamais analysés ni publiés. */
  hidden: number;
}

function matches(c: Candidate, k: KnownTrend): boolean {
  return c.key === k.topic_key || (k.signal_key !== null && c.key === k.signal_key) || matchesTopic(k.topic_key, c.key);
}

/** Pourquoi réanalyser une tendance connue (null = garder son analyse). */
export function refreshReason(k: Pick<KnownTrend, "analyzed_at" | "expires_at">, day: string, now: Date): "never_analyzed" | "stale" | "expired" | null {
  if (!k.analyzed_at) return "never_analyzed";
  if (daysBetween(parisToday(new Date(k.analyzed_at)), day) >= REANALYZE_AFTER_DAYS) return "stale";
  // Expirée, ou qui expire aujourd'hui (à 09:00, après l'analyse de 06:30) : sa prévision passe sous 40
  if (Date.parse(k.expires_at) <= now.getTime() || parisToday(new Date(k.expires_at)) <= day) return "expired";
  return null;
}

/** Répartit les candidats du jour entre sujets nouveaux, tendances gardées et tendances à rafraîchir. */
export function splitCandidates<K extends KnownTrend>(day: string, now: Date, candidates: Candidate[], known: K[]): Split<K> {
  const recent = known.filter((k) => k.last_seen >= addDays(day, -KNOWN_WITHIN_DAYS));
  const out: Split<K> = { fresh: [], keep: [], refresh: [], hidden: 0 };
  const used = new Set<string>();
  for (const c of candidates) {
    const k = recent.find((t) => !used.has(t.id) && matches(c, t));
    if (!k) {
      // Un second candidat du même sujet (déjà rattaché) n'est pas un sujet nouveau
      if (!recent.some((t) => used.has(t.id) && matches(c, t))) out.fresh.push(c);
      continue;
    }
    used.add(k.id);
    if (k.hidden) {
      out.hidden++;
      continue;
    }
    if (refreshReason(k, day, now)) out.refresh.push({ trend: k, candidate: c });
    else out.keep.push(k);
  }
  return out;
}

/** Chaleur qui bondit : l'analyse gardée ne dit sans doute plus pourquoi le sujet chauffe. */
export function heatJumped(heat: number, hPrev: number | null): boolean {
  return hPrev !== null && heat - hPrev >= HEAT_JUMP;
}

/** Reconstruit une tendance validée à partir de sa ligne en base (analyse gardée). */
export function trendFromRow(row: TrendRow): CheckedTrend {
  return {
    topic: row.topic,
    topic_key: row.topic_key,
    signal_key: row.signal_key ?? row.topic_key,
    slug: row.slug,
    title: row.title,
    category: row.category as Category,
    why: row.why,
    lifespan: row.lifespan as CheckedTrend["lifespan"],
    brand_safe: row.brand_safe,
    risk: row.risk,
    audiences: (row.audiences ?? []) as unknown as Audience[],
    angles: (row.angles ?? []) as unknown as Angle[],
    image_query: row.image_query ?? "",
    sources: (row.sources ?? []) as unknown as SourceLink[],
    notes: [],
  };
}

/** Une analyse gardée repasse la liste de mots bloqués (elle a pu changer depuis). */
export function stillAllowed(t: CheckedTrend): boolean {
  return !findBlockedWord(t.topic, t.title, t.why, t.risk, ...t.angles.flatMap((a) => [a.title, a.example]));
}

/**
 * Rattache une tendance renvoyée par l'IA à une tendance connue du même sujet : même topic_key et slug,
 * pour mettre à jour la tendance existante au lieu d'en créer un doublon.
 */
export function alignWithKnown(t: CheckedTrend, known: KnownTrend[]): CheckedTrend {
  const k = known.find(
    (x) => x.topic_key === t.topic_key || (x.signal_key !== null && x.signal_key === t.signal_key) || matchesTopic(x.topic_key, t.topic_key),
  );
  return k ? { ...t, topic_key: k.topic_key, slug: k.slug } : t;
}
