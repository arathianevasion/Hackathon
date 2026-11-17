import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runDueCadence } from "../cadence/engine";
import { openStore, type Store } from "../store/store";
import { handBackToAssistant, sendAgentText } from "./agentThread";
import { agentInThread, isPaused } from "./escalations";
import { createTools } from "./tools";

const NOW = new Date("2026-11-16T15:00:00Z");
const LATER = new Date("2026-11-16T17:00:00Z");
const ROSA = "client-01";
const MARCUS = "client-02";

let store: Store;
beforeEach(() => {
  store = openStore(":memory:");
  store.reset(NOW);
});
afterEach(() => store.close());

const tools = (at: Date) => createTools({ store, now: () => at, extract: () => Promise.reject(new Error("none")) });
const deps = (at: Date) => ({ store, now: () => at });

describe("an Agent text in the Thread", () => {
  it("goes out from the Agent with the 'Andrew here:' prefix", async () => {
    const result = await sendAgentText(deps(NOW), ROSA, "Can you call me back today?");
    expect(result).toMatchObject({ sent: true });
    const last = store.list("messages").filter((m) => m.clientId === ROSA).at(-1)!;
    expect(last).toMatchObject({ sender: "agent", text: "Andrew here: Can you call me back today?" });
  });

  it("holds the Assistant for that Client until Hand back", async () => {
    await sendAgentText(deps(NOW), ROSA, "Hello");
    expect(agentInThread(store, ROSA)).toBe(true);
    expect(isPaused(store, ROSA)).toBe(true);
    const before = store.list("messages").length;
    await expect(tools(LATER).send_text({ clientId: ROSA, text: "Assistant reply" })).rejects.toThrow(/paused/);
    expect(store.list("messages").length).toBe(before);
  });

  it("sends no nudge for that Client while the Agent is in the Thread", async () => {
    // Marcus has an open DMI and a first text; a week of silence would nudge him.
    const clock = { now: () => new Date("2026-12-20T15:00:00Z") };
    store.add("messages", { id: "msg-first", clientId: MARCUS, sender: "assistant", sentAt: NOW.toISOString(), text: "first text" });
    await sendAgentText(deps(NOW), MARCUS, "Hello");
    const fired = await runDueCadence({ store, clock, tools: tools(clock.now()) });
    expect(fired.filter((f) => f.clientId === MARCUS)).toEqual([]);
    // Control: once handed back, the same silence is acted on.
    handBackToAssistant(deps(new Date("2026-11-16T16:00:00Z")), MARCUS);
    const after = await runDueCadence({ store, clock, tools: tools(clock.now()) });
    expect(after.filter((f) => f.clientId === MARCUS).length).toBeGreaterThan(0);
  });

  it("works while an Escalation is open, which keeps the Assistant paused after Hand back", async () => {
    await tools(NOW).escalate_to_agent({ clientId: MARCUS, trigger: "advice_or_low_confidence", summary: "s", clientWords: null, suggestedNextStep: null });
    expect(await sendAgentText(deps(NOW), MARCUS, "Calling you now")).toMatchObject({ sent: true });
    handBackToAssistant(deps(LATER), MARCUS);
    expect(agentInThread(store, MARCUS)).toBe(false);
    expect(isPaused(store, MARCUS)).toBe(true);
  });

  it("refuses a Client who opted out, and posts nothing", async () => {
    const client = store.list("clients").find((c) => c.id === ROSA)!;
    store.update("clients", { ...client, optedOutAt: NOW.toISOString() });
    const before = store.list("messages").length;
    expect(await sendAgentText(deps(NOW), ROSA, "Hi")).toEqual({ sent: false, reason: "opted_out" });
    expect(store.list("messages").length).toBe(before);
    expect(agentInThread(store, ROSA)).toBe(false);
  });
});

describe("Hand back to the Assistant", () => {
  it("resumes the Assistant when no Escalation is open", async () => {
    await sendAgentText(deps(NOW), ROSA, "Hello");
    handBackToAssistant(deps(LATER), ROSA);
    expect(agentInThread(store, ROSA)).toBe(false);
    expect(isPaused(store, ROSA)).toBe(false);
    expect(await tools(LATER).send_text({ clientId: ROSA, text: "Back with you." })).toMatchObject({ sent: true });
  });

  it("starts the nudge schedule afresh from the hand back", async () => {
    await sendAgentText(deps(NOW), MARCUS, "Hello");
    handBackToAssistant(deps(LATER), MARCUS);
    const nextDay = { now: () => new Date("2026-11-17T16:00:00Z") };
    const fired = await runDueCadence({ store, clock: nextDay, tools: tools(nextDay.now()) });
    expect(fired.filter((f) => f.clientId === MARCUS && f.step === "escalate")).toEqual([]);
  });
});
