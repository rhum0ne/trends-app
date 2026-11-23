"use client";

import Link from "next/link";

// Erreur de rendu : jamais le message brut ni la trace à l'écran (CLAUDE.md § 9)
export default function SiteError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="tr-wrap flex flex-col items-start gap-5 py-24">
      <h1 className="tr-display m-0 text-[clamp(56px,9vw,120px)]">signal lost</h1>
      <p className="m-0 max-w-xl">Something went wrong while loading this page. Try again in a moment.</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" className="tr-btn primary" onClick={() => retry()}>
          Try again
        </button>
        <Link href="/" className="tr-btn line">
          Today&apos;s forecast
        </Link>
      </div>
    </div>
  );
}
