import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClock } from "../cadence/clock";
import { fastForward, nextNudgeAt } from "../cadence/engine";
import { issuePortalLink, openUploadSession, PORTAL_LINK_BASE } from "../portal/portalLink";
import { receiveUpload } from "../portal/upload";
import { uploadPageState } from "../portal/uploadPage";
import { openStore, type Store } from "../store/store";
import { markEscalationHandled } from "./escalations";
import { receiveClientText } from "./inbound";
import { createTools } from "./tools";
import { runAssistant, type ModelClient } from "./run";

const NOW = new Date("2026-11-16T15:00:00Z");
const PRIYA = "client-03"; // silent: a `silence` Escalation is open on her income DMI dmi-03
const FILE = { choice: "Pay stub", fileName: "stub.png", mediaType: "image/png", bytes: Buffer.from("SPECIMEN pay stub") };

describe("a Client who comes back after a silence Escalation", () => {
  let store: Store;
  let ran: ReturnType<typeof vi.fn>;
  let model: ModelClient;
  beforeEach(() => {
    store = openStore(":memory:");
    store.reset(NOW);
    ran = vi.fn(async () => undefined);
    model = { beta: { messages: { create: vi.fn(), toolRunner: ran } } } as unknown as ModelClient;
  });
  afterEach(() => store.close());

  const deadline = () => store.list("dmis").find((d) => d.id === "dmi-03")!.deadline;
  const open = () => store.list("escalations").filter((e) => e.clientId === PRIYA && e.status === "open");
  const comeBackNotes = () => store.list("notifications").filter((n) => n.clientId === PRIYA && n.event.startsWith("client_came_back"));
  const token = (at = NOW) => {
    const link = issuePortalLink(store, PRIYA, "dmi-03", at);
    openUploadSession(store, link.url, at);
    return link;
  };
  const text = async (typed: string, at = NOW) => runAssistant(receiveClientText({ store, now: () => at }, PRIYA, typed), { store, now: () => at, model });
  const upload = async (url: string, at = NOW) => runAssistant(receiveUpload({ store, now: () => at }, url, FILE), { store, now: () => at, model });
  const afterDeadline = () => new Date(`${deadline()}T12:00:00Z`);

  it("starts with only a silence Escalation open", () => {
    expect(open().map((e) => e.trigger)).toEqual(["silence"]);
    expect(deadline() > NOW.toISOString().slice(0, 10)).toBe(true);
  });

  it("closes the Escalation on a text, runs the Assistant for that text and tells the Agent once", async () => {
    await text("hi, sorry, I was away");
    expect(open()).toEqual([]);
    expect(store.list("escalations").find((e) => e.trigger === "silence" && e.clientId === PRIYA)).toMatchObject({ status: "handled", handledAt: NOW.toISOString() });
    expect(ran).toHaveBeenCalledTimes(1);
    expect(comeBackNotes()).toMatchObject([{ event: "client_came_back_by_text", agentId: store.agent()!.id, at: NOW.toISOString() }]);
  });

  it("shows the normal upload form, and an upload closes the Escalation, runs the check and tells the Agent once", async () => {
    const link = token();
    expect(uploadPageState(store, link.url.slice(PORTAL_LINK_BASE.length), NOW)).toMatchObject({ kind: "open" });
    await upload(link.url);
    expect(open()).toEqual([]);
    expect(store.list("documents").filter((d) => d.dmiId === "dmi-03")).toHaveLength(1);
    expect(ran).toHaveBeenCalledTimes(1);
    expect(comeBackNotes()).toMatchObject([{ event: "client_came_back_by_upload" }]);
  });

  it("leaves nothing on the Agent view to clear: the Notification is the only trace, and no Escalation is raised", async () => {
    await text("back");
    expect(store.list("escalations").filter((e) => e.clientId === PRIYA && e.status === "open")).toEqual([]);
    expect(store.list("escalations").filter((e) => e.clientId === PRIYA)).toHaveLength(1);
  });

  it("changes nothing on or after the deadline: still escalated, no reply, the page says the Agent will contact them", async () => {
    const late = afterDeadline();
    const link = token(late);
    expect(uploadPageState(store, link.url.slice(PORTAL_LINK_BASE.length), late)).toMatchObject({ kind: "paused" });
    await text("hello?", late);
    expect(open().map((e) => e.trigger)).toEqual(["silence"]);
    expect(ran).not.toHaveBeenCalled();
    expect(comeBackNotes()).toEqual([]);
  });

  it("an upload on the deadline day itself changes nothing: still escalated, not checked, nobody notified", async () => {
    const link = token(afterDeadline());
    await upload(link.url, afterDeadline());
    expect(open().map((e) => e.trigger)).toEqual(["silence"]);
    expect(comeBackNotes()).toEqual([]);
    expect(ran).not.toHaveBeenCalled();
  });

  describe("with another Escalation open beside silence", () => {
    beforeEach(() => {
      store.add("escalations", {
        id: "esc-x", clientId: PRIYA, trigger: "income_or_application_change", summary: "New job", clientWords: null,
        suggestedNextStep: null, status: "open", raisedAt: NOW.toISOString(), handledAt: null,
      });
    });

    it("stays paused: the text gets no reply, both Escalations stay open and nobody is notified", async () => {
      await text("hi again");
      expect(open().map((e) => e.trigger).sort()).toEqual(["income_or_application_change", "silence"]);
      expect(ran).not.toHaveBeenCalled();
      expect(comeBackNotes()).toEqual([]);
    });

    it("keeps the upload page on 'Your agent will contact you' and takes no upload", async () => {
      const link = token();
      expect(uploadPageState(store, link.url.slice(PORTAL_LINK_BASE.length), NOW)).toMatchObject({ kind: "paused" });
      await upload(link.url);
      expect(open()).toHaveLength(2);
      expect(ran).not.toHaveBeenCalled();
      expect(comeBackNotes()).toEqual([]);
    });
  });

  it("when the other Escalation is already gone, silence closing leaves the Client unpaused", async () => {
    await text("back");
    expect(ran).toHaveBeenCalledTimes(1);
  });

  it("STOP and START come back as today: no reply, and STOP does not close the Escalation", async () => {
    await text("STOP");
    expect(ran).not.toHaveBeenCalled();
    expect(open().map((e) => e.trigger)).toEqual(["silence"]);
    expect(comeBackNotes()).toEqual([]);
    expect(store.list("clients").find((c) => c.id === PRIYA)!.optedOutAt).not.toBeNull();
  });

  it("counts the nudge schedule from the text, so a later silence escalates again", async () => {
    const later = new Date(NOW.getTime() + 2 * 86_400_000);
    await text("back", later);
    const nudgeAt = nextNudgeAt(store, PRIYA)!;
    expect(nudgeAt.getTime()).toBeGreaterThan(later.getTime());
    const clock = createClock(later);
    const tools = createTools({ store, now: clock.now, extract: async () => ({}) as never });
    await fastForward({ store, clock, tools }, 30);
    expect(open().map((e) => e.trigger)).toEqual(["silence"]);
  });

  it("counts the nudge schedule from an upload too", async () => {
    const later = new Date(NOW.getTime() + 2 * 86_400_000);
    const link = token(later);
    await upload(link.url, later);
    expect(nextNudgeAt(store, PRIYA)!.getTime()).toBeGreaterThan(later.getTime());
  });

  it("the Agent handling the Escalation first leaves nothing for the Client's text to close", async () => {
    markEscalationHandled(store, open()[0].id, NOW);
    await text("back");
    expect(comeBackNotes()).toEqual([]);
  });
});
