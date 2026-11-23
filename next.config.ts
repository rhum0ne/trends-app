import type { NextConfig } from "next";
import { HTML_LIMITED_BOTS } from "./src/lib/seo/bots";

const nextConfig: NextConfig = {
  // Image Docker autonome (CLAUDE.md § 4, docs/deploy.md)
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Moteurs et robots d'IA : métadonnées dans le <head>, contenu sans streaming (src/lib/seo/bots.ts)
  htmlLimitedBots: HTML_LIMITED_BOTS,
  // Fichier de clé IndexNow à la racine (/{clé}.txt) : une clé dans un sous-dossier limiterait les URL
  // acceptées à ce sous-dossier. La route ne répond que si la clé demandée est INDEXNOW_KEY.
  async rewrites() {
    return [{ source: "/:key([0-9a-fA-F-]{8,128}).txt", destination: "/api/indexnow-key?key=:key" }];
  },
  serverExternalPackages: ["@google-cloud/bigquery", "sharp"],
  images: {
    // Les photos sont copiées dans Supabase Storage (docs/images.md) : jamais servies depuis Pexels.
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
      { protocol: "https", hostname: "supabase.trends.uptake.me", pathname: "/storage/v1/object/public/**" },
      { protocol: "http", hostname: "127.0.0.1", port: "54321", pathname: "/storage/v1/object/public/**" },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
