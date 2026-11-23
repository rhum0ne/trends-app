import { describe, expect, it } from "vitest";
import { durationLabel, parisDateTime } from "./format";

describe("parisDateTime", () => {
  it("shows the day and time in Paris", () => {
    expect(parisDateTime("2026-11-23T05:30:00Z")).toBe("23 Nov, 06:30");
    expect(parisDateTime("2026-07-01T22:15:00Z")).toBe("2 Jul, 00:15");
  });
});

describe("durationLabel", () => {
  it("formats seconds, minutes and hours", () => {
    expect(durationLabel("2026-11-23T05:30:00Z", "2026-11-23T05:30:42Z")).toBe("42 s");
    expect(durationLabel("2026-11-23T05:30:00Z", "2026-11-23T05:33:10Z")).toBe("3 min");
    expect(durationLabel("2026-11-23T05:30:00Z", "2026-11-23T06:35:00Z")).toBe("1 h 05");
    expect(durationLabel("2026-11-23T05:30:00Z", null)).toBeNull();
  });
});
