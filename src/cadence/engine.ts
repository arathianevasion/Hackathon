import type { ClientId, Dmi, DmiId, DmiType, Escalation, IsoDateTime, Message } from "../contract";
import { assistantTextsAbout, dueDateLabel } from "../assistant/firstText";
import type { Tools } from "../assistant/tools";
import type { Store } from "../store/store";
import type { Clock } from "./clock";
import { cadenceFor, daysLeftOn, inQuietHours, QUIET_HOURS, type QuietHours } from "./schedule";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
/** What the action log says when a nudge went out; the engine reads it back to know the nudge is done. */
const NUDGE_LOGGED = "Nudge sent";

export interface CadenceDeps {
  store: Store;
  clock: Clock;
  /** The Assistant's tools; every guardrail (consent, opt-out, outbound filter) stays in them. */
  tools: Pick<Tools, "create_portal_link" | "send_text">;
  quietHours?: QuietHours;
}

/** A step the engine fired: the `cadence.step_due` event of the contract, already handled. */
export interface FiredStep {
  clientId: ClientId;
  dmiId: DmiId;
  step: "nudge" | "escalate";
}

/** Variant D's nudge, verbatim for SSN; income follows its shape. */
function nudgeText(firstName: string, type: DmiType, link: string): string {
  const ask = type === "ssn" ? "Did you find your Social Security card?" : "Did you find your pay stub?";
  return `Hi ${firstName}, just checking in. ${ask} Here's a fresh link, good for 3 days: ${link}\nIf you can't find it, reply and I'll tell you what else works.`;
}

/**
 * The last contact: the Client's last message, or the first text when they have
 * not replied, or the moment an Escalation was last handed back, whichever is later.
 */
function lastContact(thread: Message[], escalations: Escalation[]): number | null {
  const fromClient = thread.filter((m) => m.sender === "client").at(-1);
  const first = thread.find((m) => m.sender === "assistant");
  const base = fromClient ?? first;
  if (!base) return null;
  const handed = escalations.flatMap((e) => (e.handledAt ? [Date.parse(e.handledAt)] : []));
  return Math.max(Date.parse(base.sentAt), ...handed);
}

/**
 * Fires every cadence step that is due at the clock's now, and returns them.
 * Timing is arithmetic on the last contact (spec, "Nudge schedule"); the model
 * is not involved. Silence raises a `silence` Escalation, which pauses the Assistant.
 */
export async function runDueCadence({ store, clock, tools, quietHours = QUIET_HOURS }: CadenceDeps): Promise<FiredStep[]> {
  const now = clock.now();
  const fired: FiredStep[] = [];
  for (const client of store.list("clients")) {
    if (client.optedOutAt !== null) continue;
    const escalations = store.list("escalations").filter((e) => e.clientId === client.id);
    if (escalations.some((e) => e.status === "open")) continue;
    const dmi = store
      .list("dmis")
      .filter((d) => d.clientId === client.id && d.status === "open" && assistantTextsAbout(d.type))
      .sort((a, b) => a.deadline.localeCompare(b.deadline))[0];
    const contact = dmi && lastContact(store.list("messages").filter((m) => m.clientId === client.id), escalations);
    if (!dmi || contact === null || contact === undefined) continue;

    const cadence = cadenceFor(daysLeftOn(new Date(contact), dmi.deadline));
    const nudged = store
      .list("actionLog")
      .some((l) => l.clientId === client.id && l.result === NUDGE_LOGGED && Date.parse(l.at) > contact);
    if (!nudged && now.getTime() >= contact + cadence.nudgeAfterDays * DAY_MS && !inQuietHours(now, quietHours)) {
      if (await nudge(store, tools, now, client.firstName, dmi)) fired.push({ clientId: client.id, dmiId: dmi.id, step: "nudge" });
    }
    if (now.getTime() >= contact + cadence.escalateAfterDays * DAY_MS) {
      escalate(store, client.id, now, contact);
      fired.push({ clientId: client.id, dmiId: dmi.id, step: "escalate" });
    }
  }
  return fired;
}

async function nudge(store: Store, tools: CadenceDeps["tools"], now: Date, firstName: string, dmi: Dmi): Promise<boolean> {
  const { url } = await tools.create_portal_link({ clientId: dmi.clientId, dmiId: dmi.id });
  const sent = await tools.send_text({ clientId: dmi.clientId, text: nudgeText(firstName, dmi.type, url) });
  if (!sent.sent) return false;
  store.add("actionLog", {
    id: `log-${store.list("actionLog").length + 1}`,
    clientId: dmi.clientId,
    tool: "send_text",
    consentRecordId: null,
    result: NUDGE_LOGGED,
    at: now.toISOString(),
  });
  return true;
}

function escalate(store: Store, clientId: ClientId, now: Date, contact: number): void {
  const at: IsoDateTime = now.toISOString();
  const last = store.list("messages").filter((m) => m.clientId === clientId && m.sender === "client").at(-1);
  store.add("escalations", {
    id: `esc-${store.list("escalations").length + 1}`,
    clientId,
    trigger: "silence",
    summary: `No reply for ${Math.floor((now.getTime() - contact) / DAY_MS)} days through the nudge schedule. The Assistant has paused contact until you decide.`,
    clientWords: last?.text ?? null,
    suggestedNextStep: "Call the Client, or tell the Assistant to keep trying before the Marketplace warnings.",
    status: "open",
    raisedAt: at,
    handledAt: null,
  });
  store.add("actionLog", {
    id: `log-${store.list("actionLog").length + 1}`,
    clientId,
    tool: "escalate_to_agent",
    consentRecordId: null,
    result: "Silent through the nudge schedule",
    at,
  });
}

/**
 * The demo's fast-forward: moves the clock ahead `days` days, an hour at a
 * time, firing what falls due at each hour (so nudges wait for the texting
 * window and run before the Escalation). Returns what fired, in order.
 */
export async function fastForward(deps: CadenceDeps, days: number): Promise<FiredStep[]> {
  const fired: FiredStep[] = [];
  for (let hours = 0; hours < days * 24; hours++) {
    deps.clock.advance(HOUR_MS);
    fired.push(...(await runDueCadence(deps)));
  }
  return fired;
}
