import type { DmiType, EscalationTrigger, NotificationEvent } from "../src/contract";
import { daysBetween, toIsoDate } from "../src/dates";
import { rankByDeadline } from "../src/queue/rank";
import { demoStore } from "../src/store/demo";
import { cookies } from "next/headers";
import Link from "next/link";
import { SESSION_COOKIE, SESSION_VALUE } from "../src/agentSession";
import { atRisk, filterQueue, parseFilter, QUEUE_FILTERS, queueTotals, windowUsedPercent, type QueueFilter } from "../src/queue/totals";
import { assistantTextsAbout } from "../src/assistant/firstText";
import { uploadPageState } from "../src/portal/uploadPage";
import { demoClock } from "../src/cadence/demo";
import { agentInThread } from "../src/assistant/escalations";
import { fastForwardDemo, handBack, markHandled, openDmi, resetDemo, sendAgentTextAction, signOut } from "./actions";
import { AutoRefresh } from "./AutoRefresh";
import { PhoneSimulator } from "./PhoneSimulator";
import { SignIn } from "./SignIn";

export const dynamic = "force-dynamic";

const NOTIFICATION_LABEL: Record<NotificationEvent, string> = {
  opted_out: "Opted out",
  consent_rescinded: "Consent rescinded",
  documents_submitted: "Documents submitted to the Marketplace",
  dmi_resolved: "DMI resolved",
  portal_link_limit: "3 Portal links sent in 24 hours",
};

/** The handoff card's trigger line, worded as in the Agent view prototype, variant A. */
const TRIGGER_LABEL: Record<EscalationTrigger, string> = {
  income_or_application_change: "Income changed, application update needed",
  citizenship_or_immigration_dmi: "Citizenship or immigration DMI, always handed to the Agent",
  advice_or_low_confidence: "Advice request, or the Assistant wasn't sure",
  insufficient_twice: "Document insufficient twice",
  suspected_fraud: "Suspected fraud or inconsistent documents",
  silence: "No response after initial text and nudge",
};

const TOTAL_LABEL: Record<QueueFilter, string> = {
  escalations: "Escalations open",
  due_soon: "Due soon",
  submitted: "Submitted",
  resolved: "Resolved",
};

const DMI_LABEL: Record<DmiType, string> = {
  income: "Income",
  ssn: "SSN",
  citizenship: "Citizenship",
  immigration: "Immigration",
};

const NOT_SENT_LABEL: Record<string, string> = {
  opted_out: "Not sent: the Client opted out of texts.",
  no_consent: "Not sent: there is no Consent record covering texts.",
  outbound_filter: "Not sent: it has an SSN-like number, an income amount or a link the outbound filter blocks.",
};

function daysLeftLabel(days: number | null): string {
  if (days === null) return "Resolved";
  if (days === 0) return "Due today";
  if (days < 0) return `${-days} ${days === -1 ? "day" : "days"} overdue`;
  return `${days} ${days === 1 ? "day" : "days"}`;
}

/** The deadline's urgency, as the prototype colours it: a week or less, then two weeks or less. */
function daysTone(days: number | null): string {
  if (days === null) return "";
  return days <= 7 ? " crit" : days <= 14 ? " warn" : "";
}

function shortDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function timeLabel(at: string): string {
  return new Date(at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default async function AgentView({ searchParams }: { searchParams: Promise<{ client?: string; portal?: string; phone?: string; notsent?: string; filter?: string; signin?: string }> }) {
  const params = await searchParams;
  if ((await cookies()).get(SESSION_COOKIE)?.value !== SESSION_VALUE) return <SignIn wrong={params.signin === "wrong"} />;
  const store = demoStore();
  const today = toIsoDate(demoClock().now());
  const allRows = rankByDeadline(store.list("clients"), store.list("dmis"), today, store.list("escalations"));
  const filter = parseFilter(params.filter);
  const rows = filterQueue(allRows, filter);
  const totals = queueTotals(allRows);
  const selectedRow = allRows.find((r) => r.clientId === params.client) ?? null;
  /** A link that keeps the selected Client and turns the filter on, or off when it is already on. */
  const totalHref = (f: QueueFilter) => {
    const q = new URLSearchParams();
    if (params.client) q.set("client", params.client);
    if (filter !== f) q.set("filter", f);
    return q.size ? `/?${q}` : "/";
  };
  const clientHref = (id: string) => `/?${new URLSearchParams({ client: id, ...(filter ? { filter } : {}) })}`;
  const selectedId = params.client ?? null;
  const browser = params.portal ? { token: params.portal, state: uploadPageState(store, params.portal, demoClock().now()) } : null;
  const inThread = (id: string) => agentInThread(store, id);
  const showPhone = params.phone !== "off";
  const selected = store.list("clients").find((c) => c.id === selectedId) ?? null;
  const thread = selected ? store.list("messages").filter((m) => m.clientId === selected.id) : [];
  const actionLog = selected ? store.list("actionLog").filter((e) => e.clientId === selected.id) : [];
  const openEscalations = selected ? store.list("escalations").filter((e) => e.clientId === selected.id && e.status === "open") : [];
  const notifications = selected ? store.list("notifications").filter((n) => n.clientId === selected.id) : [];
  const openDmiToText = selected
    ? store.list("dmis").find((d) => d.clientId === selected.id && d.status === "open" && assistantTextsAbout(d.type))
    : undefined;

  return (
    <main className="page">
      <AutoRefresh />
      <header className="topbar">
        <div>
          <h1>Your Enrollment Follow-ups</h1>
          <p className="muted">Synthetic data only. Escalations first, then Clients ranked by DMI deadline.</p>
        </div>
        <div className="controls">
          <form action={fastForwardDemo} className="fast-forward">
            <label>
              Fast-forward{" "}
              <select name="days" defaultValue="1">
                <option value="1">1 day</option>
                <option value="3">3 days</option>
                <option value="7">7 days</option>
              </select>
            </label>{" "}
            <button type="submit" className="primary">Go</button>
          </form>
          <form action={resetDemo}>
            <button type="submit">Reset demo</button>
          </form>
          <form action={signOut}>
            <button type="submit">Sign out</button>
          </form>
        </div>
      </header>

      <nav className="totals" aria-label="Totals">
        {QUEUE_FILTERS.map((f) => (
          <Link key={f} href={totalHref(f)} className={`total${f === "escalations" ? " crit" : ""}`} aria-current={filter === f ? "true" : undefined}>
            <span className="num">{totals[f]}</span>
            <span className="label">{TOTAL_LABEL[f]}</span>
          </Link>
        ))}
      </nav>

      <div className={showPhone ? "layout" : "layout no-phone"}>
        <section className="queue" aria-label="Clients by deadline">
          <div className="row head" role="row">
            <span className="label">Client</span>
            <span className="label">DMI</span>
            <span className="label">Days left</span>
          </div>
          {rows.length === 0 && <p className="muted empty">No Clients match this total.</p>}
          {rows.map((row) => (
            <div className={row.clientId === selectedId ? "row sel" : "row"} role="row" key={row.clientId}>
              <Link className="name" href={clientHref(row.clientId)} aria-current={row.clientId === selectedId ? "true" : undefined}>
                {row.name}
              </Link>
              <span className="dmi">
                {DMI_LABEL[row.dmiType]}
                {row.dmiStatus === "documents_submitted" && <span className="chip info"> Submitted</span>}
                {row.escalated && <span className="chip crit"> Escalation</span>}
                {atRisk(row) && <span className="chip warn"> At risk</span>}
                {inThread(row.clientId) && <span className="chip info"> You&rsquo;re in the Thread</span>}
              </span>
              <span className={`days${daysTone(row.daysLeft)}`}>
                {daysLeftLabel(row.daysLeft)}
                {row.daysLeft !== null && <span className="date"> · {shortDate(row.deadline)}</span>}
              </span>
            </div>
          ))}
        </section>

        {selected && (
          <section className="detail" aria-label={`${selected.firstName} ${selected.lastName}`}>
            <header className="detail-head">
              <h2>
                {selected.firstName} {selected.lastName}
              </h2>
              <a className="button crm" href="#crm" title="Opens the Client's record in the CRM. Not built in the POC.">
                View CRM record ↗
              </a>
              {openDmiToText && thread.length === 0 && (
                <form action={openDmi}>
                  <input type="hidden" name="clientId" value={selected.id} />
                  <input type="hidden" name="dmiId" value={openDmiToText.id} />
                  <button type="submit">Open DMI (demo)</button>
                </form>
              )}
            </header>

            {selectedRow && (
              <div className="window">
                <div
                  className="meter"
                  role="meter"
                  aria-label="Share of the window used"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={windowUsedPercent(selectedRow.noticeDate, selectedRow.deadline, today)}
                >
                  <span className={`fill${daysTone(selectedRow.daysLeft)}`} style={{ width: `${windowUsedPercent(selectedRow.noticeDate, selectedRow.deadline, today)}%` }} />
                </div>
                <span className="data muted">
                  {daysBetween(selectedRow.noticeDate, selectedRow.deadline)}-day window · notice {shortDate(selectedRow.noticeDate)}, deadline {shortDate(selectedRow.deadline)}
                </span>
              </div>
            )}

            {openEscalations.map((e) => (
              <div className="handoff" key={e.id} aria-label="Handoff">
                <span className="label">Needs you</span>
                <b>{TRIGGER_LABEL[e.trigger]}</b>
                <p>{e.summary}</p>
                {e.clientWords && <blockquote className="quote">&ldquo;{e.clientWords}&rdquo;</blockquote>}
                {e.suggestedNextStep && (
                  <p>
                    <b>Suggested next step:</b> {e.suggestedNextStep}
                  </p>
                )}
                <form action={markHandled}>
                  <input type="hidden" name="escalationId" value={e.id} />
                  <button type="submit" className="primary">Mark handled</button>
                  {selected.optedOutAt === null && <a className="button" href="#message-box">Reply in Thread</a>}
                </form>
              </div>
            ))}

            {inThread(selected.id) && (
              <div className="banner" aria-label="You're in the Thread">
                <span>
                  <b>You&rsquo;re in the Thread.</b> The Assistant is holding its replies and nudges for this Client.
                  {openEscalations.length > 0 && " An Escalation is still open, so it stays paused until you mark it handled."}
                </span>
                <form action={handBack}>
                  <input type="hidden" name="clientId" value={selected.id} />
                  <button type="submit">Hand back to the Assistant</button>
                </form>
              </div>
            )}

            <h3>Thread</h3>
            {thread.length === 0 ? (
              <p className="muted">No messages yet.</p>
            ) : (
              <ol className="thread">
                {thread.map((m) => (
                  <li key={m.id} className={`msg ${m.sender}`}>
                    <span className="who">
                      {m.sender === "assistant" ? "Assistant" : m.sender === "agent" ? "You" : selected.firstName} · {timeLabel(m.sentAt)}
                    </span>
                    <p>{m.text}</p>
                  </li>
                ))}
              </ol>
            )}

            {selected.optedOutAt === null ? (
              <form action={sendAgentTextAction} className="message-box" id="message-box">
                <input type="hidden" name="clientId" value={selected.id} />
                <label>
                  <span className="label">Text {selected.firstName} as {store.agent()?.firstName}</span>
                  <textarea name="text" rows={2} required placeholder={`Sends from the same number, starting "${store.agent()?.firstName} here:"`} />
                </label>
                {params.notsent && NOT_SENT_LABEL[params.notsent] && <p className="muted" role="alert">{NOT_SENT_LABEL[params.notsent]}</p>}
                <button type="submit" className="primary">Send text</button>
              </form>
            ) : (
              <p className="muted">
                {selected.firstName} opted out of texts. Call {selected.phone} instead.
              </p>
            )}

            <h3>Notifications</h3>
            {notifications.length === 0 ? (
              <p className="muted">No notifications.</p>
            ) : (
              <ul className="notes">
                {notifications.map((n) => (
                  <li key={n.id}>
                    {NOTIFICATION_LABEL[n.event]} <span className="when">· {timeLabel(n.at)}</span>
                  </li>
                ))}
              </ul>
            )}

            <h3>Action log</h3>
            {actionLog.length === 0 ? (
              <p className="muted">No actions yet.</p>
            ) : (
              <table className="log">
                <thead>
                  <tr>
                    <th>Tool</th>
                    <th>Consent record</th>
                    <th>Result</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {actionLog.map((e) => (
                    <tr key={e.id}>
                      <td className="tool">{e.tool}</td>
                      <td>{e.consentRecordId ?? "None"}</td>
                      <td>{e.result}</td>
                      <td>{timeLabel(e.at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}

        {showPhone && <PhoneSimulator clientId={selected?.id ?? null} messages={thread} browser={selected ? browser : null} />}
      </div>
    </main>
  );
}
