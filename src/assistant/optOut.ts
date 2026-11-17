import type { ClientId } from "../contract";
import type { Store } from "../store/store";

/** The standard carrier opt-out words (CTIA), matched as the whole text. */
const STOP_WORDS = new Set(["stop", "stopall", "unsubscribe", "cancel", "end", "quit"]);
const START_WORDS = new Set(["start", "unstop"]);

/** Whether a Client's text is, in full, an opt-out or opt-in keyword; "stop calling me" is an ordinary text. */
export function optKeyword(text: string): "stop" | "start" | null {
  const word = text.toLowerCase().replace(/[^a-z]+/g, " ").trim().replace(/^stop all$/, "stopall");
  return STOP_WORDS.has(word) ? "stop" : START_WORDS.has(word) ? "start" : null;
}

/**
 * STOP: marks the Client opted out, rescinds their Consent records and tells
 * the Agent. START undoes exactly that, leaving records rescinded for any
 * other reason as they were. Repeats change nothing.
 */
export function applyOptKeyword(store: Store, clientId: ClientId, keyword: "stop" | "start", at: Date): void {
  const client = store.list("clients").find((c) => c.id === clientId);
  if (!client) throw new Error(`No Client ${clientId}`);
  const now = at.toISOString();
  if (keyword === "stop") {
    if (client.optedOutAt !== null) return;
    store.update("clients", { ...client, optedOutAt: now });
    for (const r of store.list("consentRecords").filter((r) => r.clientId === clientId && r.rescindedAt === null)) {
      store.update("consentRecords", { ...r, rescindedAt: now });
    }
    const agent = store.agent();
    if (agent) {
      store.add("notifications", { id: `note-${store.list("notifications").length + 1}`, agentId: agent.id, clientId, event: "opted_out", at: now });
    }
    return;
  }
  if (client.optedOutAt === null) return;
  for (const r of store.list("consentRecords").filter((r) => r.clientId === clientId && r.rescindedAt === client.optedOutAt)) {
    store.update("consentRecords", { ...r, rescindedAt: null });
  }
  store.update("clients", { ...client, optedOutAt: null });
}
