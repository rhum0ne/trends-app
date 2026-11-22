"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="tr-btn line small"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        } catch {
          setDone(false);
        }
      }}
    >
      {done ? <Check strokeWidth={1.75} aria-hidden="true" /> : <Copy strokeWidth={1.75} aria-hidden="true" />}
      <span aria-live="polite">{done ? "Copied" : label}</span>
    </button>
  );
}
