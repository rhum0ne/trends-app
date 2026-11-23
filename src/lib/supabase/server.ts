import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { env, requireEnv } from "@/lib/env";

export type Db = SupabaseClient<Database>;

let cached: Db | null = null;

/** Client serveur avec la clé service : seul moyen de lire ou d'écrire la base (RLS sans politique). */
export function db(): Db {
  if (cached) return cached;
  cached = createClient<Database>(env("SUPABASE_INTERNAL_URL") ?? requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { "x-client-info": "uptake-trends" },
      // Kong injoignable : échouer en 10 s plutôt que laisser la page charger indéfiniment
      fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(10_000) }),
    },
  });
  return cached;
}

export function hasDb(): boolean {
  return Boolean((env("SUPABASE_INTERNAL_URL") || env("SUPABASE_URL")) && env("SUPABASE_SERVICE_ROLE_KEY"));
}

export const IMAGE_BUCKET = "trend-images";

export function publicImageUrl(storagePath: string): string {
  const base = requireEnv("SUPABASE_URL").replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${IMAGE_BUCKET}/${storagePath}`;
}

/**
 * Lit toutes les lignes d'une requête par pages de 1000 (limite par défaut de PostgREST).
 * `build` doit renvoyer une nouvelle requête à chaque appel.
 */
export async function fetchAll<T>(build: () => { range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }> }, max = 50_000): Promise<T[]> {
  const out: T[] = [];
  const page = 1000;
  for (let from = 0; from < max; from += page) {
    const { data, error } = await build().range(from, from + page - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < page) break;
  }
  return out;
}
