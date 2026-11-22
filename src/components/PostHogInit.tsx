"use client";

import { useEffect } from "react";

/** PostHog sans cookie ni enregistrement de session, identifiant anonyme en mémoire. */
export function PostHogInit({ apiKey, host }: { apiKey: string; host: string }) {
  useEffect(() => {
    let cancelled = false;
    import("posthog-js")
      .then(({ default: posthog }) => {
        if (cancelled) return;
        posthog.init(apiKey, {
          api_host: host,
          persistence: "memory",
          disable_session_recording: true,
          autocapture: false,
          capture_pageview: "history_change",
          person_profiles: "never",
          ip: false,
        } as Parameters<typeof posthog.init>[1]);
      })
      .catch(() => {
        /* la mesure ne doit jamais casser la page */
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey, host]);
  return null;
}
