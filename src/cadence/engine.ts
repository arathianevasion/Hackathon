import type { ClientId, Dmi, DmiId, DmiType, Escalation, IsoDateTime, Message } from "../contract";
import { assistantTextsAbout, dueDateLabel } from "../assistant/firstText";
import { isPaused, lastHandBackAt, pausesAssistant } from "../assistant/escalations";
import type { Tools } from "../assistant/tools";
import { finishMarketplaceReviews } from "../marketplace/marketplace";
import { PortalLinkLimitError } from "../portal/portalLink";
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
  tools: Pick<Tools, "create_portal_link" | "send_text" | "get_dmi_status">;
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
 * not replied, or the moment an Escalation was marked handled or the Agent handed
 * the Thread back, whichever is later.
 */
function lastContact(thread: Message[], escalations: Escalation[], handedBack: number | null): number | null {
  const fromClient = thread.filter((m) => m.sender === "client").at(-1);
  const first = thread.find((m) => m.sender === "assistant");
  const base = fromClient ?? first;
  if (!base) return null;
  // Handling an Escalation that never paused the Assistant changes nothing about its schedule.
  const handed = escalations.flatMap((e) => (e.handledAt && pausesAssistant(e.trigger) ? [Date.parse(e.handledAt)] : []));
  return Math.max(Date.parse(base.sentAt), ...handed, handedBack ?? 0);
}

/** The DMI the Assistant is working for a Client, their last contact and the cadence it puts them on. */
function scheduleFor(store: Store, clientId: ClientId, escalations: Escalation[]) {
  const dmi = store
    .list("dmis")
    .filter((d) => d.clientId === clientId && d.status === "open" && assistantTextsAbout(d.type))
    .sort((a, b) => a.deadline.localeCompare(b.deadline))[0];
  const contact = dmi && lastContact(store.list("messages").filter((m) => m.clientId === clientId), escalations, lastHandBackAt(store, clientId));
  if (!dmi || contact === null || contact === undefined) return null;
  const cadence = cadenceFor(daysLeftOn(new Date(contact), dmi.deadline));
  const nudged = store.list("actionLog").some((l) => l.clientId === clientId && l.result === NUDGE_LOGGED && Date.parse(l.at) > contact);
  return { dmi, contact, cadence, nudged };
}

/**
 * When the Client's scheduled nudge will go out: the cadence's nudge day after
 * their last contact, held to the texting window. Null when none is scheduled
 * (no open DMI, opted out, the Assistant paused, or the nudge already sent).
 * Anything that tells the Client when to expect the check-in reads it here.
 */
export function nextNudgeAt(store: Store, clientId: ClientId, quietHours: QuietHours = QUIET_HOURS): Date | null {
  const client = store.list("clients").find((c) => c.id === clientId);
  const escalations = store.list("escalations").filter((e) => e.clientId === clientId);
  if (!client || client.optedOutAt !== null || isPaused(store, clientId)) return null;
  const schedule = scheduleFor(store, clientId, escalations);
  if (!schedule || schedule.nudged) return null;
  let at = new Date(schedule.contact + schedule.cadence.nudgeAfterDays * DAY_MS);
  // Held to the moment the window opens: the first whole hour it is open.
  if (inQuietHours(at, quietHours)) at = new Date(Math.floor(at.getTime() / HOUR_MS) * HOUR_MS);
  while (inQuietHours(at, quietHours)) at = new Date(at.getTime() + HOUR_MS);
  return at;
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
    if (isPaused(store, client.id)) continue;
    const schedule = scheduleFor(store, client.id, escalations);
    if (!schedule) continue;
    const { dmi, contact } = schedule;

    const { cadence, nudged } = schedule;
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
  let url: string;
  try {
    ({ url } = await tools.create_portal_link({ clientId: dmi.clientId, dmiId: dmi.id }));
  } catch (error) {
    // At the cap the Agent has been notified; the nudge waits rather than stopping the run.
    if (error instanceof PortalLinkLimitError) return false;
    throw error;
  }
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

/** Variant D's resolved text, verbatim. It promises nothing beyond the Marketplace's decision, and no date. */
const RESOLVED_TEXT = "All set. The Marketplace accepted your document. Your coverage and premium help don't change.";

/**
 * The mocked Marketplace finishes its review of every submitted DMI. The Agent
 * is notified; the Assistant reads the status back and, where the tools allow
 * it, tells the Client. Fixed wording, no model call (ADR 0001).
 */
async function finishReviews({ store, tools }: CadenceDeps, now: Date): Promise<void> {
  const agent = store.agent();
  if (!agent) throw new Error("No Agent");
  for (const dmi of finishMarketplaceReviews(store, now)) {
    store.add("notifications", {
      id: `note-${store.list("notifications").length + 1}`,
      agentId: agent.id,
      clientId: dmi.clientId,
      event: "dmi_resolved",
      at: now.toISOString(),
    });
    const { status } = await tools.get_dmi_status({ dmiId: dmi.id });
    if (status === "resolved") await tools.send_text({ clientId: dmi.clientId, text: RESOLVED_TEXT });
  }
}

/**
 * The demo's fast-forward: moves the clock ahead `days` days, an hour at a
 * time, firing what falls due at each hour (so nudges wait for the texting
 * window and run before the Escalation), then lets the mocked Marketplace
 * finish reviewing what was submitted. Returns the cadence steps that fired.
 */
export async function fastForward(deps: CadenceDeps, days: number): Promise<FiredStep[]> {
  const fired: FiredStep[] = [];
  for (let hours = 0; hours < days * 24; hours++) {
    deps.clock.advance(HOUR_MS);
    fired.push(...(await runDueCadence(deps)));
  }
  await finishReviews(deps, deps.clock.now());
  return fired;
}
