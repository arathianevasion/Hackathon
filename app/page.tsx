import type { DmiType } from "../src/contract";
import { toIsoDate } from "../src/dates";
import { rankByDeadline } from "../src/queue/rank";
import { demoStore } from "../src/store/demo";
import { resetDemo } from "./actions";
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

export default function AgentView() {
  const store = demoStore();
  const rows = rankByDeadline(store.list("clients"), store.list("dmis"), toIsoDate(new Date()));

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
              <span className="name">{row.name}</span>
              <span>{DMI_LABEL[row.dmiType]}</span>
              <span className="days">
                {daysLeftLabel(row.daysLeft)}
                {row.daysLeft !== null && <span className="muted"> · {shortDate(row.deadline)}</span>}
              </span>
            </div>
          ))}
        </section>

        <PhoneSimulator />
      </div>
    </main>
  );
}
