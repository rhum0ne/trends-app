import { describe, expect, it } from "vitest";
import { matchesTopic, normalizeTopic, slugify } from "./normalize";

describe("normalizeTopic", () => {
  it("lowercases and strips accents and punctuation", () => {
    expect(normalizeTopic("  Pokémon: Légendes Z-A! ")).toBe("pokemon legendes z a");
    expect(normalizeTopic("Black_Friday")).toBe("black friday");
  });

  it("converts unambiguous roman numerals", () => {
    expect(normalizeTopic("GTA VI")).toBe("gta 6");
    expect(normalizeTopic("Grand Theft Auto VI")).toBe("gta 6");
    expect(normalizeTopic("World War II")).toBe("world war 2");
  });

  it("only converts ambiguous numerals after a known word", () => {
    expect(normalizeTopic("Part V")).toBe("part 5");
    expect(normalizeTopic("Elon X")).toBe("elon x");
    expect(normalizeTopic("I love you")).toBe("i love you");
  });

  it("applies obvious aliases and splits stuck numbers", () => {
    expect(normalizeTopic("GTA6")).toBe("gta 6");
    expect(normalizeTopic("Formula One")).toBe("formula 1");
    expect(normalizeTopic("PlayStation 5")).toBe("ps5");
    expect(normalizeTopic("Chat GPT")).toBe("chatgpt");
  });

  it("returns an empty string for empty input", () => {
    expect(normalizeTopic("")).toBe("");
    expect(normalizeTopic("!!!")).toBe("");
  });
});

describe("matchesTopic", () => {
  it("matches when every topic word is in the item", () => {
    expect(matchesTopic("gta 6", normalizeTopic("GTA 6 trailer 3"))).toBe(true);
    expect(matchesTopic("black friday", "black friday deals 2026")).toBe(true);
  });
  it("does not match partial words or missing words", () => {
    expect(matchesTopic("gta 6", "gta 5 online")).toBe(false);
    expect(matchesTopic("ai", "paint")).toBe(false);
    expect(matchesTopic("", "anything")).toBe(false);
  });
});

describe("slugify", () => {
  it("builds url-safe slugs", () => {
    expect(slugify("GTA VI")).toBe("gta-6");
    expect(slugify("Café & Co.")).toBe("cafe-and-co");
  });
});
