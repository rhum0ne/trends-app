import type { Metadata } from "next";
import { NotFoundContent } from "@/components/site/NotFoundContent";

export const metadata: Metadata = { title: "Not found · trends°", robots: { index: false } };

// notFound() dans /t/{slug} ou /c/{code} : 404 dans la mise en page du site (en-tête, ticker, pied)
export default function SiteNotFound() {
  return <NotFoundContent />;
}
