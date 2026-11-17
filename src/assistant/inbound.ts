import type { ClientId, DomainEvent } from "../contract";
import type { Store } from "../store/store";
import { assistantTextsAbout } from "./firstText";
import { closeSilenceOnReturn } from "./escalations";
import { applyOptKeyword, optKeyword } from "./optOut";

/** Nine digits shaped like an SSN, however separated (dashes, dots, spaces) or surrounded; over-masking beats leaking. */
const SSN_LIKE = /(?<!\d)\d{3}[-. ]*\d{2}[-. ]*\d{4}(?!\d)/g;

/** An SSN-like number as stored and shown: only the last 4 digits remain. */
export function maskSsns(text: string): string {
  return text.replace(SSN_LIKE, (ssn) => `•••-••-${ssn.slice(-4)}`);
}

/**
 * Takes a text the Client typed: masks any SSN to the last 4, stores it in
 * their Thread and returns the event that runs the Assistant. Nothing after
 * this point, the model included, sees the full number. STOP and START take
 * effect here, before anything else runs.
 */
export function receiveClientText(
  { store, now }: { store: Store; now: () => Date },
  clientId: ClientId,
  typed: string,
): Extract<DomainEvent, { name: "client.message" }> {
  if (!store.list("clients").some((c) => c.id === clientId)) throw new Error(`No Client ${clientId}`);
  const id = `msg-${store.list("messages").length + 1}`;
  store.add("messages", { id, clientId, sender: "client", sentAt: now().toISOString(), text: maskSsns(typed) });
  const keyword = optKeyword(typed);
  if (keyword) applyOptKeyword(store, clientId, keyword, now());
  // A Client who comes back before the deadline lifts a silence Escalation; STOP and START change nothing else.
  else {
    const dmi = store
      .list("dmis")
      .filter((d) => d.clientId === clientId && d.status === "open" && assistantTextsAbout(d.type))
      .sort((a, b) => a.deadline.localeCompare(b.deadline))[0];
    if (dmi) closeSilenceOnReturn(store, clientId, dmi.deadline, "text", now());
  }
  return { name: "client.message", clientId, messageId: id };
}
