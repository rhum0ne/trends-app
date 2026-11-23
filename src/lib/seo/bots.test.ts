import { describe, expect, it } from "vitest";
// Liste interne de Next : si elle change à une mise à jour, recopier la nouvelle dans bots.ts.
import { HTML_LIMITED_BOT_UA_RE } from "next/dist/shared/lib/router/utils/html-bots";
import { HTML_LIMITED_BOTS, NEXT_DEFAULT_HTML_BOTS } from "./bots";

describe("HTML_LIMITED_BOTS", () => {
  it("reprend la liste par défaut de Next", () => {
    expect(NEXT_DEFAULT_HTML_BOTS).toBe(HTML_LIMITED_BOT_UA_RE.source);
  });

  it.each([
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)",
    "Mozilla/5.0 (compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
    "Mozilla/5.0 (compatible; Claude-SearchBot/1.0)",
    "Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)",
    "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
    "facebookexternalhit/1.1",
  ])("rendu bloquant pour %s", (ua) => {
    expect(HTML_LIMITED_BOTS.test(ua)).toBe(true);
  });

  it.each([
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  ])("streaming conservé pour les visiteurs : %s", (ua) => {
    expect(HTML_LIMITED_BOTS.test(ua)).toBe(false);
  });
});
