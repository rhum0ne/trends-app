import { describe, expect, it } from "vitest";
import { indexNowKeyFile, indexNowPayload } from "./indexnow";
import { SITE_URL } from "@/lib/links";

const KEY = "0123456789abcdef0123456789abcdef";

describe("indexNowKeyFile", () => {
  it("sert la clé seulement quand elle est demandée exactement", () => {
    expect(indexNowKeyFile(KEY, KEY)).toBe(KEY);
    expect(indexNowKeyFile("deadbeefdeadbeef", KEY)).toBeNull();
    expect(indexNowKeyFile(null, KEY)).toBeNull();
  });

  it("ne sert rien sans clé valide", () => {
    expect(indexNowKeyFile("", undefined)).toBeNull();
    expect(indexNowKeyFile("short", "short")).toBeNull();
  });
});

describe("indexNowPayload", () => {
  it("place le fichier de clé à la racine pour couvrir tout le site", () => {
    const p = indexNowPayload(KEY, ["/t/gta-vi", "/", "/t/gta-vi"]);
    expect(p.keyLocation).toBe(`${SITE_URL}/${KEY}.txt`);
    expect(p.urlList).toEqual([`${SITE_URL}/t/gta-vi`, `${SITE_URL}/`]);
  });
});
