import type { AssistantTools, ClientId, ConsentCheck, ConsentRecordId, ToolName } from "../contract";
import { issuePortalLink, PORTAL_LINK_TTL_HOURS } from "../portal/portalLink";
import type { Store } from "../store/store";
import { disclosure } from "./replies";
import { screenOutbound } from "./outboundFilter";

/** The opt-out line every first text carries. */
const OPT_OUT_LINE = "Reply STOP to opt out";

/** The tools built so far; the rest of `AssistantTools` arrives with later tickets. */
export type Tools = Pick<AssistantTools, "check_consent" | "send_text" | "create_portal_link">;

export interface ToolDeps {
  store: Store;
  now: () => Date;
}

/**
 * The Assistant's tools over the store. Every guardrail lives here, not in the
 * model (ADR 0001), and every call is written to the action log with the
 * Consent record it ran under.
 */
export function createTools({ store, now }: ToolDeps): Tools {
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
      const isFirstText = !store.list("messages").some((m) => m.clientId === clientId && m.sender === "assistant");
      if (isFirstText) {
        const agent = store.list("agents").find((a) => a.id === client.agentId);
        if (!agent) throw new Error(`No Agent ${client.agentId}`);
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
