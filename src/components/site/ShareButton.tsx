"use client";

import { Share2 } from "lucide-react";
import { useState } from "react";

/** « Share the card » : partage natif sur téléphone (fichier PNG), sinon téléchargement de la carte. */
export function ShareButton({ cardUrl, pageUrl, title, onPhoto = false }: { cardUrl: string; pageUrl: string; title: string; onPhoto?: boolean }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={`tr-btn line ${onPhoto ? "on-photo" : ""}`}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await fetch(cardUrl);
          const blob = await res.blob();
          const file = new File([blob], `${title.replace(/[^a-z0-9]+/gi, "-")}-trends.png`, { type: "image/png" });
          const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
          if (nav.canShare?.({ files: [file] })) {
            await nav.share({ files: [file], title: `${title} · trends°`, url: pageUrl });
          } else {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = file.name;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 2000);
          }
        } catch {
          window.open(cardUrl, "_blank", "noopener");
        } finally {
          setBusy(false);
        }
      }}
    >
      <Share2 strokeWidth={1.75} aria-hidden="true" />
      {busy ? "Preparing…" : "Share the card"}
    </button>
  );
}
