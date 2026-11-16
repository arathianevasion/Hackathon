import type { ClientId, Dmi, Document } from "../contract";
import type { Store } from "../store/store";

/**
 * The mocked Marketplace. It holds what each Client attested on their
 * application, which the document checks compare against, and takes
 * submitted Documents. No real Marketplace is ever called.
 */
export interface MarketplaceApplication {
  applicationId: string;
  /** Yearly household income the Client attested. */
  attestedAnnualIncome: number;
  /** Synthetic (900-series) SSN on the application; only the checks read it. */
  ssn: string;
}

/** Attested incomes that a scenario depends on; Rosa's matches her SPECIMEN pay stub ($1,560 biweekly). */
const ATTESTED_INCOME: Record<ClientId, number> = { "client-01": 40_000 };

/** The application on file for a Client, derived from the seed so it never drifts from it. */
export function applicationOf(store: Store, clientId: ClientId): MarketplaceApplication {
  const client = store.list("clients").find((c) => c.id === clientId);
  const household = store.list("households").find((h) => h.id === client?.householdId);
  if (!client || !household) throw new Error(`No application for Client ${clientId}`);
  const n = Number(clientId.replace(/\D/g, "")) || 0;
  return {
    applicationId: household.applicationId,
    attestedAnnualIncome: ATTESTED_INCOME[clientId] ?? 30_000 + n * 1_500,
    ssn: `900-${String(n % 100).padStart(2, "0")}-${String(4400 + n).padStart(4, "0")}`,
  };
}

/** Takes Documents for a DMI: each is marked submitted and the DMI waits on the Marketplace's review. */
export function submitToMarketplace(store: Store, dmi: Dmi, documents: Document[]): Dmi {
  for (const doc of documents) store.update("documents", { ...doc, submission: "submitted" });
  const waiting: Dmi = { ...dmi, status: "documents_submitted" };
  store.update("dmis", waiting);
  return waiting;
}
