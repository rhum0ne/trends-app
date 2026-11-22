import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { flags } from "@/lib/env";
import { SITE_URL } from "@/lib/links";
import { db, fetchAll, hasDb } from "@/lib/supabase/server";
import { getLastAnalysisAt } from "@/lib/trends/queries";

// Sitemap avec la vraie date de la dernière analyse, jamais la date du build (CLAUDE.md § 8).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  if (!flags.publicSite() || !hasDb()) return [];
  const last = (await getLastAnalysisAt()) ?? undefined;
  const lastModified = last ? new Date(last) : undefined;
  const entries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/c`, lastModified, changeFrequency: "daily" },
    { url: `${SITE_URL}/archive`, lastModified, changeFrequency: "daily" },
    { url: `${SITE_URL}/api`, changeFrequency: "monthly" },
  ];
  const client = db();
  // Tendances indexables : présentes au moins 2 jours, non masquées
  const days = await fetchAll(() => client.from("trend_days").select("trend_id, day"));
  const count = new Map<string, number>();
  for (const d of days) count.set(d.trend_id, (count.get(d.trend_id) ?? 0) + 1);
  const ids = [...count.entries()].filter(([, n]) => n >= 2).map(([id]) => id);
  if (ids.length) {
    const { data: trends } = await client.from("trends").select("slug, updated_at").in("id", ids).eq("hidden", false);
    for (const t of trends ?? []) entries.push({ url: `${SITE_URL}/t/${t.slug}`, lastModified: new Date(t.updated_at) });
  }
  // Pays indexables : au moins 7 jours de données
  const countries = await fetchAll(() => client.from("trend_countries").select("country_code, day"));
  const perCountry = new Map<string, Set<string>>();
  for (const c of countries) perCountry.set(c.country_code, (perCountry.get(c.country_code) ?? new Set()).add(c.day));
  for (const [code, set] of perCountry) if (set.size >= 7) entries.push({ url: `${SITE_URL}/c/${code.toLowerCase()}`, lastModified });
  return entries;
}
