import { describe, expect, it } from "vitest";
import { buildSeed, SCENARIO_GROUPS, type ScenarioGroup } from "./seed";

const RUN_DATE = new Date("2026-11-16T15:00:00Z");

function clientsIn(seed: ReturnType<typeof buildSeed>, group: ScenarioGroup) {
  return seed.clients.filter((c) => seed.scenarioOf[c.id] === group);
}

function dmiOf(seed: ReturnType<typeof buildSeed>, firstName: string) {
  const client = seed.clients.find((c) => c.firstName === firstName)!;
  return seed.dmis.find((d) => d.clientId === client.id)!;
}

describe("buildSeed", () => {
  it("creates 20 Clients for one Agent", () => {
    const seed = buildSeed(RUN_DATE);
    expect(seed.clients).toHaveLength(20);
    expect(new Set(seed.clients.map((c) => c.agentId))).toEqual(new Set([seed.agent.id]));
  });

  it("spreads the Clients over the 9 scenario groups as the roster sets out", () => {
    const seed = buildSeed(RUN_DATE);
    expect(SCENARIO_GROUPS).toHaveLength(9);
    const counts = Object.fromEntries(SCENARIO_GROUPS.map((g) => [g, clientsIn(seed, g).length]));
    expect(counts).toEqual({
      happy_path: 1,
      income_changed: 1,
      silent: 1,
      insufficient_twice: 1,
      deadline_close: 1,
      citizenship: 1,
      opted_out: 1,
      resolved: 3,
      ordinary: 10,
    });
  });

  it("gives every Client a Household, an Enrollment, one DMI and a Consent record", () => {
    const seed = buildSeed(RUN_DATE);
    for (const client of seed.clients) {
      expect(seed.households.filter((h) => h.id === client.householdId && h.clientId === client.id)).toHaveLength(1);
      expect(seed.enrollments.filter((e) => e.clientId === client.id)).toHaveLength(1);
      expect(seed.dmis.filter((d) => d.clientId === client.id)).toHaveLength(1);
      expect(seed.consentRecords.filter((r) => r.clientId === client.id)).toHaveLength(1);
    }
  });

  it("dates DMIs relative to the run date", () => {
    const seed = buildSeed(RUN_DATE);
    expect(dmiOf(seed, "Rosa")).toMatchObject({ type: "income", noticeDate: "2026-08-28", deadline: "2026-11-26", status: "open" });
    expect(dmiOf(seed, "Lena")).toMatchObject({ deadline: "2026-11-21" });

    const later = buildSeed(new Date("2027-03-01T09:00:00Z"));
    expect(dmiOf(later, "Rosa")).toMatchObject({ noticeDate: "2026-12-11", deadline: "2027-03-11" });
  });

  it("gives a citizenship DMI the 95-day window", () => {
    const seed = buildSeed(RUN_DATE);
    expect(dmiOf(seed, "Tomasz")).toMatchObject({ type: "citizenship", noticeDate: "2026-10-29", deadline: "2027-02-01" });
  });

  it("marks the resolved Clients' DMIs resolved in the recent past", () => {
    const seed = buildSeed(RUN_DATE);
    const resolved = clientsIn(seed, "resolved").map((c) => seed.dmis.find((d) => d.clientId === c.id)!);
    expect(resolved.map((d) => d.status)).toEqual(["resolved", "resolved", "resolved"]);
    expect(resolved.map((d) => d.resolvedAt)).toEqual([
      "2026-11-14T15:00:00.000Z",
      "2026-11-10T15:00:00.000Z",
      "2026-11-04T15:00:00.000Z",
    ]);
  });

  it("opens Escalations for the silent, insufficient-twice and citizenship Clients only", () => {
    const seed = buildSeed(RUN_DATE);
    const byClient = seed.escalations.map((e) => [seed.scenarioOf[e.clientId], e.trigger, e.status]);
    expect(byClient).toEqual([
      ["silent", "silence", "open"],
      ["insufficient_twice", "insufficient_twice", "open"],
      ["citizenship", "citizenship_or_immigration_dmi", "open"],
    ]);
  });

  it("has the opted-out Client opted out with a Notification", () => {
    const seed = buildSeed(RUN_DATE);
    const [june] = clientsIn(seed, "opted_out");
    expect(june.optedOutAt).toBe("2026-11-15T15:00:00.000Z");
    expect(seed.notifications.filter((n) => n.clientId === june.id).map((n) => n.event)).toEqual(["opted_out"]);
    expect(seed.clients.filter((c) => c.optedOutAt !== null)).toEqual([june]);
  });

  it("marks every Document SPECIMEN", () => {
    const seed = buildSeed(RUN_DATE);
    expect(seed.documents.length).toBeGreaterThan(0);
    for (const doc of seed.documents) {
      expect(doc.watermark).toBe("SPECIMEN");
      expect(doc.fileName).toMatch(/^SPECIMEN-/);
    }
  });

  it("names no carriers: every plan is an obviously fictional Demo plan", () => {
    const seed = buildSeed(RUN_DATE);
    for (const e of seed.enrollments) expect(e.planName).toMatch(/^Demo (Bronze|Silver|Gold) \d+$/);
  });

  it("uses only fictional 555-01xx phone numbers", () => {
    const seed = buildSeed(RUN_DATE);
    for (const c of seed.clients) expect(c.phone).toMatch(/^\+1 202-555-01\d\d$/);
  });

  it("starts with an empty Thread for every Client", () => {
    expect(buildSeed(RUN_DATE).messages).toEqual([]);
  });

  it("logs every seeded action with the Client's Consent record", () => {
    const seed = buildSeed(RUN_DATE);
    expect(seed.actionLog.length).toBeGreaterThan(0);
    for (const entry of seed.actionLog) {
      const record = seed.consentRecords.find((r) => r.id === entry.consentRecordId);
      expect(record?.clientId).toBe(entry.clientId);
    }
  });
});
