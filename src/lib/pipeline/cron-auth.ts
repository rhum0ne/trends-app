import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/** Vérifie `Authorization: Bearer <CRON_SECRET>` (comparaison à temps constant). */
export function cronAuthorized(header: string | null): boolean {
  const secret = env("CRON_SECRET");
  if (!secret || secret.length < 16 || !header) return false;
  const given = Buffer.from(header.replace(/^Bearer\s+/i, ""));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
