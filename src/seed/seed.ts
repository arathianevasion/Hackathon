import type {
  ActionLogEntry,
  Agent,
  Client,
  ClientId,
  ConsentRecord,
  Dmi,
  DmiType,
  Document,
  Enrollment,
  Escalation,
  EscalationTrigger,
  Household,
  IsoDateTime,
  Message,
  Notification,
  ToolName,
} from "../contract";
import { addDays, toIsoDate } from "../dates";

/** The scenario groups of the synthetic data set (ticket #5's roster). */
export type ScenarioGroup =
  | "happy_path"
  | "income_changed"
  | "silent"
  | "insufficient_twice"
  | "deadline_close"
  | "citizenship"
  | "opted_out"
  | "resolved"
  | "ordinary";

export const SCENARIO_GROUPS: readonly ScenarioGroup[] = [
  "happy_path",
  "income_changed",
  "silent",
  "insufficient_twice",
  "deadline_close",
  "citizenship",
  "opted_out",
  "resolved",
  "ordinary",
];

/** Everything the demo starts from. Every date is relative to the run date. */
export interface SeedData {
  agent: Agent;
  clients: Client[];
  households: Household[];
  enrollments: Enrollment[];
  dmis: Dmi[];
  documents: Document[];
  consentRecords: ConsentRecord[];
  messages: Message[];
  escalations: Escalation[];
  notifications: Notification[];
  actionLog: ActionLogEntry[];
  scenarioOf: Record<ClientId, ScenarioGroup>;
}

interface Roster {
  first: string;
  last: string;
  scenario: ScenarioGroup;
  dmi: DmiType;
  /** Days left on an open DMI; for a resolved one, days since it was resolved (negative). */
  daysLeft: number;
  consent: string;
  plan: string;
}

const ROSTER: Roster[] = [
  { first: "Rosa", last: "Delgado-Finch", scenario: "happy_path", dmi: "income", daysLeft: 10, consent: "CR-1041", plan: "Demo Silver 70" },
  { first: "Marcus", last: "Whitlow", scenario: "income_changed", dmi: "income", daysLeft: 23, consent: "CR-1007", plan: "Demo Silver 70" },
  { first: "Priya", last: "Anand-Holt", scenario: "silent", dmi: "income", daysLeft: 48, consent: "CR-1012", plan: "Demo Bronze 60" },
  { first: "Dmitri", last: "Okafor", scenario: "insufficient_twice", dmi: "income", daysLeft: 31, consent: "CR-1019", plan: "Demo Silver 70" },
  { first: "Lena", last: "Marsh", scenario: "deadline_close", dmi: "ssn", daysLeft: 5, consent: "CR-1022", plan: "Demo Gold 80" },
  { first: "Tomasz", last: "Rivera", scenario: "citizenship", dmi: "citizenship", daysLeft: 77, consent: "CR-1025", plan: "Demo Bronze 60" },
  { first: "June", last: "Albright", scenario: "opted_out", dmi: "income", daysLeft: 39, consent: "CR-1030", plan: "Demo Silver 70" },
  { first: "Harold", last: "Kim", scenario: "resolved", dmi: "income", daysLeft: -2, consent: "CR-0988", plan: "Demo Silver 70" },
  { first: "Bea", last: "Santos", scenario: "resolved", dmi: "ssn", daysLeft: -6, consent: "CR-0971", plan: "Demo Bronze 60" },
  { first: "Ollie", last: "Fenwick", scenario: "resolved", dmi: "income", daysLeft: -12, consent: "CR-0950", plan: "Demo Gold 80" },
  { first: "Carmen", last: "Ibsen", scenario: "ordinary", dmi: "income", daysLeft: 14, consent: "CR-1033", plan: "Demo Silver 70" },
  { first: "Wes", last: "Thornbury", scenario: "ordinary", dmi: "income", daysLeft: 19, consent: "CR-1034", plan: "Demo Bronze 60" },
  { first: "Ada", last: "Nkemelu", scenario: "ordinary", dmi: "ssn", daysLeft: 26, consent: "CR-1035", plan: "Demo Silver 70" },
  { first: "Felix", last: "Varga", scenario: "ordinary", dmi: "income", daysLeft: 34, consent: "CR-1036", plan: "Demo Gold 80" },
  { first: "Noor", last: "Haddad", scenario: "ordinary", dmi: "income", daysLeft: 44, consent: "CR-1037", plan: "Demo Silver 70" },
  { first: "Grace", last: "Pell", scenario: "ordinary", dmi: "income", daysLeft: 52, consent: "CR-1038", plan: "Demo Bronze 60" },
  { first: "Sami", last: "Lund", scenario: "ordinary", dmi: "ssn", daysLeft: 58, consent: "CR-1039", plan: "Demo Silver 70" },
  { first: "Ivy", last: "Castellano", scenario: "ordinary", dmi: "income", daysLeft: 63, consent: "CR-1040", plan: "Demo Gold 80" },
  { first: "Theo", last: "Marchetti", scenario: "ordinary", dmi: "income", daysLeft: 70, consent: "CR-1042", plan: "Demo Silver 70" },
  { first: "Hana", last: "Oyelaran", scenario: "ordinary", dmi: "income", daysLeft: 84, consent: "CR-1043", plan: "Demo Bronze 60" },
];

