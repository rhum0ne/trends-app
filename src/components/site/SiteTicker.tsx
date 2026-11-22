import { connection } from "next/server";
import { Ticker } from "@/components/Ticker";
import { getDailyTrends } from "@/lib/trends/queries";

/** Ticker LIVE en haut de chaque page, alimenté par les tendances du jour. */
export async function SiteTicker() {
  await connection();
  let items: { slug: string; title: string; heat: number; heat_change: number }[] = [];
  try {
    const { trends } = await getDailyTrends();
    items = trends.map((t) => ({ slug: t.slug, title: t.title, heat: t.heat, heat_change: t.heat_change }));
  } catch {
    items = [];
  }
  return <Ticker items={items} />;
}
