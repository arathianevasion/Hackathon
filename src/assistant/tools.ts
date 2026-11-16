import type { AssistantTools, ClientId, ConsentCheck, ConsentRecordId, ToolName } from "../contract";
import { judgeDocument } from "../documents/checks";
import type { ExtractedFields, InlineFile } from "../documents/extract";
import { dmiRules } from "../documents/rules";
import { applicationOf, submitToMarketplace } from "../marketplace/marketplace";
import { issuePortalLink, PORTAL_LINK_TTL_HOURS } from "../portal/portalLink";
import { toIsoDate } from "../dates";
import type { Store } from "../store/store";
import { maskSsns } from "./inbound";
import { disclosure } from "./replies";
import { screenOutbound } from "./outboundFilter";

/** The opt-out line every first text carries. */
const OPT_OUT_LINE = "Reply STOP to opt out";

/** The tools built so far; the rest of `AssistantTools` arrives with later tickets. */
export type Tools = Pick<
  AssistantTools,
  "check_consent" | "send_text" | "create_portal_link" | "lookup_dmi_rules" | "precheck_document" | "submit_documents"
>;

export interface ToolDeps {
  store: Store;
  now: () => Date;
  /** The separate, no-tools extraction call `precheck_document` makes (`extractFields`). */
  extract: (file: InlineFile) => Promise<ExtractedFields>;
}

/**
 * The Assistant's tools over the store. Every guardrail lives here, not in the
 * model (ADR 0001), and every call is written to the action log with the
 * Consent record it ran under.
 */
