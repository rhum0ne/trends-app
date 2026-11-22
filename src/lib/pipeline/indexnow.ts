// IndexNow pour les pages nouvelles ou modifiées (CLAUDE.md § 8), seulement quand le site est public.

import { env, flags } from "@/lib/env";
import { SITE_URL, SITE_HOST } from "@/lib/links";

export async function pingIndexNow(paths: string[]): Promise<boolean> {
  const key = env("INDEXNOW_KEY");
  if (!key || !flags.publicSite() || paths.length === 0) return false;
  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: SITE_HOST,
        key,
        keyLocation: `${SITE_URL}/api/indexnow-key`,
        urlList: [...new Set(paths)].slice(0, 100).map((p) => `${SITE_URL}${p}`),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
