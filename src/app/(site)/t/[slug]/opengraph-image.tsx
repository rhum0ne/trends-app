import { connection } from "next/server";
import { getTrend } from "@/lib/trends/queries";
import { ogImage } from "@/lib/og/story";

export const alt = "A trend on trends°, the internet's weather report";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  return ogImage(await getTrend(slug));
}