export function createTools({ store, now, extract }: ToolDeps): Tools {
  const log = (clientId: ClientId, tool: ToolName, consentRecordId: ConsentRecordId | null, result: string) =>
    store.add("actionLog", {
      id: `log-${store.list("actionLog").length + 1}`,
      clientId,
      tool,
      consentRecordId,
      result,
      at: now().toISOString(),
    });

  const check_consent: Tools["check_consent"] = async ({ clientId, action }) => {
    const result = consentFor(store, clientId, action, now());
    log(
      clientId,
      "check_consent",
      result.allowed ? result.consentRecordId : null,
      result.allowed ? `Allowed: ${action}` : `Refused: ${result.reason}`,
    );
    return result;
  };

  return {
    check_consent,
    async send_text({ clientId, text }) {
      const client = store.list("clients").find((c) => c.id === clientId);
      if (!client) throw new Error(`No Client ${clientId}`);
      const consent = await check_consent({ clientId, action: "text_outreach" });
      if (client.optedOutAt !== null) {
        log(clientId, "send_text", null, "Refused: opted_out");
        return { sent: false, reason: "opted_out" };
      }
      if (!consent.allowed) {
        log(clientId, "send_text", null, `Refused: no_consent (${consent.reason})`);
        return { sent: false, reason: "no_consent" };
      }
      // A reply to a Client's text is not a first text: only an empty Thread makes it one.
      const isFirstText = !store.list("messages").some((m) => m.clientId === clientId);
      if (isFirstText) {
        const agent = store.agent();
        if (!agent) throw new Error("No Agent");
        const seen = normalize(text);
        const lacks = !seen.includes(normalize(disclosure(agent.firstName)))
          ? "first text lacks the AI disclosure"
          : !seen.includes(normalize(OPT_OUT_LINE))
            ? `first text lacks "${OPT_OUT_LINE}"`
            : null;
        if (lacks) {
          log(clientId, "send_text", consent.consentRecordId, `Refused: ${lacks}`);
          return { sent: false, reason: "outbound_filter" };
        }
      }
      const openLinks = store
        .list("portalLinks")
        .filter((l) => l.clientId === clientId && l.usedAt === null && Date.parse(l.expiresAt) > now().getTime())
        .map((l) => l.url);
      const screening = screenOutbound(text, openLinks);
      if (!screening.ok) {
        log(clientId, "send_text", consent.consentRecordId, `Blocked by outbound filter: ${screening.blocked.join(", ")}`);
        return { sent: false, reason: "outbound_filter" };
      }
      const messageId = `msg-${store.list("messages").length + 1}`;
      store.add("messages", { id: messageId, clientId, sender: "assistant", sentAt: now().toISOString(), text });
      log(clientId, "send_text", consent.consentRecordId, "Text sent");
      return { sent: true, messageId };
    },
    async create_portal_link({ clientId, dmiId }) {
      const dmi = store.list("dmis").find((d) => d.id === dmiId && d.clientId === clientId);
      if (!dmi) throw new Error(`${dmiId} is not a DMI of ${clientId}`);
      const consent = await check_consent({ clientId, action: "portal_link" });
      if (!consent.allowed) {
        log(clientId, "create_portal_link", null, `Refused: ${consent.reason}`);
        throw new Error(`No Portal link: ${consent.reason}`);
      }
      const { url, expiresAt } = issuePortalLink(store, clientId, dmiId, now());
      log(clientId, "create_portal_link", consent.consentRecordId, `Portal link issued, expires in ${PORTAL_LINK_TTL_HOURS} hours`);
      return { url, dmiId, expiresAt };
    },
    async lookup_dmi_rules({ dmiType }) {
      const { acceptableDocuments, defaultDeadlineDays } = dmiRules(dmiType);
      return { dmiType, acceptableDocuments, defaultDeadlineDays };
    },
    async precheck_document({ documentId }) {
      const doc = store.list("documents").find((d) => d.id === documentId);
      const file = store.list("documentFiles").find((f) => f.id === documentId);
      const dmi = store.list("dmis").find((d) => d.id === doc?.dmiId);
      const client = store.list("clients").find((c) => c.id === dmi?.clientId);
      if (!doc || !file || !dmi || !client) throw new Error(`No uploaded Document ${documentId}`);
      const consent = await check_consent({ clientId: client.id, action: "document_submission" });
      if (!consent.allowed) {
        log(client.id, "precheck_document", null, `Refused: ${consent.reason}`);
        throw new Error(`No document check: ${consent.reason}`);
      }
      // The model only extracts; the rules decide (ADR 0001). The fields, SSN included, go no further than this call.
      const fields = await extract({ mediaType: file.mediaType, base64: file.base64 });
      const judged = judgeDocument({
        dmiType: dmi.type,
        file,
        fields,
        client,
        application: applicationOf(store, client.id),
        today: toIsoDate(now()),
      });
      const precheck = { result: judged.result, reasons: judged.reasons.map(maskSsns) };
      const documentType = dmiRules(dmi.type).acceptableDocuments.find((d) => d.toLowerCase() === fields.documentType?.trim().toLowerCase());
      store.update("documents", { ...doc, documentType: documentType ?? doc.documentType, precheck });
      const label = precheck.result[0].toUpperCase() + precheck.result.slice(1);
      log(client.id, "precheck_document", consent.consentRecordId, precheck.reasons.length ? `${label}: ${precheck.reasons.join("; ")}` : label);
      return precheck;
    },
    async submit_documents({ dmiId, documentIds }) {
      const dmi = store.list("dmis").find((d) => d.id === dmiId);
      if (!dmi) throw new Error(`No DMI ${dmiId}`);
      const refuse = (why: string) => {
        log(dmi.clientId, "submit_documents", null, `Refused: ${why}`);
        return { submitted: false, dmiStatus: dmi.status };
      };
      if (documentIds.length === 0) return refuse("no Documents");
      if (dmi.status !== "open") return refuse(`DMI is ${dmi.status}`);
      const docs = documentIds.map((id) => store.list("documents").find((d) => d.id === id && d.dmiId === dmiId));
      // The guardrail: only Documents the deterministic checks found sufficient, and only once.
      const unfit = documentIds.find((id, i) => docs[i]?.precheck.result !== "sufficient");
      if (unfit) return refuse(`${unfit} is not sufficient`);
      const sent = documentIds.find((id, i) => docs[i]?.submission === "submitted");
      if (sent) return refuse(`${sent} was already submitted`);
      const consent = await check_consent({ clientId: dmi.clientId, action: "document_submission" });
      if (!consent.allowed) return refuse(consent.reason);
      const waiting = submitToMarketplace(store, dmi, docs.filter((d) => d !== undefined));
      const agent = store.agent();
      if (!agent) throw new Error("No Agent");
      store.add("notifications", {
        id: `note-${store.list("notifications").length + 1}`,
        agentId: agent.id,
        clientId: dmi.clientId,
        event: "documents_submitted",
        at: now().toISOString(),
      });
      log(dmi.clientId, "submit_documents", consent.consentRecordId, "Submitted to the Marketplace");
      return { submitted: true, dmiStatus: waiting.status };
    },
  };
}

/** Lower-case with curly apostrophes made straight, so typography doesn't fail the required phrases. */
function normalize(text: string): string {
  return text.replace(/[\u2018\u2019]/g, "'").toLowerCase();
}

function consentFor(store: Store, clientId: ClientId, action: Parameters<Tools["check_consent"]>[0]["action"], at: Date): ConsentCheck {
  const records = store.list("consentRecords").filter((r) => r.clientId === clientId);
  if (records.length === 0) return { allowed: false, reason: "no_consent" };
  const covering = records.filter((r) => r.actions.includes(action) && r.channels.includes("sms"));
  if (covering.length === 0) return { allowed: false, reason: "action_not_covered" };
  const live = covering.filter((r) => r.rescindedAt === null);
  if (live.length === 0) return { allowed: false, reason: "rescinded" };
  const current = live.find((r) => r.expiresAt === null || Date.parse(r.expiresAt) > at.getTime());
  if (!current) return { allowed: false, reason: "expired" };
  return { allowed: true, consentRecordId: current.id };
}
