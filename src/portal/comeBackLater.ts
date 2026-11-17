import { laterText } from "../assistant/replies";
import { createTools } from "../assistant/tools";
import { nextNudgeAt } from "../cadence/engine";
import { localDate, QUIET_HOURS } from "../cadence/schedule";
import type { Store } from "../store/store";
import { PORTAL_LINK_BASE, uploadSession } from "./portalLink";

/** The words on the upload page's button, which the Thread records as the Client's own. */
export const COME_BACK_LATER_WORDS = "I'll come back later";

/**
 * The Client taps "I'll come back later" on the upload page: the link closes
 * for good, the tap counts as contact so the nudge schedule runs from it, and
 * the Assistant texts the promise naming the day the scheduled nudge goes out.
 * A link that is no longer open (expired, unknown, already closed) changes nothing.
 */
export async function comeBackLater({ store, now }: { store: Store; now: () => Date }, token: string): Promise<void> {
  const url = `${PORTAL_LINK_BASE}${token}`;
  const session = uploadSession(store, url, now());
  if (!session.ok) return;
  const { link } = session;
  store.update("portalLinks", { ...link, closedAt: now().toISOString() });
  store.add("messages", {
    id: `msg-${store.list("messages").length + 1}`,
    clientId: link.clientId,
    sender: "client",
    sentAt: now().toISOString(),
    text: COME_BACK_LATER_WORDS,
  });
  const checkIn = nextNudgeAt(store, link.clientId);
  // With no nudge scheduled (an Escalation is open, or the Client opted out) the Assistant promises nothing.
  if (!checkIn) return;
  const tools = createTools({ store, now, extract: async () => Promise.reject(new Error("Coming back later reads nothing")) });
  await tools.send_text({ clientId: link.clientId, text: laterText(localDate(checkIn, QUIET_HOURS)) });
}
