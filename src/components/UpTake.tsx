"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { init } from "uptake-me";

/**
 * Script de mesure d'upTake (sans cookie), chargé une fois sur les pages publiques.
 * Le layout racine couvre aussi l'administration et le retour du lien magique : on les saute.
 */
export function UpTake() {
  const pathname = usePathname();
  const skip = pathname.startsWith("/admin") || pathname.startsWith("/auth");
  useEffect(() => {
    if (skip) return;
    init({ site: "tl_d278a984" }).catch(() => {
      /* la mesure ne doit jamais casser la page */
    });
  }, [skip]);
  return null;
}
