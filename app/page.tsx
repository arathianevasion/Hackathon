import type { DmiType, EscalationTrigger, NotificationEvent } from "../src/contract";
import { daysBetween, toIsoDate } from "../src/dates";
import { rankByDeadline } from "../src/queue/rank";
import { demoStore } from "../src/store/demo";
import { cookies } from "next/headers";
import Link from "next/link";
import { SESSION_COOKIE, SESSION_VALUE } from "../src/agentSession";
import { atRisk, filterQueue, parseFilter, QUEUE_FILTERS, queueTotals, windowBar, windowUsedPercent, type QueueFilter } from "../src/queue/totals";
import type { QueueRow } from "../src/queue/rank";
import { PHONE_COOKIE, phoneShown } from "../src/phoneSwitch";
import { assistantTextsAbout } from "../src/assistant/firstText";
import { uploadPageState } from "../src/portal/uploadPage";
import { demoClock } from "../src/cadence/demo";
import { agentInThread, pausingEscalationOpen } from "../src/assistant/escalations";
import { fastForwardDemo, handBack, markHandled, openDmi, resetDemo, sendAgentTextAction, signOut } from "./actions";
import { AutoRefresh } from "./AutoRefresh";
import { PhoneSimulator } from "./PhoneSimulator";
import { Desk, PhoneSwitch, PhoneSwitchProvider } from "./PhoneSwitch";
import { SignIn } from "./SignIn";

export const dynamic = "force-dynamic";

const NOTIFICATION_LABEL: Record<NotificationEvent, string> = {
  opted_out: "Opted out",
  consent_rescinded: "Consent rescinded",
  documents_submitted: "Documents submitted to the Marketplace",
  dmi_resolved: "DMI resolved",
  portal_link_limit: "3 Portal links sent in 24 hours",
  client_came_back_by_text: "Client texted back after a silence Escalation. The Escalation is closed",
  client_came_back_by_upload: "Client uploaded a document after a silence Escalation. The Escalation is closed",
};

/** The handoff card's trigger line, worded as in the Agent view prototype, variant A. */
const TRIGGER_LABEL: Record<EscalationTrigger, string> = {
  income_or_application_change: "Income changed, application update needed",
  citizenship_or_immigration_dmi: "Citizenship or immigration DMI, always handed to the Agent",
  advice_or_low_confidence: "Advice request, or the AI Client Advocate wasn't sure",
  insufficient_twice: "Document insufficient twice",
  name_or_ssn_mismatch: "Name or SSN doesn't match the application",
  suspected_fraud: "Suspected fraud or inconsistent documents",
  silence: "No response after initial text and nudge",
  client_asked_for_agent: "Client asked you to contact them about something other than the DMI",
};

const TOTAL_LABEL: Record<QueueFilter, string> = {
  escalations: "Needs you",
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

/** Days left turn red at two weeks or less, as in the v2 prototype. */
function daysSoon(days: number | null): boolean {
  return days !== null && days <= 14;
}

/** A queue row's one tag: the Agent's work first, then where the DMI stands. */
function rowTag(row: QueueRow): { label: string; tone: string } | null {
  if (row.escalated) return { label: "Needs you", tone: "esc" };
  if (row.dmiStatus === "documents_submitted") return { label: "Submitted", tone: "sub" };
  if (row.dmiStatus === "resolved") return { label: "Cleared", tone: "ok" };
  if (atRisk(row)) return { label: "At risk", tone: "risk" };
  return null;
}

/** The demo clock in the header, e.g. "Tue Nov 17". */
function clockLabel(now: Date): string {
  return now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }).replace(",", "");
}

/** The Shield mark beside the product name. */
function ShieldMark() {
  return (
    <span className="mark" aria-hidden="true">
      <svg viewBox="0 0 18 18" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 2.5 3.5 5v4c0 3.4 2.4 5.8 5.5 6.5 3.1-.7 5.5-3.1 5.5-6.5V5L9 2.5Z" />
        <path d="m6.5 9 1.8 1.8L11.8 7.3" />
      </svg>
    </span>
  );
}

function shortDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function timeLabel(at: string): string {
  return new Date(at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default async function AgentView({ searchParams }: { searchParams: Promise<{ client?: string; portal?: string; phone?: string; notsent?: string; filter?: string; signin?: string }> }) {
  const params = await searchParams;
  const jar = await cookies();
  if (jar.get(SESSION_COOKIE)?.value !== SESSION_VALUE) return <SignIn wrong={params.signin === "wrong"} />;
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
  const phoneForcedOff = params.phone === "off";
  const phoneOn = phoneShown(params.phone, jar.get(PHONE_COOKIE)?.value);
  const agent = store.agent();
  const openRows = rows.filter((r) => r.dmiStatus !== "resolved");
  const resolvedRows = rows.filter((r) => r.dmiStatus === "resolved");
  const selected = store.list("clients").find((c) => c.id === selectedId) ?? null;
  const thread = selected ? store.list("messages").filter((m) => m.clientId === selected.id) : [];
  const actionLog = selected ? store.list("actionLog").filter((e) => e.clientId === selected.id) : [];
  const openEscalations = selected ? store.list("escalations").filter((e) => e.clientId === selected.id && e.status === "open") : [];
  const notifications = selected ? store.list("notifications").filter((n) => n.clientId === selected.id) : [];
  const selectedDmi = selected ? store.list("dmis").find((d) => d.clientId === selected.id) : undefined;
  const plan = selectedDmi ? store.list("enrollments").find((e) => e.id === selectedDmi.enrollmentId)?.planName : undefined;
  const consent = selected ? store.list("consentRecords").find((c) => c.clientId === selected.id && c.rescindedAt === null) : undefined;
  const openDmiToText = selected
    ? store.list("dmis").find((d) => d.clientId === selected.id && d.status === "open" && assistantTextsAbout(d.type))
    : undefined;

  const queueRow = (row: QueueRow) => {
    const tag = rowTag(row);
    const bar = windowBar(row, today);
    return (
      <li key={row.clientId}>
        <Link className="row" href={clientHref(row.clientId)} aria-current={row.clientId === selectedId ? "true" : undefined}>
          <span className="name">{row.name}</span>
          <span className={daysSoon(row.daysLeft) ? "left soon" : "left"}>
            <b className="fig">{daysLeftLabel(row.daysLeft)}</b>
          </span>
          <span className="meta">
            {DMI_LABEL[row.dmiType]}
            {tag && <span className={`tag ${tag.tone}`}>{tag.label}</span>}
            {inThread(row.clientId) && <span className="tag sub">You&rsquo;re in the Thread</span>}
          </span>
          <span className="left fig">{shortDate(row.deadline)}</span>
          <span className={`win ${bar.tone}`}>
            <i style={{ width: `${bar.usedPercent}%` }} />
          </span>
        </Link>
      </li>
    );
  };

  return (
    <PhoneSwitchProvider initialOn={phoneOn} forcedOff={phoneForcedOff}>
      <AutoRefresh />
      <header className="mast">
        <div className="mast-brand">
          <ShieldMark />
          <h1>Integrity Client Advocate</h1>
          {agent && (
            <span className="who">
              {agent.firstName} {agent.lastName}
            </span>
          )}
        </div>
        <div className="spacer" />
        <div className="demo" role="group" aria-label="Demo controls">
          <span>
            Demo clock <span className="clock fig">{clockLabel(demoClock().now())}</span>
          </span>
          <form action={fastForwardDemo}>
            <select name="days" defaultValue="1" aria-label="Fast-forward by">
              <option value="1">+1 day</option>
              <option value="3">+3 days</option>
              <option value="7">+7 days</option>
            </select>
            <button type="submit" className="ghost">Fast-forward</button>
          </form>
          <form action={resetDemo}>
            <button type="submit" className="ghost">Reset demo</button>
          </form>
          <form action={signOut}>
            <button type="submit" className="ghost">Sign out</button>
          </form>
        </div>
        <PhoneSwitch />
      </header>

      <Desk>
        <nav className="queue" aria-label="Clients by deadline">
          <div className="qhead">
            <h2>Enrollment follow-ups</h2>
            <div className="filters" role="group" aria-label="Show">
              {QUEUE_FILTERS.map((f) => (
                <Link key={f} className={f === "escalations" ? "filter crit" : "filter"} href={totalHref(f)} aria-current={filter === f ? "true" : undefined}>
                  {TOTAL_LABEL[f]} <b>{totals[f]}</b>
                </Link>
              ))}
            </div>
          </div>
          <div className="queue-list">
            {rows.length === 0 && <p className="muted empty">No Clients match this filter.</p>}
            {openRows.length > 0 && <ul>{openRows.map(queueRow)}</ul>}
            {resolvedRows.length > 0 && (
              <>
                <h3 className="group">Resolved</h3>
                <ul>{resolvedRows.map(queueRow)}</ul>
              </>
            )}
          </div>
        </nav>

        <div className="case">
          {selected ? (
            <section className="case-inner" aria-label={`${selected.firstName} ${selected.lastName}`}>
              <header className="case-head">
                <h2>
                  {selected.firstName} {selected.lastName}
                </h2>
                <div className="actions">
                  <a className="button" href="#crm" title="Opens the Client's record in the CRM. Not built in the POC.">
                    View CRM record
                  </a>
                  {openDmiToText && thread.length === 0 && (
                    <form action={openDmi}>
                      <input type="hidden" name="clientId" value={selected.id} />
                      <input type="hidden" name="dmiId" value={openDmiToText.id} />
                      <button type="submit">Open DMI (demo)</button>
                    </form>
                  )}
                </div>
                <p className="sub">
                  {[selectedDmi && `${DMI_LABEL[selectedDmi.type]} DMI`, plan, consent ? `Consent ${consent.id}` : "No consent record"].filter(Boolean).join(" · ")}
                </p>
              </header>

              {selectedRow && (
                <div className="window">
                  <div className="clockline">
                    <span>{daysBetween(selectedRow.noticeDate, selectedRow.deadline)}-day window from the Marketplace notice</span>
                    {selectedRow.daysLeft === null ? (
                      <span className="big">Resolved</span>
                    ) : (
                      <span>
                        <span className={selectedRow.daysLeft <= 7 ? "big soon" : "big"}>{daysLeftLabel(selectedRow.daysLeft)}</span>
                        {selectedRow.daysLeft > 0 && " left"}
                      </span>
                    )}
                  </div>
                  <div
                    className={`bigwin ${windowBar(selectedRow, today).tone}`}
                    role="meter"
                    aria-label="Share of the window used"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={windowUsedPercent(selectedRow.noticeDate, selectedRow.deadline, today)}
                  >
                    <i style={{ width: `${windowBar(selectedRow, today).usedPercent}%` }} />
                  </div>
                  <div className="bigwin-ends fig">
                    <span>Notice {shortDate(selectedRow.noticeDate)}</span>
                    <span>Deadline {shortDate(selectedRow.deadline)}</span>
                  </div>
                </div>
              )}

              {openEscalations.map((e) => (
                <article className="handoff" key={e.id} aria-label="Needs you">
                  <div className="why">
                    <h3>{TRIGGER_LABEL[e.trigger]}</h3>
                    <span className="when fig">{timeLabel(e.raisedAt)}</span>
                  </div>
                  <p>{e.summary}</p>
                  {e.clientWords && <blockquote className="quote">{e.clientWords}</blockquote>}
                  {e.suggestedNextStep && (
                    <p className="next">
                      <span className="lbl">Next step</span>
                      <span>{e.suggestedNextStep}</span>
                    </p>
                  )}
                  <form action={markHandled} className="btns">
                    <input type="hidden" name="escalationId" value={e.id} />
                    <button type="submit" className="primary">Mark handled</button>
                    {selected.optedOutAt === null && (
                      <a className="button" href="#message-box">
                        Text {selected.firstName}
                      </a>
                    )}
                  </form>
                </article>
              ))}

              {inThread(selected.id) && (
                <div className="banner" aria-label="You're in the Thread">
                  <span>
                    <b>You&rsquo;re in the Thread.</b> The AI Client Advocate is holding its replies and nudges for this Client.
                    {pausingEscalationOpen(store, selected.id) && " An Escalation is still open, so it stays paused until you mark it handled."}
                  </span>
                  <form action={handBack}>
                    <input type="hidden" name="clientId" value={selected.id} />
                    <button type="submit">Hand back to the AI Client Advocate</button>
                  </form>
                </div>
              )}

              <section className="section" aria-label="Thread">
                <h3>
                  Thread <span>Texts from the Client Advocate number</span>
                </h3>
                {thread.length === 0 ? (
                  <p className="muted">No messages yet.</p>
                ) : (
                  <ol className="thread">
                    {thread.map((m) => (
                      <li key={m.id} className={`msg ${m.sender}`}>
                        {m.sender !== "client" && <span className="who">{m.sender === "assistant" ? "AI Client Advocate" : "You"}</span>}
                        <p className="b">{m.text}</p>
                        <span className="t fig">
                          {m.sender === "client" && `${selected.firstName} · `}
                          {timeLabel(m.sentAt)}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}

                {selected.optedOutAt === null ? (
                  <form action={sendAgentTextAction} className="compose" id="message-box">
                    <input type="hidden" name="clientId" value={selected.id} />
                    <textarea
                      name="text"
                      rows={2}
                      required
                      aria-label={`Text ${selected.firstName} as ${agent?.firstName}`}
                      placeholder={`Text ${selected.firstName} as ${agent?.firstName}`}
                    />
                    <button type="submit" className="primary">Send text</button>
                    {params.notsent && NOT_SENT_LABEL[params.notsent] && (
                      <p className="hint alert" role="alert">
                        {NOT_SENT_LABEL[params.notsent]}
                      </p>
                    )}
                    <p className="hint">
                      Sends from the same number, starting &ldquo;{agent?.firstName} here:&rdquo;. The AI Client Advocate holds until you hand back.
                    </p>
                  </form>
                ) : (
                  <p className="muted">
                    {selected.firstName} opted out of texts. Call {selected.phone} instead.
                  </p>
                )}
              </section>

              <section className="section" aria-label="Notifications">
                <h3>Notifications</h3>
                {notifications.length === 0 ? (
                  <p className="muted">No notifications.</p>
                ) : (
                  <ul className="notes">
                    {notifications.map((n) => (
                      <li key={n.id}>
                        <span className="dot" aria-hidden="true" />
                        <span>
                          {NOTIFICATION_LABEL[n.event]} <span className="when fig">· {timeLabel(n.at)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="section" aria-label="Action log">
                <h3>
                  Action log <span>Every tool call, with the consent it used</span>
                </h3>
                {actionLog.length === 0 ? (
                  <p className="muted">No actions yet.</p>
                ) : (
                  <ul className="log">
                    {actionLog.map((e) => (
                      <li key={e.id}>
                        <span className="tool">{e.tool}</span>
                        <span>
                          {e.result}{" "}
                          <span className="when fig">
                            · {e.consentRecordId ?? "No consent record"} · {timeLabel(e.at)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </section>
          ) : (
            <p className="case-empty muted">Pick a Client from the queue to see their case file.</p>
          )}
        </div>

        <div className="phone-col">
          {!phoneForcedOff && <PhoneSimulator clientId={selected?.id ?? null} messages={thread} browser={selected ? browser : null} />}
        </div>
      </Desk>
    </PhoneSwitchProvider>
  );
}