/** Ordinary Clients whose documents are already with the mocked Marketplace. */
const SUBMITTED = new Set(["Carmen", "Noor"]);

const DAY_MS = 86_400_000;
/** Days a resolved DMI's notice came before its resolution. */
const RESOLVED_AFTER_NOTICE_DAYS = 40;

function windowDays(type: DmiType): number {
  return type === "citizenship" || type === "immigration" ? 95 : 90;
}

/** Builds the demo data set with every date relative to `runDate`. */
export function buildSeed(runDate: Date): SeedData {
  const today = toIsoDate(runDate);
  const daysAgo = (n: number): IsoDateTime => new Date(runDate.getTime() - n * DAY_MS).toISOString();

  const agent: Agent = { id: "agent-1", firstName: "Andrew", lastName: "Example" };
  const seed: SeedData = {
    agent,
    clients: [],
    households: [],
    enrollments: [],
    dmis: [],
    documents: [],
    consentRecords: [],
    messages: [],
    escalations: [],
    notifications: [],
    actionLog: [],
    scenarioOf: {},
  };

  const log = (clientId: ClientId, consentRecordId: string, tool: ToolName, result: string, at: IsoDateTime) =>
    seed.actionLog.push({ id: `log-${seed.actionLog.length + 1}`, clientId, tool, consentRecordId, result, at });
  const escalate = (
    clientId: ClientId,
    trigger: EscalationTrigger,
    summary: string,
    clientWords: string | null,
    suggestedNextStep: string,
    raisedAt: IsoDateTime,
  ) =>
    seed.escalations.push({
      id: `esc-${seed.escalations.length + 1}`,
      clientId,
      trigger,
      summary,
      clientWords,
      suggestedNextStep,
      status: "open",
      raisedAt,
      handledAt: null,
    });
  const notify = (clientId: ClientId, event: Notification["event"], at: IsoDateTime) =>
    seed.notifications.push({ id: `note-${seed.notifications.length + 1}`, agentId: agent.id, clientId, event, at });
  const addDocument = (dmiId: string, n: number, doc: Omit<Document, "id" | "dmiId" | "fileName" | "watermark">) =>
    seed.documents.push({
      id: `${dmiId}-doc-${n}`,
      dmiId,
      fileName: `SPECIMEN-${doc.documentType.replace(/\W+/g, "-").toLowerCase()}-${n}.pdf`,
      watermark: "SPECIMEN",
      ...doc,
    });

  ROSTER.forEach((r, i) => {
    const n = String(i + 1).padStart(2, "0");
    const clientId = `client-${n}`;
    const householdId = `household-${n}`;
    const enrollmentId = `enrollment-${n}`;
    const dmiId = `dmi-${n}`;
    const resolved = r.scenario === "resolved";
    const submitted = SUBMITTED.has(r.first);

    const resolvedDaysAgo = resolved ? -r.daysLeft : 0;
    const noticeDate = resolved
      ? addDays(today, -(resolvedDaysAgo + RESOLVED_AFTER_NOTICE_DAYS))
      : addDays(today, r.daysLeft - windowDays(r.dmi));
    const grantedAt = `${addDays(noticeDate, -30)}T16:00:00.000Z`;

    seed.scenarioOf[clientId] = r.scenario;
    seed.clients.push({
      id: clientId,
      agentId: agent.id,
      householdId,
      firstName: r.first,
      lastName: r.last,
      phone: `+1 202-555-01${n}`,
      optedOutAt: r.scenario === "opted_out" ? daysAgo(1) : null,
    });
    seed.households.push({ id: householdId, applicationId: `DEMO-APP-${1000 + i + 1}`, clientId });
    seed.enrollments.push({
      id: enrollmentId,
      clientId,
      planName: r.plan,
      coverageYear: Number(today.slice(0, 4)),
      status: "active",
    });
    seed.dmis.push({
      id: dmiId,
      enrollmentId,
      clientId,
      type: r.dmi,
      noticeDate,
      deadline: addDays(noticeDate, windowDays(r.dmi)),
      status: resolved ? "resolved" : submitted ? "documents_submitted" : "open",
      resolvedAt: resolved ? daysAgo(resolvedDaysAgo) : null,
    });
    seed.consentRecords.push({
      id: r.consent,
      clientId,
      grantingAgentId: agent.id,
      actions: ["text_outreach", "portal_link", "document_submission"],
      channels: ["sms"],
      grantedAt,
      expiresAt: null,
      rescindedAt: null,
    });

    switch (r.scenario) {
      case "silent":
        log(clientId, r.consent, "send_text", "Initial text with Portal link", daysAgo(7));
        log(clientId, r.consent, "send_text", "Nudge", daysAgo(4));
        log(clientId, r.consent, "escalate_to_agent", "Silent for 7 days", daysAgo(0));
        escalate(
          clientId,
          "silence",
          "Initial text on day 0 and a nudge on day 3, no reply. The Assistant has paused contact until you decide.",
          null,
          "Call the Client, or tell the Assistant to keep trying before the Marketplace warnings.",
          daysAgo(0),
        );
        break;
      case "insufficient_twice":
        addDocument(dmiId, 1, {
          documentType: "W-2",
          uploadedAt: daysAgo(2),
          precheck: { result: "insufficient", reasons: ["Tax year is out of date"] },
          submission: "not_submitted",
        });
        addDocument(dmiId, 2, {
          documentType: "bank statement",
          uploadedAt: daysAgo(0),
          precheck: { result: "insufficient", reasons: ["Name is missing", "Not an accepted document type"] },
          submission: "not_submitted",
        });
        log(clientId, r.consent, "precheck_document", "Insufficient: stale tax year", daysAgo(2));
        log(clientId, r.consent, "precheck_document", "Insufficient: no name, not an accepted type", daysAgo(0));
        log(clientId, r.consent, "escalate_to_agent", "Second insufficient upload", daysAgo(0));
        escalate(
          clientId,
          "insufficient_twice",
          "Uploaded an out-of-date W-2, then a bank statement without a name. Both failed the pre-check.",
          "This is all I have, I do gig driving now.",
          "Ask about a gig-work statement or a letter of explanation.",
          daysAgo(0),
        );
        break;
      case "citizenship":
        log(clientId, r.consent, "escalate_to_agent", "Citizenship DMI detected", daysAgo(0));
        escalate(
          clientId,
          "citizenship_or_immigration_dmi",
          "Citizenship DMIs always go to you. The Assistant has not contacted the Client.",
          null,
          "Contact the Client yourself about proof of citizenship.",
          daysAgo(0),
        );
        break;
      case "opted_out":
        notify(clientId, "opted_out", daysAgo(1));
        break;
      case "resolved":
        addDocument(dmiId, 1, {
          documentType: r.dmi === "ssn" ? "Social Security card" : "pay stub",
          uploadedAt: daysAgo(resolvedDaysAgo + 5),
          precheck: { result: "sufficient", reasons: [] },
          submission: "submitted",
        });
        log(clientId, r.consent, "get_dmi_status", "Marketplace marked resolved", daysAgo(resolvedDaysAgo));
        notify(clientId, "dmi_resolved", daysAgo(resolvedDaysAgo));
        break;
      case "ordinary":
        if (submitted) {
          addDocument(dmiId, 1, {
            documentType: "pay stub",
            uploadedAt: daysAgo(2),
            precheck: { result: "sufficient", reasons: [] },
            submission: "submitted",
          });
          log(clientId, r.consent, "submit_documents", "Pay stubs submitted", daysAgo(1));
          notify(clientId, "documents_submitted", daysAgo(1));
        }
        break;
      // happy_path, income_changed and deadline_close start untouched: the live demo plays them out.
    }
  });

  return seed;
}
