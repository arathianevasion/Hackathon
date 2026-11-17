import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openStore, type Store } from "../store/store";
import { isPaused, markEscalationHandled } from "./escalations";
import { createTools } from "./tools";

const NOW = new Date("2026-11-16T15:00:00Z");
const LATER = new Date("2026-11-16T17:00:00Z");
const ROSA = "client-01";

describe("Mark handled", () => {
  let store: Store;
  beforeEach(() => {
    store = openStore(":memory:");
    store.reset(NOW);
  });
  afterEach(() => store.close());

  const tools = (at: Date) => createTools({ store, now: () => at, extract: () => Promise.reject(new Error("none")) });

  it("closes the Escalation and the Assistant can text the Client again", async () => {
    store.add("messages", { id: "msg-c", clientId: ROSA, sender: "client", sentAt: NOW.toISOString(), text: "hi" });
    const { escalationId } = await tools(NOW).escalate_to_agent({
      clientId: ROSA, trigger: "income_or_application_change", summary: "s", clientWords: "hi", suggestedNextStep: "n",
    });
    expect(isPaused(store, ROSA)).toBe(true);

    markEscalationHandled(store, escalationId, LATER);

    expect(store.list("escalations").find((e) => e.id === escalationId)).toMatchObject({ status: "handled", handledAt: LATER.toISOString() });
    expect(isPaused(store, ROSA)).toBe(false);
    expect(await tools(LATER).send_text({ clientId: ROSA, text: "Thanks for waiting." })).toMatchObject({ sent: true });
  });

  it("keeps the first handled time when marked twice", () => {
    const tomasz = store.list("escalations").find((e) => e.clientId === "client-06")!;
    markEscalationHandled(store, tomasz.id, NOW);
    markEscalationHandled(store, tomasz.id, LATER);
    expect(store.list("escalations").find((e) => e.id === tomasz.id)!.handledAt).toBe(NOW.toISOString());
  });
});
