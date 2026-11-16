import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openStore, type Store } from "../store/store";
import { redeemPortalLink } from "../portal/portalLink";
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

  describe("create_portal_link", () => {
    it("issues a Portal link for the DMI that expires 72 hours later, and logs it with the Consent record", async () => {
      const link = await tools.create_portal_link({ clientId: ROSA, dmiId: "dmi-01" });
      expect(link.dmiId).toBe("dmi-01");
      expect(link.url).toMatch(/^https:\/\/portal\.example\/r\/[A-Z0-9]{10}$/);
      expect(link.expiresAt).toBe("2026-11-19T15:00:00.000Z");
      expect(newLogEntries()).toMatchObject([
        { tool: "check_consent", consentRecordId: "CR-1041", result: "Allowed: portal_link" },
        { tool: "create_portal_link", consentRecordId: "CR-1041", result: "Portal link issued, expires in 72 hours" },
      ]);
    });

    it("issues a different link every time", async () => {
      const a = await tools.create_portal_link({ clientId: ROSA, dmiId: "dmi-01" });
      const b = await tools.create_portal_link({ clientId: ROSA, dmiId: "dmi-01" });
      expect(a.url).not.toBe(b.url);
    });

    it("opens once only", async () => {
      const link = await tools.create_portal_link({ clientId: ROSA, dmiId: "dmi-01" });
      expect(redeemPortalLink(store, link.url, NOW)).toMatchObject({ ok: true, link: { dmiId: "dmi-01", clientId: ROSA } });
      expect(redeemPortalLink(store, link.url, NOW)).toEqual({ ok: false, reason: "used" });
    });

    it("does not open after 72 hours", async () => {
      const link = await tools.create_portal_link({ clientId: ROSA, dmiId: "dmi-01" });
      expect(redeemPortalLink(store, link.url, new Date("2026-11-19T15:00:00Z"))).toEqual({ ok: false, reason: "expired" });
    });

    it("does not open a link it never issued", () => {
      expect(redeemPortalLink(store, "https://portal.example/r/NOTREAL123", NOW)).toEqual({ ok: false, reason: "unknown" });
    });

    it("refuses without consent for Portal links, issuing nothing", async () => {
      store.update("consentRecords", { ...consentOf(ROSA), actions: ["text_outreach"] });
      await expect(tools.create_portal_link({ clientId: ROSA, dmiId: "dmi-01" })).rejects.toThrow(/action_not_covered/);
      expect(store.list("portalLinks")).toEqual([]);
      expect(newLogEntries()).toMatchObject([
        { tool: "check_consent", result: "Refused: action_not_covered" },
        { tool: "create_portal_link", consentRecordId: null, result: "Refused: action_not_covered" },
      ]);
    });

    it("refuses a DMI that is not this Client's", async () => {
      await expect(tools.create_portal_link({ clientId: ROSA, dmiId: "dmi-02" })).rejects.toThrow(/dmi-02/);
      expect(store.list("portalLinks")).toEqual([]);
    });
  });

  describe("send_text", () => {
    const thread = (clientId: string) => store.list("messages").filter((m) => m.clientId === clientId);

    it("sends a text in the Thread as the Assistant, and logs it with the Consent record", async () => {
      const link = await tools.create_portal_link({ clientId: ROSA, dmiId: "dmi-01" });
      const text = `Everything you need is here: ${link.url}\nReply STOP to opt out.`;
      const result = await tools.send_text({ clientId: ROSA, text });
      expect(result).toMatchObject({ sent: true });
      expect(thread(ROSA)).toEqual([
        { id: result.sent ? result.messageId : "", clientId: ROSA, sender: "assistant", sentAt: NOW.toISOString(), text },
      ]);
      expect(newLogEntries().slice(-2)).toMatchObject([
        { tool: "check_consent", consentRecordId: "CR-1041", result: "Allowed: text_outreach" },
        { tool: "send_text", consentRecordId: "CR-1041", result: "Text sent" },
      ]);
    });

    it("refuses without consent", async () => {
      store.update("consentRecords", { ...consentOf(ROSA), rescindedAt: "2026-11-10T12:00:00.000Z" });
      expect(await tools.send_text({ clientId: ROSA, text: "Hi Rosa" })).toEqual({ sent: false, reason: "no_consent" });
      expect(thread(ROSA)).toEqual([]);
      expect(newLogEntries()).toMatchObject([
        { tool: "check_consent", result: "Refused: rescinded" },
        { tool: "send_text", consentRecordId: null, result: "Refused: no_consent (rescinded)" },
      ]);
    });

    it("refuses after the Client opted out", async () => {
      expect(await tools.send_text({ clientId: JUNE, text: "Hi June" })).toEqual({ sent: false, reason: "opted_out" });
      expect(thread(JUNE)).toEqual([]);
      expect(newLogEntries()).toMatchObject([
        { tool: "check_consent", consentRecordId: "CR-1030", result: "Allowed: text_outreach" },
        { tool: "send_text", consentRecordId: null, result: "Refused: opted_out" },
      ]);
    });

    it("refuses a text the outbound filter blocks, and logs why without the text", async () => {
      expect(await tools.send_text({ clientId: ROSA, text: "Is your SSN 123-45-6789?" })).toEqual({
        sent: false,
        reason: "outbound_filter",
      });
      expect(thread(ROSA)).toEqual([]);
      const [, entry] = newLogEntries();
      expect(entry).toMatchObject({ tool: "send_text", consentRecordId: "CR-1041", result: "Blocked by outbound filter: ssn_like_number" });
    });

    it("lets out only Portal links issued to this Client", async () => {
      const marcusLink = await tools.create_portal_link({ clientId: "client-02", dmiId: "dmi-02" });
      expect(await tools.send_text({ clientId: ROSA, text: `Upload here: ${marcusLink.url}` })).toEqual({
        sent: false,
        reason: "outbound_filter",
      });
    });

    it("does not let out a Portal link that was already used or has expired", async () => {
      const used = await tools.create_portal_link({ clientId: ROSA, dmiId: "dmi-01" });
      redeemPortalLink(store, used.url, NOW);
      expect(await tools.send_text({ clientId: ROSA, text: `Upload here: ${used.url}` })).toEqual({ sent: false, reason: "outbound_filter" });
      const stale = await tools.create_portal_link({ clientId: ROSA, dmiId: "dmi-01" });
      now = new Date("2026-11-19T15:00:00Z");
      expect(await tools.send_text({ clientId: ROSA, text: `Upload here: ${stale.url}` })).toEqual({ sent: false, reason: "outbound_filter" });
    });
  });
});
