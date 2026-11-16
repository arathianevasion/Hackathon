import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openStore, type Store } from "../store/store";
import { receiveClientText } from "./inbound";

const NOW = new Date("2026-11-16T15:00:00Z");
const ROSA = "client-01";

describe("receiveClientText", () => {
  let store: Store;
  beforeEach(() => {
    store = openStore(":memory:");
    store.reset(NOW);
  });
  afterEach(() => store.close());

  it("stores the Client's text in their Thread and returns the client.message event", () => {
    const event = receiveClientText({ store, now: () => NOW }, ROSA, "Why do they need this?");
    const stored = store.list("messages").filter((m) => m.clientId === ROSA);
    expect(stored.map((m) => [m.sender, m.text, m.sentAt])).toEqual([["client", "Why do they need this?", NOW.toISOString()]]);
    expect(event).toEqual({ name: "client.message", clientId: ROSA, messageId: stored[0].id });
  });

  it.each([
    ["my number is 123-45-6789", "my number is •••-••-6789"],
    ["123 45 6789 is it", "•••-••-6789 is it"],
    ["ssn:987654321.", "ssn:•••-••-4321."],
  ])("masks an SSN to the last 4 before storage: %s", (typed, masked) => {
    receiveClientText({ store, now: () => NOW }, ROSA, typed);
    const stored = store.list("messages").filter((m) => m.clientId === ROSA);
    expect(stored.map((m) => m.text)).toEqual([masked]);
    expect(JSON.stringify(store.list("messages"))).not.toMatch(/123-45-6789|123456789|987654321/);
  });

  it("rejects text for a Client that does not exist", () => {
    expect(() => receiveClientText({ store, now: () => NOW }, "nobody", "hi")).toThrow();
  });
});
