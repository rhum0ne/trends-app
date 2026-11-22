// Liens suivis vers upTake (CLAUDE.md § 2). Ne pas modifier sans l'humain.
export const UPTAKE_URL = "https://uptake.me/?ut=trends";
export const UPTAKE_WRITE_URL = "https://uptake.me/?ut=trends&utm_campaign=write";
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://trends.uptake.me").replace(/\/$/, "");
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, "");
export const PEXELS_URL = "https://www.pexels.com";
export const GOOGLE_TRENDS_URL = "https://trends.google.com/trends/";

export const POWERED_BY = { name: "upTake", url: UPTAKE_URL } as const;
