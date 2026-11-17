import type { DmiType, EscalationTrigger, NotificationEvent } from "../src/contract";
import { toIsoDate } from "../src/dates";
import { rankByDeadline } from "../src/queue/rank";
import { demoStore } from "../src/store/demo";
import Link from "next/link";
import { assistantTextsAbout } from "../src/assistant/firstText";
import { uploadPageState } from "../src/portal/uploadPage";
import { demoClock } from "../src/cadence/demo";
import { fastForwardDemo, markHandled, openDmi, resetDemo } from "./actions";
import { AutoRefresh } from "./AutoRefresh";
import { PhoneSimulator } from "./PhoneSimulator";

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

const DMI_LABEL: Record<DmiType, string> = {
  income: "Income",
  ssn: "SSN",
  citizenship: "Citizenship",
  immigration: "Immigration",
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

export default async function AgentView({ searchParams }: { searchParams: Promise<{ client?: string; portal?: string; phone?: string }> }) {
  const store = demoStore();
  const rows = rankByDeadline(store.list("clients"), store.list("dmis"), toIsoDate(demoClock().now()), store.list("escalations"));
  const params = await searchParams;
  const selectedId = params.client ?? null;
  const browser = params.portal ? { token: params.portal, state: uploadPageState(store, params.portal, demoClock().now()) } : null;
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
        </div>
      </header>

      <div className={showPhone ? "layout" : "layout no-phone"}>
        <section className="queue" aria-label="Clients by deadline">
          <div className="row head" role="row">
            <span className="label">Client</span>
            <span className="label">DMI</span>
            <span className="label">Days left</span>
          </div>
          {rows.map((row) => (
            <div className={row.clientId === selectedId ? "row sel" : "row"} role="row" key={row.clientId}>
              <Link className="name" href={`/?client=${row.clientId}`} aria-current={row.clientId === selectedId ? "true" : undefined}>
                {row.name}
              </Link>
              <span className="dmi">
                {DMI_LABEL[row.dmiType]}
                {row.dmiStatus === "documents_submitted" && <span className="chip info"> Submitted</span>}
                {row.escalated && <span className="chip crit"> Escalation</span>}
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
              {openDmiToText && thread.length === 0 && (
                <form action={openDmi}>
                  <input type="hidden" name="clientId" value={selected.id} />
                  <input type="hidden" name="dmiId" value={openDmiToText.id} />
                  <button type="submit">Open DMI (demo)</button>
                </form>
              )}
            </header>

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
                </form>
              </div>
            ))}

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
