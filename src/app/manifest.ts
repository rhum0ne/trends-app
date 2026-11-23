import type { MetadataRoute } from "next";
import { tokenColor } from "@/lib/brand/icon";

// Icônes produites par `pnpm build:icon` (scripts/build-icon.ts).
export default function manifest(): MetadataRoute.Manifest {
  const night = tokenColor("night", "night");
  return {
    name: "trends°",
    short_name: "trends°",
    description: "The trend of the day, and how to use it for your product.",
    start_url: "/",
    display: "standalone",
    background_color: night,
    theme_color: night,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
