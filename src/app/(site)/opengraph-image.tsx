import { connection } from "next/server";
import { getTopTrend } from "@/lib/trends/queries";
import { ogImage } from "@/lib/og/story";

export const alt = "The trend of the day on trends°";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  await connection();
  const { trend } = await getTopTrend().catch(() => ({ trend: null }));
  return ogImage(trend);
}
