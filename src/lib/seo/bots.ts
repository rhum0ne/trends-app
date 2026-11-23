// Robots qui reçoivent un rendu « bloquant » : métadonnées dans le <head> et contenu sans attendre le
// streaming (option `htmlLimitedBots` de next.config.ts). Next n'y met par défaut que les moteurs classiques
// et les aperçus de liens ; les robots d'IA (qui n'exécutent pas le JavaScript) recevaient le <title>,
// le canonical et le `noindex` dans le <body>, et le contenu dans un <div hidden> après « Loading… ».

/**
 * Liste par défaut de Next 16 (`next/dist/shared/lib/router/utils/html-bots.js`), recopiée car
 * `htmlLimitedBots` la remplace au lieu de la compléter. `bots.test.ts` vérifie qu'elle reste à jour.
 */
export const NEXT_DEFAULT_HTML_BOTS =
  "[\\w-]+-Google|Google-[\\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight";

/** Robots d'IA (recherche, réponse en direct, index) : aucun n'exécute le JavaScript. */
export const AI_BOTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "MistralAI-User",
  "DuckAssistBot",
  "Amazonbot",
  "meta-externalagent",
  "meta-externalfetcher",
  "cohere-ai",
  "YouBot",
  "PhindBot",
  "CCBot",
  "Bytespider",
];

export const HTML_LIMITED_BOTS = new RegExp(`${NEXT_DEFAULT_HTML_BOTS}|${AI_BOTS.join("|")}`, "i");
