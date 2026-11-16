import type { DmiType } from "../src/contract";
import { toIsoDate } from "../src/dates";
import { rankByDeadline } from "../src/queue/rank";
import { demoStore } from "../src/store/demo";
import Link from "next/link";
import { assistantTextsAbout } from "../src/assistant/firstText";
import { openDmi, resetDemo } from "./actions";
import { PhoneSimulator } from "./PhoneSimulator";

export const dynamic = "force-dynamic";

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

function shortDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function timeLabel(at: string): string {
  return new Date(at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default async function AgentView({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const store = demoStore();
  const rows = rankByDeadline(store.list("clients"), store.list("dmis"), toIsoDate(new Date()));
  const selectedId = (await searchParams).client ?? null;
  const selected = store.list("clients").find((c) => c.id === selectedId) ?? null;
  const thread = selected ? store.list("messages").filter((m) => m.clientId === selected.id) : [];
  const actionLog = selected ? store.list("actionLog").filter((e) => e.clientId === selected.id) : [];
  const openDmiToText = selected
    ? store.list("dmis").find((d) => d.clientId === selected.id && d.status === "open" && assistantTextsAbout(d.type))
    : undefined;

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <h1>Your Enrollment Follow-ups</h1>
          <p className="muted">Synthetic data only. Clients ranked by DMI deadline.</p>
        </div>
        <form action={resetDemo}>
          <button type="submit">Reset demo</button>
        </form>
      </header>

      <div className="layout">
        <section className="queue" aria-label="Clients by deadline">
          <div className="row head" role="row">
            <span>Client</span>
            <span>DMI</span>
            <span>Days left</span>
          </div>
          {rows.map((row) => (
            <div className="row" role="row" key={row.clientId}>
              <Link className="name" href={`/?client=${row.clientId}`} aria-current={row.clientId === selectedId ? "true" : undefined}>
                {row.name}
              </Link>
              <span>{DMI_LABEL[row.dmiType]}</span>
              <span className="days">
                {daysLeftLabel(row.daysLeft)}
                {row.daysLeft !== null && <span className="muted"> · {shortDate(row.deadline)}</span>}
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

            <h3>Thread</h3>
            {thread.length === 0 ? (
              <p className="muted">No messages yet.</p>
            ) : (
              <ol className="thread">
                {thread.map((m) => (
                  <li key={m.id}>
                    <span className="muted">
                      {m.sender === "assistant" ? "Assistant" : m.sender === "agent" ? "You" : selected.firstName} · {timeLabel(m.sentAt)}
                    </span>
                    <p>{m.text}</p>
                  </li>
                ))}
              </ol>
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
                      <td>{e.tool}</td>
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

        <PhoneSimulator clientId={selected?.id ?? null} messages={thread} />
      </div>
    </main>
  );
}
