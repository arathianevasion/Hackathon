import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openStore, type Store } from "../store/store";
import { redeemPortalLink } from "../portal/portalLink";
import { createTools, type Tools } from "./tools";

const NOW = new Date("2026-11-16T15:00:00Z");
const ROSA = "client-01"; // happy path, CR-1041
const JUNE = "client-07"; // opted out, CR-1030
const FIRST_TEXT_HEAD = "Hi Rosa, I'm the AI assistant for your insurance agent, Andrew. ";

describe("Assistant tools", () => {
  let store: Store;
  let now: Date;
  let tools: Tools;
  let seededLog: number;

  beforeEach(() => {
    store = openStore(":memory:");
    store.reset(NOW);
    now = NOW;
    tools = createTools({ store, now: () => now, extract: () => Promise.reject(new Error("No document in these tests")) });
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

    it("refuses a 4th link within 24 hours with a Notification to the Agent, and issues no link", async () => {
      for (let i = 0; i < 3; i++) await tools.create_portal_link({ clientId: ROSA, dmiId: "dmi-01" });
      const notesBefore = store.list("notifications").length;
      await expect(tools.create_portal_link({ clientId: ROSA, dmiId: "dmi-01" })).rejects.toThrow(/3 Portal links/);
      expect(store.list("portalLinks")).toHaveLength(3);
      expect(store.list("notifications").slice(notesBefore)).toEqual([
        { id: `note-${notesBefore + 1}`, agentId: store.agent()!.id, clientId: ROSA, event: "portal_link_limit", at: NOW.toISOString() },
      ]);
      expect(newLogEntries().at(-1)).toMatchObject({ tool: "create_portal_link", result: "Refused: 3 Portal links in 24 hours" });
    });

    it("does not pile up Notifications while the Client stays at the limit, and issues again once 24 hours have passed", async () => {
      for (let i = 0; i < 3; i++) await tools.create_portal_link({ clientId: ROSA, dmiId: "dmi-01" });
      const notesBefore = store.list("notifications").length;
      await expect(tools.create_portal_link({ clientId: ROSA, dmiId: "dmi-01" })).rejects.toThrow();
      await expect(tools.create_portal_link({ clientId: ROSA, dmiId: "dmi-01" })).rejects.toThrow();
      expect(store.list("notifications")).toHaveLength(notesBefore + 1);
      now = new Date(NOW.getTime() + 24 * 3_600_000);
      await expect(tools.create_portal_link({ clientId: ROSA, dmiId: "dmi-01" })).resolves.toMatchObject({ dmiId: "dmi-01" });
    });
  });

  describe("send_text", () => {
    const thread = (clientId: string) => store.list("messages").filter((m) => m.clientId === clientId);

    it("sends a text in the Thread as the Assistant, and logs it with the Consent record", async () => {
      const link = await tools.create_portal_link({ clientId: ROSA, dmiId: "dmi-01" });
      const text = `${FIRST_TEXT_HEAD}Everything you need is here: ${link.url}\nReply STOP to opt out.`;
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

    it("refuses a first text that lacks the AI disclosure, and logs the refusal", async () => {
      const link = await tools.create_portal_link({ clientId: ROSA, dmiId: "dmi-01" });
      const text = `Hi Rosa, everything you need is here: ${link.url}\nReply STOP to opt out.`;
      expect(await tools.send_text({ clientId: ROSA, text })).toEqual({ sent: false, reason: "outbound_filter" });
      expect(thread(ROSA)).toEqual([]);
      expect(newLogEntries().at(-1)).toMatchObject({
        tool: "send_text",
        consentRecordId: "CR-1041",
        result: "Refused: first text lacks the AI disclosure",
      });
    });

    it("refuses a first text that lacks \"Reply STOP to opt out\", and logs the refusal", async () => {
      const link = await tools.create_portal_link({ clientId: ROSA, dmiId: "dmi-01" });
      const text = `${FIRST_TEXT_HEAD}Everything you need is here: ${link.url}`;
      expect(await tools.send_text({ clientId: ROSA, text })).toEqual({ sent: false, reason: "outbound_filter" });
      expect(thread(ROSA)).toEqual([]);
      expect(newLogEntries().at(-1)).toMatchObject({
        tool: "send_text",
        consentRecordId: "CR-1041",
        result: "Refused: first text lacks \"Reply STOP to opt out\"",
      });
    });

    it("lets the variant D first text through with the link filled in", async () => {
      const link = await tools.create_portal_link({ clientId: ROSA, dmiId: "dmi-01" });
      const text = `Hi Rosa, I'm the AI assistant for your insurance agent, Andrew. The Marketplace needs proof of your income by Nov 26. Everything you need is here: ${link.url}\nReply with any questions. Reply STOP to opt out.`;
      expect(await tools.send_text({ clientId: ROSA, text })).toMatchObject({ sent: true });
    });

    it("accepts a first text with a curly apostrophe or different casing in the required phrases", async () => {
      const text = "Hi Rosa, I\u2019m the AI assistant for your insurance agent, Andrew. reply stop to opt out";
      expect(await tools.send_text({ clientId: ROSA, text })).toMatchObject({ sent: true });
    });

    it("does not hold an Assistant reply to a Client's text to the first-text check", async () => {
      store.add("messages", { id: "msg-in", clientId: ROSA, sender: "client", sentAt: NOW.toISOString(), text: "Why?" });
      expect(await tools.send_text({ clientId: ROSA, text: "It's a routine check." })).toMatchObject({ sent: true });
    });

    it("does not hold later texts to the first-text check", async () => {
      await tools.send_text({ clientId: ROSA, text: `${FIRST_TEXT_HEAD}Reply STOP to opt out.` });
      expect(await tools.send_text({ clientId: ROSA, text: "Thanks, that works." })).toMatchObject({ sent: true });
    });

    it("refuses a text the outbound filter blocks, and logs why without the text", async () => {
      await tools.send_text({ clientId: ROSA, text: `${FIRST_TEXT_HEAD}Reply STOP to opt out.` });
      seededLog = store.list("actionLog").length;
      expect(await tools.send_text({ clientId: ROSA, text: "Is your SSN 123-45-6789?" })).toEqual({
        sent: false,
        reason: "outbound_filter",
      });
      expect(thread(ROSA)).toHaveLength(1);
      const [, entry] = newLogEntries();
      expect(entry).toMatchObject({ tool: "send_text", consentRecordId: "CR-1041", result: "Blocked by outbound filter: ssn_like_number" });
    });

    it("lets out only Portal links issued to this Client", async () => {
      await tools.send_text({ clientId: ROSA, text: `${FIRST_TEXT_HEAD}Reply STOP to opt out.` });
      const marcusLink = await tools.create_portal_link({ clientId: "client-02", dmiId: "dmi-02" });
      expect(await tools.send_text({ clientId: ROSA, text: `Upload here: ${marcusLink.url}` })).toEqual({
        sent: false,
        reason: "outbound_filter",
      });
    });

    it("does not let out a Portal link that was already used or has expired", async () => {
      await tools.send_text({ clientId: ROSA, text: `${FIRST_TEXT_HEAD}Reply STOP to opt out.` });
      const used = await tools.create_portal_link({ clientId: ROSA, dmiId: "dmi-01" });
      redeemPortalLink(store, used.url, NOW);
      expect(await tools.send_text({ clientId: ROSA, text: `Upload here: ${used.url}` })).toEqual({ sent: false, reason: "outbound_filter" });
      const stale = await tools.create_portal_link({ clientId: ROSA, dmiId: "dmi-01" });
      now = new Date("2026-11-19T15:00:00Z");
      expect(await tools.send_text({ clientId: ROSA, text: `Upload here: ${stale.url}` })).toEqual({ sent: false, reason: "outbound_filter" });
    });
  });

  describe("escalate_to_agent", () => {
    const LENA = "client-05";
    const replyFrom = (clientId: string) =>
      store.add("messages", { id: `msg-c-${clientId}`, clientId, sender: "client", sentAt: NOW.toISOString(), text: "hi" });
    const escalate = (clientId: string) =>
      tools.escalate_to_agent({ clientId, trigger: "income_or_application_change", summary: "New job, lower pay.", clientWords: "hi", suggestedNextStep: "Call." });

    it("raises an open Escalation with all four parts", async () => {
      const { escalationId } = await escalate(ROSA);
      expect(store.list("escalations").find((e) => e.id === escalationId)).toMatchObject({
        clientId: ROSA, trigger: "income_or_application_change", summary: "New job, lower pay.", clientWords: "hi", suggestedNextStep: "Call.", status: "open", handledAt: null,
      });
    });

    it("pauses the Assistant for that Client: no texts, no Portal links, each refusal logged", async () => {
      replyFrom(ROSA);
      await escalate(ROSA);
      await expect(tools.send_text({ clientId: ROSA, text: "Any news?" })).rejects.toThrow(/paused/i);
      await expect(tools.create_portal_link({ clientId: ROSA, dmiId: "dmi-01" })).rejects.toThrow(/paused/i);
      expect(store.list("messages").filter((m) => m.sender === "assistant" && m.clientId === ROSA)).toEqual([]);
      expect(store.list("portalLinks")).toEqual([]);
      expect(newLogEntries().filter((e) => e.result.startsWith("Refused: paused")).map((e) => e.tool)).toEqual(["send_text", "create_portal_link"]);
    });

    it("pauses only that Client", async () => {
      replyFrom(LENA);
      await escalate(ROSA);
      expect(await tools.send_text({ clientId: LENA, text: "Any news?" })).toMatchObject({ sent: true });
    });
  });
});
