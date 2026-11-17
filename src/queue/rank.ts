import type { Client, ClientId, Dmi, DmiStatus, DmiType, Escalation, IsoDate } from "../contract";
import { daysBetween } from "../dates";

/** One row of the Agent view's Client list. */
export interface QueueRow {
  clientId: ClientId;
  name: string;
  dmiType: DmiType;
  dmiStatus: DmiStatus;
  deadline: IsoDate;
  /** Calendar days from today to the deadline; null once the DMI is resolved. */
  daysLeft: number | null;
  /** An Escalation is open for the Client: the Agent must act. */
  escalated: boolean;
}

/**
 * Ranks Clients by urgency, then their DMI deadline, soonest first. Clients with
 * an open Escalation need the Agent, so they come first. Resolved DMIs have no
 * deadline to chase, so they go last, most recently resolved first.
 */
export function rankByDeadline(clients: Client[], dmis: Dmi[], today: IsoDate, escalations: Escalation[]): QueueRow[] {
  const dmiOf = new Map(dmis.map((d) => [d.clientId, d]));
  const escalated = new Set(escalations.filter((e) => e.status === "open").map((e) => e.clientId));
  const rows = clients.flatMap((client) => {
    const dmi = dmiOf.get(client.id);
    if (!dmi) return [];
    const resolved = dmi.status === "resolved";
    return [
      {
        row: {
          clientId: client.id,
          name: `${client.firstName} ${client.lastName}`,
          dmiType: dmi.type,
          dmiStatus: dmi.status,
          deadline: dmi.deadline,
          daysLeft: resolved ? null : daysBetween(today, dmi.deadline),
          escalated: escalated.has(client.id),
        },
        resolvedAt: resolved ? (dmi.resolvedAt ?? "") : null,
      },
    ];
  });

  rows.sort((a, b) => {
    if (a.row.escalated !== b.row.escalated) return a.row.escalated ? -1 : 1;
    if (a.resolvedAt === null && b.resolvedAt === null) {
      return a.row.deadline.localeCompare(b.row.deadline) || a.row.name.localeCompare(b.row.name);
    }
    if (a.resolvedAt === null) return -1;
    if (b.resolvedAt === null) return 1;
    return b.resolvedAt.localeCompare(a.resolvedAt);
  });
  return rows.map((r) => r.row);
}
