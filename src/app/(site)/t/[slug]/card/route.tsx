import { connection } from "next/server";
import { getTrend } from "@/lib/trends/queries";
import { storyCard } from "@/lib/og/story";

// Carte story partageable, 1080×1920 PNG, avec « trends.uptake.me » dessus (docs/pages.md).
export async function GET(_request: Request, ctx: RouteContext<"/t/[slug]/card">) {
  const { slug } = await ctx.params;
  await connection();
  const trend = await getTrend(slug);
  if (!trend) return new Response("Not found", { status: 404 });
  const img = await storyCard(trend);
  const headers = new Headers(img.headers);
  headers.set("Cache-Control", "public, max-age=600");
  headers.set("Content-Disposition", `inline; filename="${trend.slug}-trends.png"`);
  return new Response(img.body, { status: 200, headers });
}
