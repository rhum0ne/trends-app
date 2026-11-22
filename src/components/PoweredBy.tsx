import { UPTAKE_URL } from "@/lib/links";

/** Pastille « Powered by upTake », sur chaque page (CLAUDE.md § 2). */
export function PoweredBy({ className = "" }: { className?: string }) {
  return (
    <a className={`tr-powered ${className}`} href={UPTAKE_URL} target="_blank" rel="noopener">
      <span className="mk" aria-hidden="true">
        u
      </span>
      <span>
        Powered by <b>upTake</b>
      </span>
    </a>
  );
}
