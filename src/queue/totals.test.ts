import { describe, expect, it } from "vitest";
import type { QueueRow } from "./rank";
import { atRisk, filterQueue, queueTotals, windowUsedPercent } from "./totals";

function row(over: Partial<QueueRow>): QueueRow {
  return {
    clientId: "c",
    name: "Test",
    dmiType: "income",
    dmiStatus: "open",
    noticeDate: "2026-09-01",
    deadline: "2026-11-30",
    daysLeft: 30,
    escalated: false,
    ...over,
  };
}

const rows = [
  row({ clientId: "esc", escalated: true, daysLeft: 40 }),
  row({ clientId: "soon", daysLeft: 5 }),
  row({ clientId: "edge", daysLeft: 14 }),
  row({ clientId: "later", daysLeft: 15 }),
  row({ clientId: "sub", dmiStatus: "documents_submitted", daysLeft: 3 }),
  row({ clientId: "done", dmiStatus: "resolved", daysLeft: null }),
];

describe("atRisk", () => {
  it("is an open DMI two weeks or less from its deadline, or past it", () => {
    expect(rows.filter(atRisk).map((r) => r.clientId)).toEqual(["soon", "edge"]);
    expect(atRisk(row({ daysLeft: -2 }))).toBe(true);
  });
  it("is not a submitted or resolved DMI: the Marketplace has it", () => {
    expect(atRisk(row({ dmiStatus: "documents_submitted", daysLeft: 1 }))).toBe(false);
    expect(atRisk(row({ dmiStatus: "resolved", daysLeft: null }))).toBe(false);
  });
});

describe("queueTotals and filterQueue", () => {
  it("counts Escalations open, due soon, submitted and resolved", () => {
    expect(queueTotals(rows)).toEqual({ escalations: 1, due_soon: 2, submitted: 1, resolved: 1 });
  });
  it("filters the queue to one total, keeping the ranked order", () => {
    expect(filterQueue(rows, "escalations").map((r) => r.clientId)).toEqual(["esc"]);
    expect(filterQueue(rows, "due_soon").map((r) => r.clientId)).toEqual(["soon", "edge"]);
    expect(filterQueue(rows, "submitted").map((r) => r.clientId)).toEqual(["sub"]);
    expect(filterQueue(rows, "resolved").map((r) => r.clientId)).toEqual(["done"]);
  });
  it("shows everything with no filter", () => {
    expect(filterQueue(rows, null)).toHaveLength(6);
  });
});

describe("windowUsedPercent", () => {
  it("is the share of the window from notice to deadline already used", () => {
    expect(windowUsedPercent("2026-09-01", "2026-11-30", "2026-10-16")).toBe(50);
  });
  it("is clamped to 0 to 100", () => {
    expect(windowUsedPercent("2026-09-01", "2026-11-30", "2026-08-01")).toBe(0);
    expect(windowUsedPercent("2026-09-01", "2026-11-30", "2026-12-25")).toBe(100);
  });
});
