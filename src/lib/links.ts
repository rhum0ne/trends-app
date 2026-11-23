// Liens suivis vers upTake (CLAUDE.md § 2). Ne pas modifier sans l'humain.
export const UPTAKE_URL = "https://uptake.me/?ut=trends";
export const UPTAKE_WRITE_URL = "https://uptake.me/?ut=trends&utm_campaign=write";
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://trends.uptake.me").replace(/\/$/, "");
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, "");
/**
 * Origine publique d'une requête, pour les redirections absolues. Derrière Coolify, `request.url` vaut
 * http://0.0.0.0:3000 ; on lit donc l'hôte transmis par le proxy, limité au site lui-même ou à localhost.
 */
export function publicOrigin(headers: Headers): string {
  const host = (headers.get("x-forwarded-host") ?? headers.get("host") ?? "").split(",")[0].trim().toLowerCase();
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  if (host !== SITE_HOST && !local) return SITE_URL;
  const proto = (headers.get("x-forwarded-proto") ?? (local ? "http" : "https")).split(",")[0].trim();
  return `${proto}://${host}`;
}

export const PEXELS_URL = "https://www.pexels.com";
export const GOOGLE_TRENDS_URL = "https://trends.google.com/trends/";

export const POWERED_BY = { name: "upTake", url: UPTAKE_URL } as const;
