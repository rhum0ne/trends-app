// normalizeTopic : casse, accents, chiffres romains, alias évidents (CLAUDE.md § 5.1).

const ROMAN: Record<string, string> = {
  ii: "2",
  iii: "3",
  iv: "4",
  vi: "6",
  vii: "7",
  viii: "8",
  ix: "9",
  xi: "11",
  xii: "12",
  xiii: "13",
  xiv: "14",
  xv: "15",
  xvi: "16",
  xvii: "17",
  xviii: "18",
  xix: "19",
  xx: "20",
};
// « v », « x », « i » seuls sont trop ambigus (lettres, réseau X) : convertis seulement après un mot-clé connu.
const ROMAN_AMBIGUOUS: Record<string, string> = { i: "1", v: "5", x: "10" };
const ROMAN_CONTEXT = new Set(["gta", "part", "chapter", "episode", "season", "volume", "vol", "act", "rocky", "final", "fantasy", "elder", "scrolls", "world", "war"]);

// Alias évidents : même sujet, écrit autrement. Garder court et sûr.
const ALIASES: Record<string, string> = {
  "grand theft auto": "gta",
  "chat gpt": "chatgpt",
  "open ai": "openai",
  "f1": "formula 1",
  "formula one": "formula 1",
  "nfl football": "nfl",
  "the world cup": "world cup",
  "fifa world cup": "world cup",
  "playstation": "ps",
  "ps 5": "ps5",
  "playstation 5": "ps5",
};

const STOP = new Set(["the", "a", "an", "of", "and", "le", "la", "les", "der", "die", "das", "el", "los"]);

/** Clé de comparaison d'un sujet : minuscules, sans accents ni ponctuation, chiffres romains convertis. */
export function normalizeTopic(input: string): string {
  let s = (input ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
  if (!s) return "";
  const words = s.split(" ");
  const out = words.map((w, i) => {
    if (ROMAN[w]) return ROMAN[w];
    if (ROMAN_AMBIGUOUS[w] && i > 0 && ROMAN_CONTEXT.has(words[i - 1])) return ROMAN_AMBIGUOUS[w];
    return w;
  });
  s = out.join(" ");
  // Alias appliqués sur des mots entiers, du plus long au plus court
  for (const [from, to] of Object.entries(ALIASES).sort((a, b) => b[0].length - a[0].length)) {
    s = ` ${s} `.replace(new RegExp(` ${from} `, "g"), ` ${to} `).trim();
  }
  // « gta 6 » et « gta6 » : sépare lettres et chiffres collés pour quelques préfixes connus
  s = s.replace(/\b(gta|ps|fifa|nba2k|ios|macos|windows)(\d+)\b/g, "$1 $2").replace(/\bps (\d)\b/g, "ps$1");
  return s;
}

export function topicTokens(key: string): string[] {
  return key.split(" ").filter((w) => w && !STOP.has(w));
}

/**
 * Un élément d'une source (terme Google, article, titre HN…) parle-t-il du sujet ?
 * Vrai si tous les mots significatifs du sujet apparaissent dans l'élément.
 */
export function matchesTopic(topicKey: string, itemKey: string): boolean {
  const t = topicTokens(topicKey);
  if (t.length === 0) return false;
  const words = new Set(topicTokens(itemKey));
  return t.every((w) => words.has(w));
}

export function slugify(input: string): string {
  return normalizeTopic(input).replace(/\s+/g, "-").slice(0, 60).replace(/-+$/g, "") || "trend";
}
