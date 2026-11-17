import { describe, expect, it } from "vitest";
import type { Client, Dmi, Escalation } from "../contract";
import { buildSeed } from "../seed/seed";
import { rankByDeadline } from "./rank";

function client(id: string, firstName: string): Client {
  return { id, agentId: "a", householdId: `h-${id}`, firstName, lastName: "Test", phone: "+1 202-555-0100", optedOutAt: null };
}

function dmi(clientId: string, deadline: string, status: Dmi["status"] = "open", resolvedAt: string | null = null): Dmi {
  return { id: `dmi-${clientId}`, enrollmentId: "e", clientId, type: "income", noticeDate: "2026-01-01", deadline, status, resolvedAt };
}

describe("rankByDeadline", () => {
  it("puts the soonest deadline first and gives the days left", () => {
    const rows = rankByDeadline(
      [client("1", "Late"), client("2", "Soon"), client("3", "Middle")],
      [dmi("1", "2026-12-30"), dmi("2", "2026-11-21"), dmi("3", "2026-12-01")],
      "2026-11-16",
      [],
    );
    expect(rows.map((r) => [r.name, r.daysLeft])).toEqual([
      ["Soon Test", 5],
      ["Middle Test", 15],
      ["Late Test", 44],
    ]);
  });

  it("keeps submitted DMIs in deadline order and puts resolved ones last, most recent first", () => {
    const rows = rankByDeadline(
      [client("1", "Old"), client("2", "Open"), client("3", "Recent"), client("4", "Submitted")],
      [
        dmi("1", "2026-11-17", "resolved", "2026-11-01T10:00:00.000Z"),
        dmi("2", "2026-12-20"),
        dmi("3", "2026-11-18", "resolved", "2026-11-14T10:00:00.000Z"),
        dmi("4", "2026-12-01", "documents_submitted"),
      ],
      "2026-11-16",
      [],
    );
    expect(rows.map((r) => [r.name, r.daysLeft, r.dmiStatus])).toEqual([
      ["Submitted Test", 15, "documents_submitted"],
      ["Open Test", 34, "open"],
      ["Recent Test", null, "resolved"],
      ["Old Test", null, "resolved"],
    ]);
  });

  it("shows a passed deadline as negative days left, ahead of everything else", () => {
    const rows = rankByDeadline(
      [client("1", "Future"), client("2", "Past")],
      [dmi("1", "2026-11-20"), dmi("2", "2026-11-14", "expired")],
      "2026-11-16",
      [],
    );
    expect(rows.map((r) => [r.name, r.daysLeft])).toEqual([
      ["Past Test", -2],
      ["Future Test", 4],
    ]);
  });

  it("ranks the seeded Clients: the three escalated first, then Lena at 5 days, Rosa at 10, the resolved three last", () => {
    const seed = buildSeed(new Date("2026-11-16T15:00:00Z"));
    const rows = rankByDeadline(seed.clients, seed.dmis, "2026-11-16", seed.escalations);
    expect(rows).toHaveLength(20);
    expect(rows.slice(0, 5).map((r) => [r.name, r.dmiType, r.daysLeft])).toEqual([
      ["Dmitri Okafor", "income", 31],
      ["Priya Anand-Holt", "income", 48],
      ["Tomasz Rivera", "citizenship", 77],
      ["Lena Marsh", "ssn", 5],
      ["Rosa Delgado-Finch", "income", 10],
    ]);
    expect(rows.slice(-3).map((r) => r.name)).toEqual(["Harold Kim", "Bea Santos", "Ollie Fenwick"]);
  });

  it("ranks Clients with an open Escalation first, by deadline, and flags them; a handled one ranks as usual", () => {
    const escalation = (clientId: string, status: Escalation["status"]): Escalation => ({
      id: `esc-${clientId}`, clientId, trigger: "silence", summary: "s", clientWords: null, suggestedNextStep: null, status, raisedAt: "2026-11-16T00:00:00Z", handledAt: null,
    });
    const rows = rankByDeadline(
      [client("1", "Soon"), client("2", "LateEscalated"), client("3", "Handled"), client("4", "MiddleEscalated")],
      [dmi("1", "2026-11-21"), dmi("2", "2026-12-30"), dmi("3", "2026-11-20"), dmi("4", "2026-12-01")],
      "2026-11-16",
      [escalation("2", "open"), escalation("3", "handled"), escalation("4", "open")],
    );
    expect(rows.map((r) => [r.name, r.escalated])).toEqual([
      ["MiddleEscalated Test", true],
      ["LateEscalated Test", true],
      ["Handled Test", false],
      ["Soon Test", false],
    ]);
  });
});
