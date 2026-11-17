import type { IsoDate } from "../contract";
import { daysBetween } from "../dates";
import type { QueueRow } from "./rank";

export type QueueFilter = "escalations" | "due_soon" | "submitted" | "resolved";
export const QUEUE_FILTERS: QueueFilter[] = ["escalations", "due_soon", "submitted", "resolved"];

/** Days left at or under which an open DMI is at risk and counts as due soon. */
const AT_RISK_DAYS = 14;

/** An open DMI two weeks or less from its deadline, or past it. Submitted DMIs are with the Marketplace. */
export function atRisk(row: QueueRow): boolean {
  return row.dmiStatus === "open" && row.daysLeft !== null && row.daysLeft <= AT_RISK_DAYS;
}

const MATCHES: Record<QueueFilter, (row: QueueRow) => boolean> = {
  escalations: (r) => r.escalated,
  due_soon: atRisk,
  submitted: (r) => r.dmiStatus === "documents_submitted",
  resolved: (r) => r.dmiStatus === "resolved",
};

export function queueTotals(rows: QueueRow[]): Record<QueueFilter, number> {
  return Object.fromEntries(QUEUE_FILTERS.map((f) => [f, rows.filter(MATCHES[f]).length])) as Record<QueueFilter, number>;
}

export function filterQueue(rows: QueueRow[], filter: QueueFilter | null): QueueRow[] {
  return filter ? rows.filter(MATCHES[filter]) : rows;
}

export function parseFilter(value: string | undefined): QueueFilter | null {
  return QUEUE_FILTERS.find((f) => f === value) ?? null;
}

/** The share of the window from notice to deadline already used, 0 to 100. */
export function windowUsedPercent(noticeDate: IsoDate, deadline: IsoDate, today: IsoDate): number {
  const total = daysBetween(noticeDate, deadline);
  if (total <= 0) return 100;
  return Math.min(100, Math.max(0, Math.round((daysBetween(noticeDate, today) / total) * 100)));
}
