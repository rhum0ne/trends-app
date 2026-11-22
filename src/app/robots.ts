import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { flags } from "@/lib/env";
import { SITE_URL } from "@/lib/links";

export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection();
  if (!flags.publicSite()) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/styleguide", "/coming-soon"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
