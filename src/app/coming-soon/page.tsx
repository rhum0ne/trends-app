import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { PoweredBy } from "@/components/PoweredBy";

export const metadata: Metadata = {
  title: "trends° · coming soon",
  description: "The internet's weather report, coming soon. Powered by upTake.",
  robots: { index: false, follow: false },
};

// Page d'attente tant que PUBLIC_SITE=false (CLAUDE.md § 3) : rien d'autre n'est visible.
export default function ComingSoon() {
  return (
    <main className="tr-wrap flex min-h-dvh flex-col items-start justify-center gap-6 py-16">
      <Logo size={72} href={null} />
      <h1 className="tr-display m-0 text-[clamp(56px,9vw,120px)]">
        the internet&apos;s weather report,
        <br />
        coming soon.
      </h1>
      <PoweredBy />
    </main>
  );
}
