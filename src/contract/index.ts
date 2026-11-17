/**
 * The shared contract: the data model, the Assistant's ten tool signatures and
 * the event names. Defined once; screens, the seed, the cadence engine and the
 * Assistant all import from here. Changing it is a contract change
 * (CODING_STANDARDS.md, Always ask).
 *
 * Vocabulary follows GLOSSARY.md. Dates are run-relative and stored as ISO
 * strings: `IsoDate` for calendar dates (notice date, deadline), `IsoDateTime`
 * for moments.
 */

/** A calendar date, `YYYY-MM-DD`. */
export type IsoDate = string;
/** A moment, ISO 8601 with time zone, e.g. `2026-11-16T14:05:00.000Z`. */
export type IsoDateTime = string;

export type AgentId = string;
export type ClientId = string;
export type HouseholdId = string;
export type EnrollmentId = string;
export type DmiId = string;
export type DocumentId = string;
export type ConsentRecordId = string;
export type MessageId = string;
export type EscalationId = string;
export type NotificationId = string;
export type ActionLogEntryId = string;

// ---------------------------------------------------------------- People

/** The licensed human insurance agent who owns a book of Clients. */
export interface Agent {
  id: AgentId;
  firstName: string;
  lastName: string;
}

/** The people on one Marketplace application. */
export interface Household {
  id: HouseholdId;
  /** Fictional Marketplace application id. */
  applicationId: string;
  /** The primary Household member. POC: the Client is the only Household member modelled. */
  clientId: ClientId;
}

/** The primary Household member, the person the Agent and Assistant deal with. */
export interface Client {
  id: ClientId;
  agentId: AgentId;
  householdId: HouseholdId;
  firstName: string;
  lastName: string;
  /** Fictional number in the 555-01xx range. */
  phone: string;
  /** When the Client replied STOP; the Assistant sends nothing while set. */
  optedOutAt: IsoDateTime | null;
}

// ---------------------------------------------------------------- Coverage

export type EnrollmentStatus = "active" | "ended";

/** A Household member's coverage in a specific plan. */
export interface Enrollment {
  id: EnrollmentId;
  clientId: ClientId;
  /** Obviously fictional plan name; never a real carrier. */
  planName: string;
  coverageYear: number;
  status: EnrollmentStatus;
}

export type DmiType = "income" | "ssn" | "citizenship" | "immigration";
export type DmiStatus = "open" | "documents_submitted" | "resolved" | "expired";

/** Data Matching Issue: must be resolved with Documents by its deadline. */
export interface Dmi {
  id: DmiId;
  enrollmentId: EnrollmentId;
  clientId: ClientId;
  type: DmiType;
  noticeDate: IsoDate;
  /** From the notice; 90 days after it (95 for citizenship or immigration) as fallback. */
  deadline: IsoDate;
  status: DmiStatus;
  resolvedAt: IsoDateTime | null;
}

export type PrecheckResult = "pending" | "sufficient" | "insufficient" | "ambiguous";
export type SubmissionStatus = "not_submitted" | "submitted";

/** A file a Client uploads through the portal to resolve a DMI. */
export interface Document {
  id: DocumentId;
  dmiId: DmiId;
  /** What the file is, e.g. "pay stub", "W-2", "Social Security card". */
  documentType: string;
  fileName: string;
  uploadedAt: IsoDateTime;
  precheck: { result: PrecheckResult; reasons: string[] };
  submission: SubmissionStatus;
  /** Every Document in the POC is synthetic and visibly marked. */
  watermark: "SPECIMEN";
}

// ---------------------------------------------------------------- Working with the Client

/** The kinds of action a Consent record can authorize. */
export type ConsentAction = "text_outreach" | "portal_link" | "document_submission";
export type ConsentChannel = "sms";

/** Documented, unrescinded permission from a Client for a given kind of action. */
export interface ConsentRecord {
  /** Shown on the action log, e.g. "CR-1041". */
  id: ConsentRecordId;
  clientId: ClientId;
  grantingAgentId: AgentId;
  actions: ConsentAction[];
  channels: ConsentChannel[];
  grantedAt: IsoDateTime;
  expiresAt: IsoDateTime | null;
  rescindedAt: IsoDateTime | null;
}

export type MessageSender = "assistant" | "client" | "agent";

/** One message in a Client's Thread. */
export interface Message {
  id: MessageId;
  clientId: ClientId;
  sender: MessageSender;
  sentAt: IsoDateTime;
  text: string;
}

/** The single running text conversation between a Client and the Assistant. */
export interface Thread {
  clientId: ClientId;
  messages: Message[];
}

// ---------------------------------------------------------------- Handover to the Agent

export type EscalationTrigger =
  | "income_or_application_change"
  | "citizenship_or_immigration_dmi"
  | "advice_or_low_confidence"
  | "insufficient_twice"
  | "name_or_ssn_mismatch"
  | "suspected_fraud"
  | "silence"
  /** The Client said yes to having the Agent contact them about a topic unrelated to their DMI; the only trigger that does not pause the Assistant. */
  | "client_asked_for_agent";
export type EscalationStatus = "open" | "handled";

