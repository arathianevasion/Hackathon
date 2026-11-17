import type { ClientId, SendTextResult } from "../contract";
import type { Store } from "../store/store";
import { HANDED_BACK_LOGGED } from "./escalations";
import { deliverAgentText } from "./tools";

export interface AgentThreadDeps {
  store: Store;
  now: () => Date;
}

/**
 * The Agent texts the Client from the Thread, at any time and whether or not an
 * Escalation is open. The text starts "Kalyani here:" (the Agent's first name) so
 * the Client knows a person is writing. Once it goes out the Assistant holds its
 * replies and nudges for this Client until `handBackToAssistant`.
 */
export async function sendAgentText(deps: AgentThreadDeps, clientId: ClientId, text: string): Promise<SendTextResult> {
  const agent = deps.store.agent();
  if (!agent) throw new Error("No Agent");
  const prefix = `${agent.firstName} here:`;
  return deliverAgentText(deps, clientId, text.startsWith(prefix) ? text : `${prefix} ${text}`);
}

/**
 * The Agent taps "Hand back to the Assistant". With no Escalation open the
 * Assistant picks the Client up again; otherwise it stays paused until the
 * Escalation is marked handled.
 */
export function handBackToAssistant({ store, now }: AgentThreadDeps, clientId: ClientId): void {
  store.add("actionLog", {
    id: `log-${store.list("actionLog").length + 1}`,
    clientId,
    tool: "send_text",
    consentRecordId: null,
    result: HANDED_BACK_LOGGED,
    at: now().toISOString(),
  });
}
