// Limites de débit. Sans clé : compteur en mémoire par IP et par jour (l'IP n'est jamais stockée, CLAUDE.md § 9) ;
// avec clé : compteur mensuel en base. Un compteur en panne ne bloque jamais une requête.

import { createHash } from "node:crypto";
import { env } from "@/lib/env";

export interface LimitResult {
  allowed: boolean;
  limit: number | null;
  remaining: number | null;
  /** Secondes avant la remise à zéro (pour Retry-After). */
  resetSeconds: number;
}

export function secondsUntilNextUtcDay(now = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

export function secondsUntilNextUtcMonth(now = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

export function monthPeriod(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/** Compteur en mémoire, par fenêtre (clé = empreinte salée, jamais l'IP en clair). */
export class MemoryLimiter {
  private counts = new Map<string, number>();
  private window = "";
  private readonly salt: string;

  constructor(salt?: string) {
    this.salt = salt ?? env("RATE_LIMIT_SALT") ?? randomSalt();
  }

  hit(id: string, limit: number, now = new Date(), windowId = now.toISOString().slice(0, 10)): LimitResult {
    if (windowId !== this.window) {
      this.counts.clear();
      this.window = windowId;
    }
    const k = createHash("sha256").update(`${this.salt}|${windowId}|${id}`).digest("base64url").slice(0, 22);
    const n = (this.counts.get(k) ?? 0) + 1;
    this.counts.set(k, n);
    const reset = secondsUntilNextUtcDay(now);
    return { allowed: n <= limit, limit, remaining: Math.max(0, limit - n), resetSeconds: reset };
  }
}

function randomSalt(): string {
  return createHash("sha256").update(`${Math.random()}${Date.now()}`).digest("hex");
}

/** Adresse du client, d'après les en-têtes du proxy (Cloudflare, Traefik). Utilisée seulement en mémoire. */
export function clientIp(headers: Headers): string {
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

// Une instance par processus (l'application tourne en un seul conteneur sur le VPS)
const g = globalThis as unknown as { __trendsLimiters?: Record<string, MemoryLimiter> };
export function limiter(name: string): MemoryLimiter {
  g.__trendsLimiters ??= {};
  g.__trendsLimiters[name] ??= new MemoryLimiter();
  return g.__trendsLimiters[name];
}
