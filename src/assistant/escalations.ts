import type { ClientId, EscalationId } from "../contract";
import type { Store } from "../store/store";

/** Refused because an Escalation is open for the Client: the Assistant is paused until the Agent marks it handled. */
export class AssistantPausedError extends Error {
  constructor(clientId: ClientId) {
    super(`The Assistant is paused for ${clientId}: an Escalation is open`);
    this.name = "AssistantPausedError";
  }
}

/** Whether the Assistant is paused for a Client: any Escalation of theirs is still open. */
export function isPaused(store: Store, clientId: ClientId): boolean {
  return store.list("escalations").some((e) => e.clientId === clientId && e.status === "open");
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
