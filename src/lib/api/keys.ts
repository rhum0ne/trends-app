// Clés d'API (CLAUDE.md § 7) : `tk_` + 32 octets aléatoires, gardées en empreinte SHA-256, jamais en clair.

import { createHash, randomBytes } from "node:crypto";

export const KEY_PREFIX = "tk_";

export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const key = `${KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
  return { key, hash: hashApiKey(key), prefix: key.slice(0, 8) };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

/** Extrait la clé de `Authorization: Bearer tk_…` ; null si absente, "invalid" si mal formée. */
export function bearerKey(header: string | null): string | null | "invalid" {
  if (!header) return null;
  const m = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!m) return "invalid";
  return m[1].startsWith(KEY_PREFIX) && m[1].length >= 20 ? m[1] : "invalid";
}