/** A handover that requires the Agent to act. */
export interface Escalation {
  id: EscalationId;
  clientId: ClientId;
  trigger: EscalationTrigger;
  summary: string;
  /** The Client's own last words, when there are any. */
  clientWords: string | null;
  suggestedNextStep: string | null;
  status: EscalationStatus;
  raisedAt: IsoDateTime;
  handledAt: IsoDateTime | null;
}

export type NotificationEvent =
  | "opted_out"
  | "consent_rescinded"
  | "documents_submitted"
  | "dmi_resolved"
  | "portal_link_limit"
  /** The Client texted or uploaded before the DMI deadline, which closed their `silence` Escalation. */
  | "client_came_back_by_text"
  | "client_came_back_by_upload";

/** An informational message to the Agent that requires no action. */
export interface Notification {
  id: NotificationId;
  agentId: AgentId;
  clientId: ClientId;
  event: NotificationEvent;
  at: IsoDateTime;
}

/** One tool call, logged with the Consent record that authorized it. */
export interface ActionLogEntry {
  id: ActionLogEntryId;
  clientId: ClientId;
  tool: ToolName;
  consentRecordId: ConsentRecordId | null;
  result: string;
  at: IsoDateTime;
}

// ---------------------------------------------------------------- The ten Assistant tools

export interface ClientRecord {
  client: Client;
  household: Household;
  enrollments: Enrollment[];
}

export interface DmiRules {
  dmiType: DmiType;
  acceptableDocuments: string[];
  /** Fallback deadline when the notice gives none. */
  defaultDeadlineDays: number;
}

export type ConsentCheck =
  | { allowed: true; consentRecordId: ConsentRecordId }
  | { allowed: false; reason: "no_consent" | "expired" | "rescinded" | "action_not_covered" };

export type SendTextResult =
  | { sent: true; messageId: MessageId }
  | { sent: false; reason: "no_consent" | "opted_out" | "outbound_filter" | "quiet_hours" };

export interface PortalLink {
  url: string;
  dmiId: DmiId;
  expiresAt: IsoDateTime;
}

export interface SubmitResult {
  submitted: boolean;
  dmiStatus: DmiStatus;
}

/**
 * The only way the Assistant touches Clients, Documents, the mocked
 * Marketplace and the database (ADR 0001). Every guardrail lives in the
 * implementation of these, never in the model.
 */
export interface AssistantTools {
  get_client(input: { clientId: ClientId }): Promise<ClientRecord>;
  list_open_dmis(input: { clientId: ClientId }): Promise<Dmi[]>;
  lookup_dmi_rules(input: { dmiType: DmiType }): Promise<DmiRules>;
  check_consent(input: { clientId: ClientId; action: ConsentAction }): Promise<ConsentCheck>;
  send_text(input: { clientId: ClientId; text: string }): Promise<SendTextResult>;
  create_portal_link(input: { clientId: ClientId; dmiId: DmiId }): Promise<PortalLink>;
  precheck_document(input: { documentId: DocumentId }): Promise<Document["precheck"]>;
  submit_documents(input: { dmiId: DmiId; documentIds: DocumentId[] }): Promise<SubmitResult>;
  get_dmi_status(input: { dmiId: DmiId }): Promise<{ dmiId: DmiId; status: DmiStatus }>;
  escalate_to_agent(input: {
    clientId: ClientId;
    trigger: EscalationTrigger;
    summary: string;
    clientWords: string | null;
    suggestedNextStep: string | null;
  }): Promise<{ escalationId: EscalationId }>;
}

export type ToolName = keyof AssistantTools;

export const TOOL_NAMES = [
  "get_client",
  "list_open_dmis",
  "lookup_dmi_rules",
  "check_consent",
  "send_text",
  "create_portal_link",
  "precheck_document",
  "submit_documents",
  "get_dmi_status",
  "escalate_to_agent",
] as const satisfies readonly ToolName[];

// ---------------------------------------------------------------- Events

/** What an Agent did on the Agent view that the Assistant must react to. */
export type AgentActionKind = "posted_in_thread" | "escalation_handled" | "keep_trying";
/** "reminder": once before each Marketplace warning, after the Agent says keep trying. */
export type CadenceStep = "nudge" | "escalate" | "reminder";

/**
 * Events raised by screens, the mocked Marketplace and the cadence engine.
 * Each one triggers one Assistant run for that Client.
 */
export type DomainEvent =
  | { name: "dmi.detected"; clientId: ClientId; dmiId: DmiId }
  | { name: "client.message"; clientId: ClientId; messageId: MessageId }
  | { name: "document.uploaded"; clientId: ClientId; dmiId: DmiId; documentId: DocumentId }
  | { name: "cadence.step_due"; clientId: ClientId; dmiId: DmiId; step: CadenceStep }
  | { name: "agent.action"; clientId: ClientId; action: AgentActionKind };

export type EventName = DomainEvent["name"];

export const EVENT_NAMES = [
  "dmi.detected",
  "client.message",
  "document.uploaded",
  "cadence.step_due",
  "agent.action",
] as const satisfies readonly EventName[];
