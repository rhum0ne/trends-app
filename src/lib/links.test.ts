import { describe, expect, it } from "vitest";
import { publicOrigin, SITE_URL } from "./links";

const h = (o: Record<string, string>) => new Headers(o);

describe("publicOrigin", () => {
  it("uses the host forwarded by the proxy, never 0.0.0.0", () => {
    expect(publicOrigin(h({ host: "0.0.0.0:3000" }))).toBe(SITE_URL);
    expect(publicOrigin(h({ host: "trends.uptake.me", "x-forwarded-proto": "https" }))).toBe("https://trends.uptake.me");
    expect(publicOrigin(h({ host: "0.0.0.0:3000", "x-forwarded-host": "trends.uptake.me", "x-forwarded-proto": "https" }))).toBe("https://trends.uptake.me");
  });

  it("keeps localhost in development", () => {
    expect(publicOrigin(h({ host: "localhost:3000" }))).toBe("http://localhost:3000");
  });

  it("ignores any other host", () => {
    expect(publicOrigin(h({ host: "evil.example" }))).toBe(SITE_URL);
    expect(publicOrigin(h({}))).toBe(SITE_URL);
  });
});
