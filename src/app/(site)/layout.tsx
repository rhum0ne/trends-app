import { Suspense } from "react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { SiteTicker } from "@/components/site/SiteTicker";
import { Ticker } from "@/components/Ticker";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <a href="#main" className="tr-sr focus:not-sr-only">
        Skip to content
      </a>
      <Suspense fallback={<Ticker items={[]} />}>
        <SiteTicker />
      </Suspense>
      <Header />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
    </>
  );
}
