// Recherche, choix et copie des photos dans Supabase Storage (docs/images.md § 2).
// Le site et l'API ne servent jamais l'adresse de Pexels : on copie src.large2x dans le bucket.

import sharp from "sharp";
import { db, fetchAll, IMAGE_BUCKET } from "@/lib/supabase/server";
import type { Category } from "@/lib/types";
import type { Json } from "@/lib/supabase/database.types";
import { CATEGORY_IMAGE_QUERY } from "./queries";
import { pickPhoto, searchPexels, type PexelsPhoto } from "./pexels";
import { addDays, parisToday } from "@/lib/format";

export interface PhotoOutcome {
  ok: boolean;
  pexelsId?: number;
  reason?: string;
}

async function recentlyUsedIds(): Promise<Set<number>> {
  const since = `${addDays(parisToday(), -30)}T00:00:00Z`;
  const rows = await fetchAll(() => db().from("trend_images").select("pexels_id").gte("created_at", since));
  return new Set(rows.map((r) => Number(r.pexels_id)));
}

async function copyToStorage(slug: string, photo: PexelsPhoto): Promise<{ path: string; width: number; height: number }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(photo.src.large2x, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`download HTTP ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    // Dimensions réelles du fichier copié (next/image en a besoin)
    const meta = await sharp(bytes).metadata();
    const path = `${slug}-${photo.id}.jpg`;
    const { error } = await db().storage.from(IMAGE_BUCKET).upload(path, bytes, { contentType: "image/jpeg", upsert: true, cacheControl: "31536000" });
    if (error) throw new Error(`storage: ${error.message}`);
    return { path, width: meta.width ?? photo.width, height: meta.height ?? photo.height };
  } finally {
    clearTimeout(timer);
  }
}

async function saveImage(trendId: string, slug: string, photo: PexelsPhoto, query: string, candidates: PexelsPhoto[]): Promise<void> {
  const { path, width, height } = await copyToStorage(slug, photo);
  const client = db();
  await client.from("trend_images").update({ active: false }).eq("trend_id", trendId).eq("active", true);
  const { error } = await client.from("trend_images").insert({
    trend_id: trendId,
    pexels_id: photo.id,
    storage_path: path,
    width,
    height,
    avg_color: photo.avg_color,
    alt: (photo.alt || query).slice(0, 300),
    photographer: photo.photographer,
    photographer_url: photo.photographer_url,
    pexels_url: photo.url,
    query,
    candidates: candidates.map((c) => ({ ...c })) as unknown as Json,
    active: true,
  });
  if (error) throw new Error(`trend_images: ${error.message}`);
}

/** Photo d'une nouvelle tendance : requête de l'analyse, puis requête de la catégorie, sinon pas de photo. */
export async function attachPhoto(trend: { id: string; slug: string; image_query: string | null; category: Category }): Promise<PhotoOutcome> {
  try {
    const used = await recentlyUsedIds();
    const queries = [trend.image_query, CATEGORY_IMAGE_QUERY[trend.category]].filter((q, i, a): q is string => Boolean(q) && a.indexOf(q) === i);
    for (const query of queries) {
      const res = await searchPexels(query);
      if (!res.ok) return { ok: false, reason: res.reason };
      const photo = pickPhoto(res.photos, used);
      if (photo) {
        await saveImage(trend.id, trend.slug, photo, query, res.photos);
        return { ok: true, pexelsId: photo.id };
      }
    }
    return { ok: false, reason: "no_photo" };
  } catch (e) {
    return { ok: false, reason: (e as Error).message.slice(0, 200) };
  }
}

/** « Next photo » (admin) : photo suivante des résultats gardés, sinon nouvelle recherche. */
export async function nextPhoto(trendId: string): Promise<PhotoOutcome> {
  const client = db();
  const { data: trend } = await client.from("trends").select("id, slug, image_query, category").eq("id", trendId).maybeSingle();
  if (!trend) return { ok: false, reason: "unknown trend" };
  const { data: images } = await client.from("trend_images").select("*").eq("trend_id", trendId).order("created_at", { ascending: false });
  const current = images?.find((i) => i.active) ?? images?.[0];
  const tried = new Set((images ?? []).map((i) => Number(i.pexels_id)));
  const used = await recentlyUsedIds();
  for (const id of tried) used.add(id);
  const kept = (Array.isArray(current?.candidates) ? (current!.candidates as unknown as PexelsPhoto[]) : []).filter(Boolean);
  const fromKept = pickPhoto(kept, used);
  try {
    if (fromKept && current) {
      await saveImage(trendId, trend.slug, fromKept, current.query, kept);
      return { ok: true, pexelsId: fromKept.id };
    }
    // Nouvelle recherche, en commençant par la requête de la catégorie si la première est épuisée
    for (const query of [CATEGORY_IMAGE_QUERY[trend.category as Category], trend.image_query].filter(Boolean) as string[]) {
      const res = await searchPexels(query);
      if (!res.ok) return { ok: false, reason: res.reason };
      const photo = pickPhoto(res.photos, used);
      if (photo) {
        await saveImage(trendId, trend.slug, photo, query, res.photos);
        return { ok: true, pexelsId: photo.id };
      }
    }
    return { ok: false, reason: "no_photo" };
  } catch (e) {
    return { ok: false, reason: (e as Error).message.slice(0, 200) };
  }
}

/** « Remove photo » (admin) : la tendance s'affiche sans photo. */
export async function removePhoto(trendId: string): Promise<void> {
  const { error } = await db().from("trend_images").update({ active: false }).eq("trend_id", trendId).eq("active", true);
  if (error) throw new Error(error.message);
}
