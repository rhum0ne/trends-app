import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import { ThermalFilterDefs } from "@/components/ThermalImage";
import { THEME_SCRIPT } from "@/components/ThemeToggle";
import { Analytics } from "@/components/Analytics";
import { SITE_URL } from "@/lib/links";
import "./globals.css";

// Une seule police : Archivo, axes largeur (62–125) et graisse (CLAUDE.md § 10)
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "trends° · the internet's weather report", template: "%s" },
  description: "The trend of the day, and how to use it for your product. Heat, forecast and post angles for makers. Powered by upTake.",
  applicationName: "trends°",
};

export const viewport: Viewport = {
  themeColor: "#0b0a12",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="night" className={archivo.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <ThermalFilterDefs />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
