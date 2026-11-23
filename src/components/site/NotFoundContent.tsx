import Link from "next/link";

/** Contenu de la page 404, au ton météo (CLAUDE.md § 1, § 10). */
export function NotFoundContent() {
  return (
    <div className="tr-wrap flex flex-col items-start gap-5 py-24">
      <p className="m-0 text-sm font-bold uppercase tr-muted">404</p>
      <h1 className="tr-display m-0 text-[clamp(56px,9vw,120px)]">nothing on the radar</h1>
      <p className="m-0 max-w-xl">This page doesn&apos;t exist, or the trend it pointed to is no longer published.</p>
      <div className="flex flex-wrap gap-3">
        <Link href="/" className="tr-btn primary">
          Today&apos;s forecast
        </Link>
        <Link href="/archive" className="tr-btn line">
          Archive
        </Link>
      </div>
    </div>
  );
}
