import type { DmiType, IsoDate } from "../contract";

/** Where the Portal link goes in the first text; the model puts the link it created there. */
export const PORTAL_LINK_SLOT = "{portal_link}";

/** What the Marketplace needs, per DMI type the Assistant texts about (wording from variant D). */
const NEEDS: Partial<Record<DmiType, string>> = {
  income: "proof of your income",
  ssn: "a document showing your Social Security number",
};

/** Whether the Assistant texts the Client about this DMI type; citizenship and immigration go to the Agent. */
export function assistantTextsAbout(type: DmiType): boolean {
  return NEEDS[type] !== undefined;
}

/** The due date as the Client reads it, e.g. "Nov 26". */
export function dueDateLabel(deadline: IsoDate): string {
  return new Date(`${deadline}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/**
 * The first text, verbatim from the client-conversation prototype, variant D:
 * the AI, the Agent, the DMI, the due date, the Portal link and STOP.
 */
export function firstText(input: { clientFirstName: string; agentFirstName: string; dmiType: DmiType; deadline: IsoDate }): string {
  const needs = NEEDS[input.dmiType];
  if (!needs) throw new Error(`The Assistant does not text about ${input.dmiType} DMIs`);
  return (
    `Hi ${input.clientFirstName}, I'm the AI assistant for your insurance agent, ${input.agentFirstName}. ` +
    `The Marketplace needs ${needs} by ${dueDateLabel(input.deadline)}. Everything you need is here: ${PORTAL_LINK_SLOT}\n` +
    `Reply with any questions. Reply STOP to opt out.`
  );
}
