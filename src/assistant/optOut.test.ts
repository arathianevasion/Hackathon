import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openStore, type Store } from "../store/store";
import { sendAgentText } from "./agentThread";
import { receiveClientText } from "./inbound";
import { runAssistant, type ModelClient } from "./run";
import { createTools } from "./tools";

const NOW = new Date("2026-11-16T15:00:00Z");
const LATER = new Date("2026-11-16T18:00:00Z");
const ROSA = "client-01";

describe("STOP and START", () => {
  let store: Store;
  const tools = (at = NOW) => createTools({ store, now: () => at, extract: () => Promise.reject(new Error("unused")) });
  const rosa = () => store.list("clients").find((c) => c.id === ROSA)!;
  const consents = () => store.list("consentRecords").filter((r) => r.clientId === ROSA);
  const notes = () => store.list("notifications").filter((n) => n.clientId === ROSA);
  beforeEach(() => {
    store = openStore(":memory:");
    store.reset(NOW);
  });
  afterEach(() => store.close());

  it("STOP rescinds the Consent record, marks the opt-out and sends the Agent one Notification", () => {
    receiveClientText({ store, now: () => NOW }, ROSA, "STOP");
    expect(rosa().optedOutAt).toBe(NOW.toISOString());
    expect(consents().every((r) => r.rescindedAt === NOW.toISOString())).toBe(true);
    expect(notes().map((n) => [n.event, n.agentId])).toEqual([["opted_out", store.agent()!.id]]);
  });

  it.each(["stop", " Stop. ", "STOP!", "unsubscribe", "Cancel", "END", "quit", "stopall"])("%j counts as STOP", (typed) => {
    receiveClientText({ store, now: () => NOW }, ROSA, typed);
    expect(rosa().optedOutAt).toBe(NOW.toISOString());
  });

  it.each(["please don't stop", "stop calling me at work", "I can't stop by today"])("%j is an ordinary text, not STOP", (typed) => {
    receiveClientText({ store, now: () => NOW }, ROSA, typed);
    expect(rosa().optedOutAt).toBeNull();
    expect(notes()).toEqual([]);
  });

  it("after STOP no text goes out to that Client from the Assistant or the Agent", async () => {
    receiveClientText({ store, now: () => NOW }, ROSA, "STOP");
    const before = store.list("messages").length;
    expect(await tools(LATER).send_text({ clientId: ROSA, text: "Hi Rosa" })).toEqual({ sent: false, reason: "opted_out" });
    expect(await sendAgentText({ store, now: () => LATER }, ROSA, "Hi Rosa")).toEqual({ sent: false, reason: "opted_out" });
    expect(store.list("messages").length).toBe(before);
    expect(await tools(LATER).check_consent({ clientId: ROSA, action: "text_outreach" })).toEqual({ allowed: false, reason: "rescinded" });
  });

  it("STOP twice makes one Notification", () => {
    receiveClientText({ store, now: () => NOW }, ROSA, "STOP");
    receiveClientText({ store, now: () => LATER }, ROSA, "STOP");
    expect(notes()).toHaveLength(1);
    expect(rosa().optedOutAt).toBe(NOW.toISOString());
  });

  it("START restores consent and texting", async () => {
    receiveClientText({ store, now: () => NOW }, ROSA, "STOP");
    receiveClientText({ store, now: () => LATER }, ROSA, "START");
    expect(rosa().optedOutAt).toBeNull();
    expect(consents().every((r) => r.rescindedAt === null)).toBe(true);
    expect(await tools(LATER).send_text({ clientId: ROSA, text: "Welcome back" })).toMatchObject({ sent: true });
  });

  it("START does not revive a Consent record rescinded some other way", () => {
    const other = consents()[0];
    store.update("consentRecords", { ...other, rescindedAt: "2026-11-10T12:00:00.000Z" });
    receiveClientText({ store, now: () => NOW }, ROSA, "STOP");
    receiveClientText({ store, now: () => LATER }, ROSA, "START");
    expect(consents()[0].rescindedAt).toBe("2026-11-10T12:00:00.000Z");
  });

  it("START from a Client who never opted out changes nothing", () => {
    receiveClientText({ store, now: () => NOW }, ROSA, "START");
    expect(rosa().optedOutAt).toBeNull();
    expect(consents().every((r) => r.rescindedAt === null)).toBe(true);
    expect(notes()).toEqual([]);
  });

  it("the Assistant does not run the model for STOP or START", async () => {
    const model: ModelClient = {
      beta: {
        messages: {
          toolRunner: () => Promise.reject(new Error("model must not be called")),
          create: () => Promise.reject(new Error("model must not be called")),
        },
      },
    } as unknown as ModelClient;
    for (const word of ["STOP", "START"]) {
      const event = receiveClientText({ store, now: () => NOW }, ROSA, word);
      await expect(runAssistant(event, { store, now: () => NOW, model })).resolves.toBeUndefined();
    }
  });
});
