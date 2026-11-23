import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { NotFoundContent } from "@/components/site/NotFoundContent";

export const metadata: Metadata = { title: "Not found · trends°", robots: { index: false } };

// Adresse inconnue : remplace la 404 par défaut de Next (fond blanc, hors charte)
export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col">
      <div className="tr-wrap pt-8">
        <Logo />
      </div>
      <NotFoundContent />
    </main>
  );
}
