import type { DmiType, IsoDate } from "../contract";
import { dueDateLabel, PORTAL_LINK_SLOT } from "./firstText";

/** Quiet days after which the AI disclosure is repeated. */
export const QUIET_DAYS_FOR_DISCLOSURE = 7;

/** The mask `maskSsns` leaves behind. */
export const SSN_MASK = /•••-••-\d{4}/;

/** The one question a Client gets when the income on their Document is far from the income on their application. Fixed wording: no amounts, no advice. */
export const CLARIFYING_QUESTION =
  "Thanks, I got your document. The income it shows looks different from the income on your application. Can you tell me why? For example, did your pay change, or do you have more than one job?";

/** The AI disclosure, as the first text words it (variant D). */
export function disclosure(agentFirstName: string): string {
  return `I'm the AI assistant for your insurance agent, ${agentFirstName}.`;
}

/** Whole days between the last message in a Thread and now. */
export function quietDays(lastAt: string, now: Date): number {
  return Math.floor((now.getTime() - Date.parse(lastAt)) / 86_400_000);
}

/** Why the Marketplace is asking, per DMI type; income is variant D's answer verbatim, SSN follows its shape. */
function whyText(type: DmiType, deadline: IsoDate): string {
  const by = dueDateLabel(deadline);
  return type === "ssn"
    ? `It's a routine check. The Marketplace couldn't confirm the Social Security number on your application with Social Security's records. Without a document by ${by}, your coverage could change. The link explains more: ${PORTAL_LINK_SLOT}`
    : `It's a routine check. The Marketplace couldn't match your income with its records. Without proof by ${by}, your premium help could stop. The link explains more: ${PORTAL_LINK_SLOT}`;
}

/** The only wording the Assistant may send to a Client's reply; it picks one, never writes its own. */
export interface ReplyTexts {
  why: string;
  disclosure: string;
  ssn: string;
  /** The promise after "later"; null when no nudge is scheduled, so there is nothing to promise. */
  later: string | null;
  ready: string;
}

/** The replies on offer; after `quiet` days of silence each opens with the AI disclosure. */
export function replyTexts(input: { agentFirstName: string; dmiType: DmiType; deadline: IsoDate; quiet: boolean; checkInOn: IsoDate | null }): ReplyTexts {
  const ai = disclosure(input.agentFirstName);
  const open = (text: string) => (input.quiet ? `${ai} ${text}` : text);
  return {
    why: open(whyText(input.dmiType, input.deadline)),
    disclosure: ai,
    ssn: open("Please don't send your Social Security number by text. The Marketplace needs a document, and the link shows which ones work."),
    later: input.checkInOn === null ? null : open(laterText(input.checkInOn)),
    ready: open(READY_TEXT),
  };
}

/**
 * The promise after "I'll come back later", by text or from the page (variant D,
 * Ada's wording): how to get a fresh link, and the day the scheduled nudge goes out.
 */
export function laterText(checkInOn: IsoDate): string {
  return `No rush. When you find it, text me "ready" and I'll send a fresh link. If I haven't heard from you, I'll check in on ${dueDateLabel(checkInOn)}.`;
}

/** The text that sends a fresh link once the Client says they have the document (variant D); the link goes where the slot is. */
export const READY_TEXT = `Great. Here's a new link, good for 3 days: ${PORTAL_LINK_SLOT}`;

/**
 * The text after a Client reports an income, household or application change,
 * verbatim from variant D (Marcus): no advice on what to report, only that the
 * Agent will be in touch and that nothing should be uploaded meanwhile.
 */
export function applicationChangeText(agentFirstName: string): string {
  return `It might. ${agentFirstName}, your licensed agent, needs to update your application, so I've passed this to him and he'll contact you. Please don't upload anything yet.`;
}
