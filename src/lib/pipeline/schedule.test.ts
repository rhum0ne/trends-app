import { describe, expect, it } from "vitest";
import { EXPIRE_AT_PARIS_MINUTES } from "@/lib/heat";
import { DAILY_ALERT_AT_MINUTES, dailyMissing, decideDaily, decideHourly, forecastStatus, parisClock, type RunSummary } from "./schedule";

// 23 novembre 2026 : heure d'hiver, Paris = UTC+1
const at = (hhmm: string) => new Date(`2026-11-23T${hhmm}:00+01:00`);
const run = (status: RunSummary["status"], start: string, end: string | null = start): RunSummary => ({
  status,
  started_at: at(start).toISOString(),
  finished_at: end ? at(end).toISOString() : null,
});

describe("parisClock", () => {
  it("uses Paris time in winter and summer", () => {
    expect(parisClock(new Date("2026-11-23T05:30:00Z"))).toEqual({ day: "2026-11-23", minutes: 390 });
    expect(parisClock(new Date("2026-07-01T04:30:00Z"))).toEqual({ day: "2026-07-01", minutes: 390 });
  });
  it("rolls the day at Paris midnight, not UTC midnight", () => {
    expect(parisClock(new Date("2026-11-23T23:30:00Z")).day).toBe("2026-11-24");
  });
});

describe("decideDaily", () => {
  it("waits until 06:30", () => {
    expect(decideDaily(at("06:29"), [])).toEqual({ run: false, reason: "too_early" });
    expect(decideDaily(at("06:30"), [])).toEqual({ run: true, reason: "due" });
  });
  it("catches up a missed run later in the day", () => {
    expect(decideDaily(at("14:05"), [])).toEqual({ run: true, reason: "due" });
  });
  it("does nothing once a run succeeded", () => {
    expect(decideDaily(at("10:00"), [run("failed", "06:30", "06:31"), run("ok", "06:50", "06:55")])).toEqual({ run: false, reason: "done" });
  });
  it("does not start a second run while one is in progress", () => {
    expect(decideDaily(at("06:40"), [run("running", "06:30", null)])).toEqual({ run: false, reason: "in_progress" });
  });
  it("treats a run stuck for 30 minutes as dead and retries it", () => {
    expect(decideDaily(at("06:59"), [run("running", "06:30", null)])).toEqual({ run: false, reason: "in_progress" });
    expect(decideDaily(at("07:01"), [run("running", "06:30", null)])).toEqual({ run: true, reason: "retry" });
  });
  it("backs off 15 min, 1 h, then 3 h", () => {
    const one = [run("failed", "06:30", "06:32")];
    expect(decideDaily(at("06:46"), one).run).toBe(false);
    expect(decideDaily(at("06:47"), one)).toEqual({ run: true, reason: "retry" });
    const two = [...one, run("fallback", "06:47", "06:50")];
    expect(decideDaily(at("07:49"), two).run).toBe(false);
    expect(decideDaily(at("07:50"), two).run).toBe(true);
    const three = [...two, run("failed", "07:50", "07:51")];
    expect(decideDaily(at("10:50"), three).run).toBe(false);
    expect(decideDaily(at("10:51"), three).run).toBe(true);
  });
  it("gives up after 4 attempts in a day", () => {
    const runs = [run("failed", "06:30"), run("failed", "06:45"), run("failed", "07:45"), run("fallback", "10:45")];
    expect(decideDaily(at("20:00"), runs)).toEqual({ run: false, reason: "gave_up" });
  });
  it("does not count skipped runs as attempts", () => {
    expect(decideDaily(at("06:31"), [run("skipped", "06:30")])).toEqual({ run: true, reason: "due" });
  });
});

describe("expiry hour", () => {
  it("matches the daily_missing alert hour, after the morning analysis", () => {
    expect(EXPIRE_AT_PARIS_MINUTES).toBe(DAILY_ALERT_AT_MINUTES);
  });
});

describe("decideHourly", () => {
  it("runs when none ran in the last 55 minutes", () => {
    expect(decideHourly(at("10:00"), null)).toBe(true);
    expect(decideHourly(at("10:00"), at("09:10").toISOString())).toBe(false);
    expect(decideHourly(at("10:05"), at("09:10").toISOString())).toBe(true);
  });
});

describe("dailyMissing", () => {
  it("opens after 09:00 without a successful run and closes on success", () => {
    expect(dailyMissing(at("08:59"), [])).toBe("wait");
    expect(dailyMissing(at("09:00"), [run("failed", "06:30")])).toBe("open");
    expect(dailyMissing(at("11:00"), [run("ok", "10:30")])).toBe("close");
  });
});

describe("forecastStatus", () => {
  it("is scheduled for 06:30 Paris before the morning run, in winter and summer", () => {
    expect(forecastStatus(at("05:00"), [])).toEqual({ state: "scheduled", nextAt: new Date("2026-11-23T05:30:00Z") });
    expect(forecastStatus(new Date("2026-07-01T03:00:00Z"), [])).toEqual({ state: "scheduled", nextAt: new Date("2026-07-01T04:30:00Z") });
  });
  it("is running while the analysis runs, or when it is due right now", () => {
    expect(forecastStatus(at("06:40"), [run("running", "06:30", null)])).toEqual({ state: "running" });
    expect(forecastStatus(at("06:31"), [])).toEqual({ state: "running" });
  });
  it("gives the next attempt time while backing off", () => {
    expect(forecastStatus(at("06:40"), [run("failed", "06:30", "06:32")])).toEqual({ state: "retrying", nextAt: at("06:47") });
  });
  it("is delayed after the last attempt, and ready after a success", () => {
    const runs = [run("failed", "06:30"), run("failed", "06:45"), run("failed", "07:45"), run("fallback", "10:45")];
    expect(forecastStatus(at("20:00"), runs)).toEqual({ state: "delayed" });
    expect(forecastStatus(at("20:00"), [run("ok", "06:30")])).toEqual({ state: "ready" });
  });
});
