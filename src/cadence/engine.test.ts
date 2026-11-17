import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTools } from "../assistant/tools";
import { openStore, type Store } from "../store/store";
import { createClock } from "./clock";
import { fastForward, runDueCadence, type CadenceDeps } from "./engine";

const T0 = new Date("2026-11-16T15:00:00Z"); // 10:00 local, inside the texting window
const DAY = 86_400_000;
const ROSA = "client-01"; // income DMI, 10 days left, CR-1041
const MARCUS = "client-02"; // income, 23 days left
const LENA = "client-05"; // SSN, 5 days left
const JUNE = "client-07"; // opted out

describe("the cadence engine", () => {
  let store: Store;
  let clock: ReturnType<typeof createClock>;
  let deps: CadenceDeps;
  beforeEach(() => {
    store = openStore(":memory:");
    store.reset(T0);
    clock = createClock(T0);
    deps = { store, clock, tools: createTools({ store, now: clock.now, extract: async () => ({}) as never }) };
  });
  afterEach(() => store.close());

  const firstText = (clientId: string, at = T0) =>
    store.add("messages", { id: `m-${store.list("messages").length + 1}`, clientId, sender: "assistant", sentAt: at.toISOString(), text: "first text" });
  const texts = (clientId: string) => store.list("messages").filter((m) => m.clientId === clientId && m.sender === "assistant").slice(1);
  const escalations = (clientId: string) => store.list("escalations").filter((e) => e.clientId === clientId);
  const afterDays = async (days: number) => {
    clock.advance(days * DAY);
    return runDueCadence(deps);
  };

  it("with more than 14 days left: nothing on day 2, a nudge on day 3, an Escalation on day 7", async () => {
    firstText(MARCUS);
    expect(await afterDays(2)).toEqual([]);
    expect(await afterDays(1)).toEqual([{ clientId: MARCUS, dmiId: "dmi-02", step: "nudge" }]);
    expect(await afterDays(3)).toEqual([]);
    expect(await afterDays(1)).toEqual([{ clientId: MARCUS, dmiId: "dmi-02", step: "escalate" }]);
    expect(texts(MARCUS)).toHaveLength(1);
    expect(escalations(MARCUS)).toMatchObject([{ trigger: "silence", status: "open" }]);
  });

  it("with 14 or fewer days left: a nudge on day 1, an Escalation on day 2", async () => {
    firstText(ROSA);
    expect(await afterDays(1)).toMatchObject([{ step: "nudge" }]);
    expect(await afterDays(1)).toMatchObject([{ step: "escalate" }]);
  });

  it("each nudge carries a fresh Portal link that is open and the first text's link is not reused", async () => {
    firstText(ROSA);
    const before = store.list("portalLinks").length;
    await afterDays(1);
    const links = store.list("portalLinks");
    expect(links).toHaveLength(before + 1);
    const fresh = links.at(-1)!;
    expect(fresh).toMatchObject({ clientId: ROSA, dmiId: "dmi-01", usedAt: null });
    expect(texts(ROSA)[0].text).toContain(fresh.url);
  });

  it("uses the SSN nudge wording from variant D for an SSN DMI", async () => {
    firstText(LENA);
    await afterDays(1);
    expect(texts(LENA)[0].text).toMatch(/^Hi Lena, just checking in\. Did you find your Social Security card\? Here's a fresh link, good for 3 days: https:\/\/portal\.example\/r\/\S+\nIf you can't find it, reply and I'll tell you what else works\.$/);
  });

  it("counts the schedule from the Client's last message, and a Client reply restarts it", async () => {
    firstText(MARCUS);
    clock.advance(2 * DAY);
    store.add("messages", { id: "m-reply", clientId: MARCUS, sender: "client", sentAt: clock.now().toISOString(), text: "give me a few days" });
    expect(await afterDays(2)).toEqual([]);
    expect(await afterDays(1)).toMatchObject([{ step: "nudge" }]);
  });

  it("sends no nudge and raises no second Escalation while an Escalation is open", async () => {
    firstText(ROSA);
    store.add("escalations", {
      id: "esc-x", clientId: ROSA, trigger: "income_or_application_change", summary: "s", clientWords: null,
      suggestedNextStep: null, status: "open", raisedAt: clock.now().toISOString(), handledAt: null,
    });
    expect(await afterDays(5)).toEqual([]);
    expect(texts(ROSA)).toHaveLength(0);
    expect(escalations(ROSA)).toHaveLength(1);
  });

  it("restarts the schedule from the moment an Escalation is handled", async () => {
    firstText(ROSA);
    await afterDays(2); // nudge and silence Escalation
    const [esc] = escalations(ROSA);
    store.update("escalations", { ...esc, status: "handled", handledAt: clock.now().toISOString() });
    expect(await afterDays(0)).toEqual([]);
    expect(await afterDays(1)).toMatchObject([{ step: "nudge" }]);
  });

  it("does nothing for an opted-out Client, one with no first text yet, or a DMI that is not open", async () => {
    firstText(JUNE);
    expect(await afterDays(30)).toEqual([]);
    expect(texts(JUNE)).toHaveLength(0);
    expect(escalations(JUNE)).toHaveLength(0);
  });

  it("respects quiet hours: a nudge due at night goes out when the window opens, the Escalation is not held", async () => {
    // First text at 20:00 local (01:00Z); the day-1 nudge falls due at 20:00 local... move to 22:00 local.
    const late = new Date("2026-11-17T03:00:00Z"); // 22:00 local
    clock.set(late);
    firstText(ROSA, late);
    clock.set(new Date("2026-11-18T03:00:00Z")); // nudge due, 22:00 local
    expect(await runDueCadence(deps)).toEqual([]);
    expect(texts(ROSA)).toHaveLength(0);
    clock.set(new Date("2026-11-18T12:59:00Z")); // 07:59 local
    expect(await runDueCadence(deps)).toEqual([]);
    clock.set(new Date("2026-11-18T13:00:00Z")); // 08:00 local
    expect(await runDueCadence(deps)).toMatchObject([{ step: "nudge" }]);
  });

  it("fast-forward advances the clock and fires every due event in order", async () => {
    firstText(MARCUS);
    const fired = await fastForward(deps, 7);
    expect(clock.now().getTime()).toBe(T0.getTime() + 7 * DAY);
    expect(fired.map((f) => f.step)).toEqual(["nudge", "escalate"]);
    expect(texts(MARCUS)).toHaveLength(1);
    expect(escalations(MARCUS)).toHaveLength(1);
  });
});
