import type { IsoDate } from "../contract";
import { daysBetween } from "../dates";

/** The spec's nudge schedule: days after the last contact. */
export interface Cadence {
  nudgeAfterDays: number;
  escalateAfterDays: number;
}

/** At this many days left or fewer, the compressed schedule applies. */
export const COMPRESSED_AT_DAYS_LEFT = 14;

/** The cadence for a DMI with `daysLeft` days to its deadline (spec, "Nudge schedule"). */
export function cadenceFor(daysLeft: number): Cadence {
  return daysLeft > COMPRESSED_AT_DAYS_LEFT ? { nudgeAfterDays: 3, escalateAfterDays: 7 } : { nudgeAfterDays: 1, escalateAfterDays: 2 };
}

/** Whole days from the date of `at` to the deadline. */
export function daysLeftOn(at: Date, deadline: IsoDate): number {
  return daysBetween(at.toISOString().slice(0, 10), deadline);
}

/** Texts go out only inside this local window (the spec gives no hours; configurable). */
export interface QuietHours {
  /** First hour texts may go out, local. */
  openHour: number;
  /** First hour texts may not, local. */
  closeHour: number;
  /** The Clients' offset from UTC; the POC has one time zone. */
  utcOffsetHours: number;
}

export const QUIET_HOURS: QuietHours = { openHour: 8, closeHour: 21, utcOffsetHours: -5 };

/** Whether `at` falls outside the hours texts may go out. */
export function inQuietHours(at: Date, hours: QuietHours): boolean {
  const local = (at.getUTCHours() + hours.utcOffsetHours + 24) % 24;
  return local < hours.openHour || local >= hours.closeHour;
}

/** The Clients' local calendar date at `at`, as an ISO date. */
export function localDate(at: Date, hours: QuietHours): IsoDate {
  return new Date(at.getTime() + hours.utcOffsetHours * 3_600_000).toISOString().slice(0, 10);
}
