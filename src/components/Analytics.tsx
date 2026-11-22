import Script from "next/script";
import { PostHogInit } from "./PostHogInit";

/**
 * Mesure facultative, sans cookie (CLAUDE.md § 4) :
 * - PostHog si NEXT_PUBLIC_POSTHOG_KEY est défini (persistance en mémoire, pas d'enregistrement de session) ;
 * - script de mesure d'upTake si NEXT_PUBLIC_UPTAKE_SCRIPT_SRC est défini (docs/pages.md).
 */
export function Analytics() {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";
  const uptake = process.env.NEXT_PUBLIC_UPTAKE_SCRIPT_SRC;
  return (
    <>
      {key ? <PostHogInit apiKey={key} host={host} /> : null}
      {uptake ? <Script src={uptake} strategy="afterInteractive" data-site="trends" /> : null}
    </>
  );
}
