"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

export const THEME_KEY = "trends-theme";

function read(): "night" | "day" {
  return document.documentElement.dataset.theme === "day" ? "day" : "night";
}

function subscribe(cb: () => void) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => obs.disconnect();
}

/** Choix du thème night/day, gardé dans le navigateur (localStorage, pas de cookie). */
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
          localStorage.setItem(THEME_KEY, next);
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

/** Script inline exécuté avant l'affichage, pour éviter un flash de thème. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="day"||t==="night")document.documentElement.dataset.theme=t}catch(e){}`;
