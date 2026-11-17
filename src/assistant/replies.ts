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

/** What the texts mean, per DMI type (Andrew's wording, 17 Nov 2026, #92): the answer to "What does this mean?", not an Escalation. */
function explainText(type: DmiType, deadline: IsoDate): string {
  const by = dueDateLabel(deadline);
  const tail = `The link shows what to send and lets you take a photo: ${PORTAL_LINK_SLOT}`;
  return type === "ssn"
    ? `It means the Marketplace needs one document to confirm your Social Security number. The number on your application didn't match Social Security's records. That's common, and you're not in trouble. A photo of your Social Security card works, and the page lists other documents. Without it by ${by}, your coverage could change. ${tail}`
    : `It means the Marketplace needs one document to confirm your income. The income on your application didn't match their records, like IRS data. That's common, and you're not in trouble. A recent pay stub, a letter from your employer or your 2025 tax return works. Without it by ${by}, your premium help could stop. ${tail}`;
}

/** The only wording the Assistant may send to a Client's reply; it picks one, never writes its own. */
export interface ReplyTexts {
  why: string;
  /** For confusion about the texts or the DMI. */
  explain: string;
  disclosure: string;
  ssn: string;
  /** The promise after "later"; null when no nudge is scheduled, so there is nothing to promise. */
  later: string | null;
  ready: string;
  /** For a topic unrelated to the DMI: the Assistant can't help, and offers the Agent. */
  unrelated: string;
  /** After the Client says yes to that offer and the Escalation is raised; carries a Portal link. */
  agentWillContact: string;
}

/** The replies on offer; after `quiet` days of silence each opens with the AI disclosure. */
export function replyTexts(input: { agentFirstName: string; dmiType: DmiType; deadline: IsoDate; quiet: boolean; checkInOn: IsoDate | null }): ReplyTexts {
  const ai = disclosure(input.agentFirstName);
  const open = (text: string) => (input.quiet ? `${ai} ${text}` : text);
  return {
    why: open(whyText(input.dmiType, input.deadline)),
    explain: open(explainText(input.dmiType, input.deadline)),
    disclosure: ai,
    ssn: open("Please don't send your Social Security number by text. The Marketplace needs a document, and the link shows which ones work."),
    later: input.checkInOn === null ? null : open(laterText(input.checkInOn)),
    ready: open(READY_TEXT),
    unrelated: open(unrelatedText(input.agentFirstName)),
    agentWillContact: open(agentWillContactText(input.agentFirstName)),
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

/** The reply to a topic unrelated to the DMI (#85, Andrew's wording): no answer, and an offer to have the Agent get in touch. */
export function unrelatedText(agentFirstName: string): string {
  return `Thanks for asking! I can only help with the document the Marketplace asked for, so I can't answer that here. Want ${agentFirstName}, your licensed agent, to contact you about it? Just reply yes and I'll pass it on.`;
}

/** The confirmation once the Client takes up that offer (#85, Andrew's wording); the link goes where the slot is. */
export function agentWillContactText(agentFirstName: string): string {
  return `Done. ${agentFirstName} will contact you about it. Your document for the Marketplace is still due, and your link still works: ${PORTAL_LINK_SLOT}`;
}
