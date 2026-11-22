"use client";

import { useState } from "react";
import { CopyButton } from "@/components/CopyButton";

/**
 * « Get API access » : liste d'attente en phase 1, clé gratuite en phase 2 (PUBLIC_API_KEYS).
 * La clé n'est montrée qu'une fois : on n'en garde que l'empreinte.
 */
export function AccessForm({ mode }: { mode: "waitlist" | "key" }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [key, setKey] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  if (state === "done") {
    return key ? (
      <div className="flex flex-col gap-3 rounded-[14px] bg-surface p-4" role="status">
        <p className="m-0 font-bold">Your free API key. Copy it now: we only keep a fingerprint of it.</p>
        <pre className="tr-code">{key}</pre>
        <CopyButton text={key} label="Copy key" />
        <p className="tr-muted m-0 text-sm">Send it as Authorization: Bearer {key.slice(0, 8)}…, and show &quot;Powered by upTake&quot; wherever you display the data.</p>
      </div>
    ) : (
      <p className="m-0 rounded-[14px] bg-surface p-4 font-bold" role="status">
        You&apos;re on the list. We&apos;ll email you when keys open.
      </p>
    );
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-[14px] bg-surface p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setState("sending");
        try {
          const res = await fetch("/api/access", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: fd.get("email"), consent: fd.get("consent") === "on" }),
          });
          const data = (await res.json().catch(() => ({}))) as { key?: string; error?: { message?: string } };
          if (!res.ok) {
            setMessage(data.error?.message ?? "That didn't go through. Try again later.");
            setState("error");
            return;
          }
          setKey(data.key ?? null);
          setState("done");
        } catch {
          setMessage("That didn't go through. Try again later.");
          setState("error");
        }
      }}
    >
      <label className="flex flex-col gap-1 text-sm font-bold">
        Email
        <input type="email" name="email" required maxLength={200} autoComplete="email" className="rounded-[8px] border border-line bg-surface-2 px-3 py-2 font-normal text-ink" />
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="consent" required className="mt-1" />
        <span>
          {mode === "key" ? "Email me about my key and its limits." : "Email me when API keys open."} We store this email for that purpose only.
        </span>
      </label>
      <button type="submit" className="tr-btn primary self-start" disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : mode === "key" ? "Get a free key" : "Join the waitlist"}
      </button>
      {state === "error" ? (
        <p className="m-0 text-sm text-caution" role="alert">
          {message}
        </p>
      ) : null}
    </form>
  );
}
