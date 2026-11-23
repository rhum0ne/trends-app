import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Image Docker autonome (CLAUDE.md § 4, docs/deploy.md)
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
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
