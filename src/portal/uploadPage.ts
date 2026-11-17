import { isPausedAt } from "../assistant/escalations";
import { dueDateLabel } from "../assistant/firstText";
import type { DmiType } from "../contract";
import { guidanceFor, type Guidance } from "../documents/guidance";
import type { Store } from "../store/store";
import { PORTAL_LINK_BASE, uploadSession } from "./portalLink";

/** One document the Client can pick on the upload page. */
export interface DocumentChoice {
  label: string;
  hint: string;
  /** What the Document is recorded as until the check reads it; null when the Client has none of these. */
  documentType: string | null;
}

/** The upload page's words per DMI type, verbatim from the client-conversation prototype, variant D. */
export interface UploadPageCopy {
  title: string;
  why: string;
  choices: DocumentChoice[];
  /** What a photo must show; on the income page, the parts the SPECIMEN example highlights. */
  must: string;
}

const COPY: Partial<Record<DmiType, UploadPageCopy>> = {
  income: {
    title: "Upload proof of income",
    why: "The Marketplace compared the income on your application with records from other sources, like the IRS, and they didn't match closely enough. It's routine.",
    choices: [
      { label: "Pay stub", hint: "Your most recent one. Easiest for most people.", documentType: "pay stub" },
      { label: "Letter from your employer", hint: "Must show your pay and how often you are paid.", documentType: "employer letter" },
      { label: "2025 tax return or W-2", hint: "Only if your pay is about the same this year.", documentType: "tax return or W-2" },
      { label: "I don't have any of these", hint: "Your agent will help.", documentType: null },
    ],
    must: "your name, your pay, the pay period and the pay date",
  },
  ssn: {
    title: "Upload a document with your Social Security number",
    why: "The Marketplace couldn't confirm the Social Security number on your application with Social Security's records. It's routine.",
    choices: [
      { label: "Social Security card", hint: "Easiest for most people.", documentType: "Social Security card" },
      { label: "W-2 or 1099", hint: "Must show your full name and number.", documentType: "W-2 or 1099" },
      { label: "Tax return", hint: "Must show your full name and number.", documentType: "tax return" },
      { label: "I don't have any of these", hint: "Your agent will help.", documentType: null },
    ],
    must: "your full name and your full Social Security number",
  },
};

/** The upload page's words for a DMI type the Assistant handles; citizenship and immigration go to the Agent. */
export function uploadPageCopy(type: DmiType): UploadPageCopy {
  const copy = COPY[type];
  if (!copy) throw new Error(`No upload page for ${type} DMIs`);
  return copy;
}

/** What the in-phone browser shows for a Portal link: never more than the first name, DMI type and due date. */
export type UploadPageState =
  | {
      kind: "open" | "submitted" | "later";
      firstName: string;
      dmiType: DmiType;
      due: string;
      copy: UploadPageCopy;
      /** The fixes after the latest upload failed its check; never the upload itself. */
      fixes: Guidance | null;
      /** How many uploads this DMI has had, so the page knows when a new one has been checked. */
      attempt: number;
    }
  /** An Escalation is open: the Agent will contact the Client, so the page asks for no upload. */
  | { kind: "paused"; agentFirstName: string }
  | { kind: "expired" };

/** The upload page for a Portal link token, inside its upload session; anything else reads as expired. */
export function uploadPageState(store: Store, token: string, at: Date): UploadPageState {
  const session = uploadSession(store, `${PORTAL_LINK_BASE}${token}`, at);
  const link = session.ok ? session.link : store.list("portalLinks").find((l) => l.url === `${PORTAL_LINK_BASE}${token}` && l.closedAt);
  if (!link) return { kind: "expired" };
  const dmi = store.list("dmis").find((d) => d.id === link.dmiId);
  const client = store.list("clients").find((c) => c.id === link.clientId);
  if (!dmi || !client) return { kind: "expired" };
  const agent = store.agent();
  if (agent && isPausedAt(store, client.id, dmi.deadline, at)) return { kind: "paused", agentFirstName: agent.firstName };
  const uploads = store.list("documents").filter((d) => d.dmiId === dmi.id);
  const latest = uploads.at(-1);
  return {
    kind: link.closedAt ? "later" : dmi.status === "documents_submitted" ? "submitted" : "open",
    firstName: client.firstName,
    dmiType: dmi.type,
    due: dueDateLabel(dmi.deadline),
    copy: uploadPageCopy(dmi.type),
    fixes: latest?.precheck.result === "insufficient" ? guidanceFor(latest.precheck.reasons) : null,
    attempt: uploads.length,
  };
}

/**
 * Changes whenever a rejected upload has left something to show (the fixes, or
 * the escalated page), so the page knows to scroll to it; null when there is nothing.
 */
export function feedbackKey(state: UploadPageState): string | null {
  if (state.kind === "paused") return "paused";
  if (state.kind === "open" && state.fixes) return `fixes-${state.attempt}`;
  return null;
}
