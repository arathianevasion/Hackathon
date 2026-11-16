import type { IsoDate } from "./contract";

const DAY_MS = 86_400_000;

/** The UTC calendar date of a moment. */
export function toIsoDate(moment: Date): IsoDate {
  return moment.toISOString().slice(0, 10);
}

/** The calendar date `days` after `date` (negative for before). */
export function addDays(date: IsoDate, days: number): IsoDate {
  return toIsoDate(new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS));
}

/** Whole calendar days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}
