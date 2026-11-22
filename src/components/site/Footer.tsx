import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PoweredBy } from "@/components/PoweredBy";
import { ReportDialog } from "./ReportDialog";
import { GOOGLE_TRENDS_URL, PEXELS_URL, UPTAKE_URL } from "@/lib/links";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="tr-wrap grid gap-8 py-10 md:grid-cols-[1.3fr_1fr_1fr]">
        <div className="flex flex-col gap-3">
          <Logo size={44} />
          <p className="tr-muted m-0 max-w-sm">The internet&apos;s weather report, for makers.</p>
          <a href={UPTAKE_URL} target="_blank" rel="noopener" className="font-bold">
            Turn a trend into visits with upTake →
          </a>
          <PoweredBy className="self-start" />
        </div>
        <ul className="tr-muted m-0 flex list-none flex-col gap-2 p-0 text-sm">
          <li>
            Photos provided by{" "}
            <a href={PEXELS_URL} target="_blank" rel="noopener">
              Pexels
            </a>
          </li>
          <li>
            Data source:{" "}
            <a href={GOOGLE_TRENDS_URL} target="_blank" rel="noopener">
              Google Trends
            </a>
          </li>
          <li>Heat and forecasts are computed by trends°, not by Google.</li>
        </ul>
        <div className="flex flex-col items-start gap-3">
          <ThemeToggle />
          <ReportDialog />
        </div>
      </div>
    </footer>
  );
}
