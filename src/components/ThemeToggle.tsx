"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

export const THEME_KEY = "trends-theme";
const LIGHT_QUERY = "(prefers-color-scheme: light)";

function read(): "night" | "day" {
  return document.documentElement.dataset.theme === "day" ? "day" : "night";
}

function subscribe(cb: () => void) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => obs.disconnect();
}

/**
 * Thème night/day. Par défaut, celui du système (prefers-color-scheme), suivi en direct (THEME_SCRIPT).
 * Le bouton force l'autre ; revenir au thème du système efface le choix et le site suit de nouveau le système.
 * Choix gardé dans le navigateur (localStorage, pas de cookie).
 */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, read, () => "night" as const);
  const next = theme === "night" ? "day" : "night";
  return (
    <button
      type="button"
      className="tr-btn line small"
      aria-label={`Switch to ${next} theme`}
      onClick={() => {
        document.documentElement.dataset.theme = next;
        try {
          const system = window.matchMedia(LIGHT_QUERY).matches ? "day" : "night";
          if (next === system) localStorage.removeItem(THEME_KEY);
          else localStorage.setItem(THEME_KEY, next);
        } catch {
          /* stockage indisponible : le choix vaut pour la page */
        }
      }}
    >
      {theme === "night" ? <Sun strokeWidth={1.75} aria-hidden="true" /> : <Moon strokeWidth={1.75} aria-hidden="true" />}
      {theme === "night" ? "Day" : "Night"}
    </button>
  );
}

/**
 * Script inline exécuté avant l'affichage (pas de flash) : choix forcé s'il existe, sinon thème du système,
 * puis suit les changements du système tant qu'aucun choix n'est forcé.
 */
export const THEME_SCRIPT = `(function(){try{var k="${THEME_KEY}",d=document.documentElement,m=window.matchMedia("${LIGHT_QUERY}");var a=function(){var t=null;try{t=localStorage.getItem(k)}catch(e){}d.dataset.theme=t==="day"||t==="night"?t:m.matches?"day":"night"};a();m.addEventListener("change",a)}catch(e){}})()`;
