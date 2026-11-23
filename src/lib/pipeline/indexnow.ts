// IndexNow pour les pages nouvelles ou modifiées (CLAUDE.md § 8), seulement quand le site est public.
// Le fichier de clé est servi à la racine (/{clé}.txt, réécriture dans next.config.ts) : IndexNow n'accepte
// que les URL situées sous le dossier du fichier de clé.

import { env, flags } from "@/lib/env";
import { SITE_URL, SITE_HOST } from "@/lib/links";

const KEY_RE = /^[0-9a-fA-F-]{8,128}$/;

/** Contenu du fichier de clé si `requested` est bien la clé configurée, sinon null (404). */
export function indexNowKeyFile(requested: string | null | undefined, key: string | undefined): string | null {
  if (!key || !KEY_RE.test(key) || requested !== key) return null;
  return key;
}

export function indexNowPayload(key: string, paths: string[]) {
  return {
    host: SITE_HOST,
    key,
    keyLocation: `${SITE_URL}/${key}.txt`,
    urlList: [...new Set(paths)].slice(0, 100).map((p) => `${SITE_URL}${p}`),
  };
}

export async function pingIndexNow(paths: string[]): Promise<boolean> {
  const key = env("INDEXNOW_KEY");
  if (!key || !KEY_RE.test(key) || !flags.publicSite() || paths.length === 0) return false;
  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(indexNowPayload(key, paths)),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
