import type { DmiType, IsoDate } from "../contract";
import { dueDateLabel, PORTAL_LINK_SLOT } from "./firstText";

/** Quiet days after which the AI disclosure is repeated. */
export const QUIET_DAYS_FOR_DISCLOSURE = 7;

/** The mask `maskSsns` leaves behind. */
export const SSN_MASK = /•••-••-\d{4}/;

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
}

/** The replies on offer; after `quiet` days of silence each opens with the AI disclosure. */
export function replyTexts(input: { agentFirstName: string; dmiType: DmiType; deadline: IsoDate; quiet: boolean }): ReplyTexts {
  const ai = disclosure(input.agentFirstName);
  const open = (text: string) => (input.quiet ? `${ai} ${text}` : text);
  return {
    why: open(whyText(input.dmiType, input.deadline)),
    disclosure: ai,
    ssn: open("Please don't send your Social Security number by text. The Marketplace needs a document, and the link shows which ones work."),
  };
}
