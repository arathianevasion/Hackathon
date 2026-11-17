import type { ClientId, EscalationId, EscalationTrigger, IsoDate } from "../contract";
import { toIsoDate } from "../dates";
import type { Store } from "../store/store";

/** Refused because the Assistant is paused for the Client: an Escalation is open, or the Agent is in the Thread. */
export class AssistantPausedError extends Error {
  constructor(clientId: ClientId) {
    super(`The Assistant is paused for ${clientId}: an Escalation is open or the Agent is in the Thread`);
    this.name = "AssistantPausedError";
  }
}

/**
 * What the action log says when the Agent texts in the Thread and when they hand
 * back. Whether the Agent is in the Thread is read back from the latest of the two.
 */
export const AGENT_TEXTED_LOGGED = "Agent text sent in the Thread";
export const HANDED_BACK_LOGGED = "Agent handed back to the AI Client Advocate";

/** Whether the Agent is in a Client's Thread: they texted, and have not handed back since. */
export function agentInThread(store: Store, clientId: ClientId): boolean {
  const last = store
    .list("actionLog")
    .filter((l) => l.clientId === clientId && (l.result === AGENT_TEXTED_LOGGED || l.result === HANDED_BACK_LOGGED))
    .at(-1);
  return last?.result === AGENT_TEXTED_LOGGED;
}

/** When the Agent last handed the Client back to the Assistant, as epoch ms; null if never. */
export function lastHandBackAt(store: Store, clientId: ClientId): number | null {
  const times = store
    .list("actionLog")
    .filter((l) => l.clientId === clientId && l.result === HANDED_BACK_LOGGED)
    .map((l) => Date.parse(l.at));
  return times.length ? Math.max(...times) : null;
}

/** Whether an Escalation with this trigger pauses the Assistant: every trigger does, except a Client asking for the Agent about something unrelated to their DMI. */
export function pausesAssistant(trigger: EscalationTrigger): boolean {
  return trigger !== "client_asked_for_agent";
}

/** Whether the Client has an open Escalation that pauses the Assistant. */
export function pausingEscalationOpen(store: Store, clientId: ClientId): boolean {
  return store.list("escalations").some((e) => e.clientId === clientId && e.status === "open" && pausesAssistant(e.trigger));
}

/** Whether the Assistant is paused for a Client: a pausing Escalation of theirs is open, or the Agent is in the Thread. */
export function isPaused(store: Store, clientId: ClientId): boolean {
  return pausingEscalationOpen(store, clientId) || agentInThread(store, clientId);
}

/**
 * Whether a `silence` Escalation is the only thing pausing the Client and the DMI
 * deadline has not been reached: then the Client coming back lifts it. On or after
 * the deadline, or with any other pausing Escalation open, it stays.
 */
export function silenceLiftedByReturn(store: Store, clientId: ClientId, deadline: IsoDate, at: Date): boolean {
  const pausing = store.list("escalations").filter((e) => e.clientId === clientId && e.status === "open" && pausesAssistant(e.trigger));
  return pausing.length > 0 && pausing.every((e) => e.trigger === "silence") && toIsoDate(at) < deadline;
}

/** Whether the Assistant is paused for a Client at a moment, counting a silence Escalation the Client can still lift by coming back before `deadline`. */
export function isPausedAt(store: Store, clientId: ClientId, deadline: IsoDate, at: Date): boolean {
  return agentInThread(store, clientId) || (pausingEscalationOpen(store, clientId) && !silenceLiftedByReturn(store, clientId, deadline, at));
}

/**
 * The Client came back by text or upload. Before the DMI deadline, with silence
 * the only pausing Escalation open, it closes as handled and the Agent gets one
 * Notification (no action needed). Returns whether it did.
 */
export function closeSilenceOnReturn(store: Store, clientId: ClientId, deadline: IsoDate, by: "text" | "upload", at: Date): boolean {
  if (!silenceLiftedByReturn(store, clientId, deadline, at)) return false;
  for (const e of store.list("escalations")) {
    if (e.clientId === clientId && e.status === "open" && e.trigger === "silence") markEscalationHandled(store, e.id, at);
  }
  const agent = store.agent();
  if (!agent) throw new Error("No Agent");
  store.add("notifications", {
    id: `note-${store.list("notifications").length + 1}`,
    agentId: agent.id,
    clientId,
    event: by === "text" ? "client_came_back_by_text" : "client_came_back_by_upload",
    at: at.toISOString(),
  });
  return true;
}

/**
 * The Agent marks an Escalation handled on the Agent view. Once the Client has
 * no other open Escalation, the Assistant picks them up again. Marking one that
 * is already handled changes nothing.
 */
export function markEscalationHandled(store: Store, escalationId: EscalationId, at: Date): void {
  const escalation = store.list("escalations").find((e) => e.id === escalationId);
  if (!escalation) throw new Error(`No Escalation ${escalationId}`);
  if (escalation.status === "handled") return;
  store.update("escalations", { ...escalation, status: "handled", handledAt: at.toISOString() });
}
