import { describe, expect, it } from "vitest";
import { cadenceFor, inQuietHours, QUIET_HOURS } from "./schedule";

describe("cadenceFor (the spec's nudge schedule)", () => {
  it("with more than 14 days left: nudge on day 3, Escalation on day 7", () => {
    expect(cadenceFor(15)).toEqual({ nudgeAfterDays: 3, escalateAfterDays: 7 });
    expect(cadenceFor(48)).toEqual({ nudgeAfterDays: 3, escalateAfterDays: 7 });
  });
  it("with 14 or fewer days left: nudge on day 1, Escalation on day 2", () => {
    expect(cadenceFor(14)).toEqual({ nudgeAfterDays: 1, escalateAfterDays: 2 });
    expect(cadenceFor(5)).toEqual({ nudgeAfterDays: 1, escalateAfterDays: 2 });
  });
});

describe("inQuietHours", () => {
  // Window 8:00-21:00 at UTC-5: open 13:00Z to 02:00Z.
  it("is quiet before the window opens and from the window's end", () => {
    expect(inQuietHours(new Date("2026-11-16T12:59:00Z"), QUIET_HOURS)).toBe(true);
    expect(inQuietHours(new Date("2026-11-16T13:00:00Z"), QUIET_HOURS)).toBe(false);
    expect(inQuietHours(new Date("2026-11-17T01:59:00Z"), QUIET_HOURS)).toBe(false);
    expect(inQuietHours(new Date("2026-11-17T02:00:00Z"), QUIET_HOURS)).toBe(true);
  });
});
