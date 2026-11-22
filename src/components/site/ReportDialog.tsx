"use client";

import { Flag as FlagIcon } from "lucide-react";
import { useState } from "react";

const REASONS = [
  { value: "sensitive", label: "It's about something serious or sad" },
  { value: "wrong", label: "It's wrong or misleading" },
  { value: "offensive", label: "It's offensive" },
  { value: "other", label: "Something else" },
];

/** « Report this trend » : signalement anonyme, relu dans /admin. */
export function ReportDialog({ slug, label = "Report a trend" }: { slug?: string; label?: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  return (
    <details className="w-full max-w-sm">
      <summary className="tr-btn line small cursor-pointer list-none">
        <FlagIcon strokeWidth={1.75} aria-hidden="true" />
        {label}
      </summary>
      {state === "sent" ? (
        <p className="m-0 mt-3 text-sm" role="status">
          Thanks. We read every report.
        </p>
      ) : (
        <form
          className="mt-3 flex flex-col gap-2 rounded-[14px] bg-surface p-4 text-sm"
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setState("sending");
            try {
              const res = await fetch("/api/report", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ slug: slug ?? fd.get("slug"), reason: fd.get("reason"), message: fd.get("message") }),
              });
              setState(res.ok ? "sent" : "error");
            } catch {
              setState("error");
            }
          }}
        >
          {!slug ? (
            <label className="flex flex-col gap-1">
              Trend (name or link)
              <input name="slug" className="rounded-[8px] border border-line bg-surface-2 px-3 py-2 text-ink" maxLength={120} required />
            </label>
          ) : null}
          <label className="flex flex-col gap-1">
            Reason
            <select name="reason" className="rounded-[8px] border border-line bg-surface-2 px-3 py-2 text-ink" defaultValue="sensitive">
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            Details (optional)
            <textarea name="message" maxLength={1000} rows={3} className="rounded-[8px] border border-line bg-surface-2 px-3 py-2 text-ink" />
          </label>
          <button type="submit" className="tr-btn ink small self-start" disabled={state === "sending"}>
            {state === "sending" ? "Sending…" : "Send report"}
          </button>
          {state === "error" ? (
            <p className="m-0 text-caution" role="alert">
              That didn&apos;t go through. Try again in a minute.
            </p>
          ) : null}
        </form>
      )}
    </details>
  );
}
