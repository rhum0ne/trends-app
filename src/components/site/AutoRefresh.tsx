"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Recharge les données de la page à intervalle régulier (onglet visible seulement), sans animation. */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
