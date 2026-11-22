"use client";

import { useEffect, useState } from "react";
import { CopyButton } from "@/components/CopyButton";

/** Affiche une seule fois la clé qui vient d'être créée (passée dans le fragment d'URL), puis l'efface. */
export function NewKeyNotice() {
  const [key, setKey] = useState<string | null>(null);
  useEffect(() => {
    const m = /new-key=([^&]+)/.exec(window.location.hash);
    if (m) {
      // Lecture unique au montage : la clé n'existe que dans le fragment d'URL
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setKey(decodeURIComponent(m[1]));
      history.replaceState(null, "", window.location.pathname);
    }
  }, []);
  if (!key) return null;
  return (
    <div className="flex flex-col gap-2 rounded-[14px] bg-surface p-4" role="status">
      <b>New key. Copy it now: only its SHA-256 fingerprint is stored.</b>
      <pre className="tr-code">{key}</pre>
      <CopyButton text={key} label="Copy key" />
    </div>
  );
}
