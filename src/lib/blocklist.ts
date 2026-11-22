// Sécurité de marque, en dur (CLAUDE.md § 5.4) : en plus du jugement de l'IA.
// Un sujet qui contient l'un de ces mots n'est jamais publié ni servi par l'API.
// Comparaison sur des mots entiers après normalisation (minuscules, sans accents).

import { normalizeTopic } from "./normalize";

export const BLOCKLIST: readonly string[] = [
  // Mort, violence
  "death", "dead", "dies", "died", "killed", "killing", "kill", "murder", "murdered", "homicide", "suicide",
  "shooting", "shooter", "stabbing", "massacre", "funeral", "obituary", "rip", "passed away",
  "attack", "attentat", "terror", "terrorist", "terrorism", "bomb", "bombing", "explosion", "hostage",
  "war", "invasion", "airstrike", "missile", "genocide", "army", "troops", "ceasefire", "guerre",
  // Catastrophes, accidents, maladies
  "disaster", "catastrophe", "earthquake", "tsunami", "hurricane", "typhoon", "cyclone", "flood", "flooding",
  "wildfire", "tornado", "crash", "plane crash", "derailment", "collapse", "victims", "casualties",
  "pandemic", "epidemic", "outbreak", "cancer", "overdose",
  // Politique, élections, religion
  "election", "elections", "vote", "voting", "ballot", "referendum", "campaign rally", "president", "prime minister",
  "parliament", "senate", "congress", "impeachment", "politics", "political", "party leader",
  "religion", "religious", "church", "mosque", "synagogue", "temple", "pope", "islam", "christian", "jewish", "hindu",
  // Justice, crime, abus
  "arrest", "arrested", "trial", "verdict", "lawsuit", "sentenced", "prison", "abuse", "assault", "rape", "harassment",
  "scandal", "fraud", "protest", "riot", "racism", "racist",
];

const SINGLE = new Set(BLOCKLIST.filter((w) => !w.includes(" ")));
const PHRASES = BLOCKLIST.filter((w) => w.includes(" ")).map((p) => ` ${normalizeTopic(p)} `);

/** Renvoie le premier mot écarté trouvé dans les textes, ou null. */
export function findBlockedWord(...texts: (string | null | undefined)[]): string | null {
  for (const text of texts) {
    if (!text) continue;
    const key = normalizeTopic(text);
    if (!key) continue;
    for (const w of key.split(" ")) if (SINGLE.has(w)) return w;
    const padded = ` ${key} `;
    for (const p of PHRASES) if (padded.includes(p)) return p.trim();
  }
  return null;
}

export function isBlocked(...texts: (string | null | undefined)[]): boolean {
  return findBlockedWord(...texts) !== null;
}

/** Mots du blocklist sous forme d'ensemble, pour checkImageQuery. */
export function blockedWordSet(): Set<string> {
  return new Set(BLOCKLIST.flatMap((w) => normalizeTopic(w).split(" ")));
}
