"use client";

import { useEffect } from "react";

/**
 * Active le défilement magnétique de l'accueil (`html[data-snap]`, globals.css) tant que la page est affichée.
 * Pas de `html:has(.tr-snap)` : avec Cache Components, Next garde l'accueil caché dans le DOM après une
 * navigation ; la règle restait vraie sur la page suivante, dont le pied de page devenait le seul point
 * d'accroche (la page s'ouvrait tout en bas). Un effet, lui, est retiré quand la page est cachée.
 */
export function ScrollSnap() {
  useEffect(() => {
    const html = document.documentElement;
    html.dataset.snap = "";
    return () => {
      delete html.dataset.snap;
    };
  }, []);
  return null;
}
