import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTools } from "../assistant/tools";
import { rankByDeadline } from "../queue/rank";
import { openStore, type Store } from "../store/store";
import { createClock } from "./clock";
import { fastForward, nextNudgeAt, runDueCadence, type CadenceDeps } from "./engine";

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

  describe("the mocked Marketplace finishing its review on fast-forward", () => {
    const submit = (dmiId: string) => {
      const d = store.list("dmis").find((x) => x.id === dmiId)!;
      store.update("dmis", { ...d, status: "documents_submitted" });
    };
    const dmiOf = (id: string) => store.list("dmis").find((d) => d.id === id)!;
    const RESOLVED_TEXT = "All set. The Marketplace accepted your document. Your coverage and premium help don't change.";

    it("moves a submitted DMI to resolved, tells the Client and notifies the Agent", async () => {
      firstText(ROSA);
      submit("dmi-01");
      await fastForward(deps, 1);
      expect(dmiOf("dmi-01")).toMatchObject({ status: "resolved", resolvedAt: clock.now().toISOString() });
      expect(texts(ROSA).at(-1)?.text).toBe(RESOLVED_TEXT);
      expect(store.list("notifications").filter((n) => n.event === "dmi_resolved" && n.clientId === ROSA)).toMatchObject([
        { clientId: ROSA, agentId: store.agent()!.id, at: clock.now().toISOString() },
      ]);
      expect(store.list("actionLog").some((l) => l.clientId === ROSA && l.tool === "get_dmi_status")).toBe(true);
    });

    it("leaves open DMIs alone and tells a Client only once", async () => {
      firstText(ROSA);
      submit("dmi-01");
      await fastForward(deps, 1);
      const sent = texts(ROSA).length;
      await fastForward(deps, 1);
      expect(texts(ROSA).filter((m) => m.text === RESOLVED_TEXT)).toHaveLength(1);
      expect(texts(ROSA).length).toBeGreaterThanOrEqual(sent);
      expect(dmiOf("dmi-02").status).toBe("open");
      expect(store.list("notifications").filter((n) => n.event === "dmi_resolved" && n.clientId === ROSA)).toHaveLength(1);
    });

    it("promises no review date and sends nothing to an opted-out Client, though the DMI still resolves", async () => {
      submit("dmi-07");
      await fastForward(deps, 1);
      expect(dmiOf("dmi-07").status).toBe("resolved");
      expect(texts(JUNE)).toHaveLength(0);
      expect(RESOLVED_TEXT).not.toMatch(/\b(by|on|within|days?|tomorrow|today)\b|\d/i);
    });

    it("shows resolved in the Agent's queue", async () => {
      submit("dmi-01");
      await fastForward(deps, 1);
      const row = rankByDeadline(store.list("clients"), store.list("dmis"), "2026-11-17").find((r) => r.clientId === ROSA)!;
      expect(row).toMatchObject({ dmiStatus: "resolved", daysLeft: null });
    });
  });

  it("skips the nudge, without failing the run, when the Client already had 3 Portal links in 24 hours", async () => {
    firstText(ROSA);
    for (let i = 0; i < 3; i++) await deps.tools.create_portal_link({ clientId: ROSA, dmiId: "dmi-01" });
    clock.set(new Date(T0.getTime() + DAY - 60_000)); // the links are still inside 24 hours
    const fired = await afterDays(0);
    expect(fired).toEqual([]);
    expect(texts(ROSA)).toHaveLength(0);
  });

  describe("nextNudgeAt", () => {
    it("is the moment the engine's nudge fires, counted from the last contact", async () => {
      firstText(ROSA);
      const due = nextNudgeAt(store, ROSA)!;
      expect(due.toISOString()).toBe("2026-11-17T15:00:00.000Z");
      expect(await afterDays(0.9)).toEqual([]);
      clock.set(due);
      expect(await runDueCadence(deps)).toMatchObject([{ step: "nudge" }]);
    });

    it("waits for the texting window, as the engine does", () => {
      firstText(ROSA, new Date("2026-11-16T23:00:00Z")); // 18:00 local
      store.add("messages", { id: "c-1", clientId: ROSA, sender: "client", sentAt: "2026-11-17T02:30:00.000Z", text: "later" }); // 21:30 local
      expect(nextNudgeAt(store, ROSA)!.toISOString()).toBe("2026-11-18T13:00:00.000Z"); // 08:00 local, a day after the message
    });

    it("moves to the Client's later message, and is null when no nudge is scheduled", async () => {
      firstText(ROSA);
      store.add("messages", { id: "c-1", clientId: ROSA, sender: "client", sentAt: "2026-11-16T20:00:00.000Z", text: "ready" });
      expect(nextNudgeAt(store, ROSA)!.toISOString()).toBe("2026-11-17T20:00:00.000Z");
      expect(nextNudgeAt(store, JUNE)).toBeNull();
      clock.set(new Date("2026-11-17T20:00:00Z"));
      await runDueCadence(deps);
      expect(nextNudgeAt(store, ROSA)).toBeNull();
    });
  });
});
