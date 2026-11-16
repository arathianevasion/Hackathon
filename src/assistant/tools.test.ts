import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openStore, type Store } from "../store/store";
import { createTools, type Tools } from "./tools";

const NOW = new Date("2026-11-16T15:00:00Z");
const ROSA = "client-01"; // happy path, CR-1041
const JUNE = "client-07"; // opted out, CR-1030

describe("Assistant tools", () => {
  let store: Store;
  let now: Date;
  let tools: Tools;
  let seededLog: number;

  beforeEach(() => {
    store = openStore(":memory:");
    store.reset(NOW);
    now = NOW;
    tools = createTools({ store, now: () => now });
    seededLog = store.list("actionLog").length;
  });
  afterEach(() => store.close());

  const consentOf = (clientId: string) => store.list("consentRecords").find((c) => c.clientId === clientId)!;
  const newLogEntries = () => store.list("actionLog").slice(seededLog);

  describe("check_consent", () => {
    it("allows an action a current Consent record covers, and logs it with that record", async () => {
      const result = await tools.check_consent({ clientId: ROSA, action: "text_outreach" });
      expect(result).toEqual({ allowed: true, consentRecordId: "CR-1041" });
      expect(newLogEntries()).toMatchObject([
        { clientId: ROSA, tool: "check_consent", consentRecordId: "CR-1041", result: "Allowed: text_outreach", at: NOW.toISOString() },
      ]);
    });

    it("refuses when the Client has no Consent record, and logs the refusal", async () => {
      for (const record of store.list("consentRecords").filter((c) => c.clientId === ROSA)) {
        store.update("consentRecords", { ...record, clientId: "someone-else" });
      }
      expect(await tools.check_consent({ clientId: ROSA, action: "text_outreach" })).toEqual({ allowed: false, reason: "no_consent" });
      expect(newLogEntries()).toMatchObject([{ tool: "check_consent", consentRecordId: null, result: "Refused: no_consent" }]);
    });

    it("refuses a rescinded Consent record", async () => {
      store.update("consentRecords", { ...consentOf(ROSA), rescindedAt: "2026-11-10T12:00:00.000Z" });
      expect(await tools.check_consent({ clientId: ROSA, action: "text_outreach" })).toEqual({ allowed: false, reason: "rescinded" });
    });

    it("refuses an expired Consent record", async () => {
      store.update("consentRecords", { ...consentOf(ROSA), expiresAt: "2026-11-16T14:59:59.000Z" });
      expect(await tools.check_consent({ clientId: ROSA, action: "text_outreach" })).toEqual({ allowed: false, reason: "expired" });
    });

    it("refuses an action the Consent record does not cover", async () => {
      store.update("consentRecords", { ...consentOf(ROSA), actions: ["text_outreach"] });
      expect(await tools.check_consent({ clientId: ROSA, action: "portal_link" })).toEqual({
        allowed: false,
        reason: "action_not_covered",
      });
    });
  });
});
