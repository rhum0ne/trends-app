import type { SourceName } from "@/lib/types";

/** Un élément brut d'une source, déjà normalisé. Interne : jamais servi par l'API. */
export interface SourceItem {
  source: SourceName;
  raw: string;
  key: string;
  /** ISO 3166-1 alpha-2 en majuscules, ou null si la source n'a pas de pays. */
  country: string | null;
  rank: number | null;
  value: number | null;
  meta?: Record<string, unknown>;
}

export interface SourceResult {
  source: SourceName;
  ok: boolean;
  items: SourceItem[];
  ms: number;
  error?: string;
  /** Pays présents dans les données (Google seulement). */
  trackedCountries?: string[];
}

export const SOURCE_TIMEOUT_MS = 10_000;

export class SourceTimeoutError extends Error {
  constructor(source: string) {
    super(`${source}: timed out after ${SOURCE_TIMEOUT_MS / 1000}s`);
    this.name = "SourceTimeoutError";
  }
}

/** fetch avec délai (10 s par défaut) ; lève une erreur lisible, jamais le corps brut d'un service. */
export async function fetchJson<T>(url: string, init: RequestInit & { source: string; timeoutMs?: number }): Promise<T> {
  const { source, timeoutMs = SOURCE_TIMEOUT_MS, ...rest } = init;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...rest, signal: ctrl.signal });
    if (!res.ok) throw new Error(`${source}: HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new SourceTimeoutError(source);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** Lance une source avec mesure du temps ; une erreur devient un résultat en échec, jamais une exception. */
export async function runSource(source: SourceName, fn: () => Promise<Omit<SourceResult, "source" | "ok" | "ms">>): Promise<SourceResult> {
  const t0 = Date.now();
  try {
    const out = await withTimeout(fn(), SOURCE_TIMEOUT_MS + 2_000, source);
    return { source, ok: true, ms: Date.now() - t0, ...out };
  } catch (e) {
    return { source, ok: false, items: [], ms: Date.now() - t0, error: safeMessage(e) };
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, source: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new SourceTimeoutError(source)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export function safeMessage(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  return m.slice(0, 300);
}
