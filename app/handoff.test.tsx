import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTools } from "../src/assistant/tools";
import { openStore, type Store } from "../src/store/store";
import { markHandled } from "./actions";
import AgentView from "./page";
import { UploadPage } from "./UploadPage";

let store: Store;
vi.mock("../src/store/demo", () => ({ demoStore: () => store }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({ redirect: () => {}, useRouter: () => ({ refresh: () => {} }) }));

const MARCUS = "client-02";
const JOB_CHANGE = "I switched jobs last month, so my pay is lower now. Does that matter?";

beforeEach(() => {
  store = openStore(":memory:");
  store.reset(new Date());
});
afterEach(() => store.close());

async function escalateMarcus(): Promise<string> {
  const tools = createTools({ store, now: () => new Date(), extract: () => Promise.reject(new Error("none")) });
  const { escalationId } = await tools.escalate_to_agent({
    clientId: MARCUS,
    trigger: "income_or_application_change",
    summary: "Says he changed jobs last month and earns less.",
    clientWords: JOB_CHANGE,
    suggestedNextStep: "Call Marcus to review the change and update the projected income on the application together.",
  });
  return escalationId;
}

const view = async (client?: string) =>
  renderToStaticMarkup(await AgentView({ searchParams: Promise.resolve(client ? { client, phone: "off" } : { phone: "off" }) }));

describe("the handoff card", () => {
  it("shows the trigger, the summary, the Client's own words and the suggested next step, with Mark handled", async () => {
    const escalationId = await escalateMarcus();
    const html = await view(MARCUS);
    expect(html).toContain("Income changed, application update needed");
    expect(html).toContain("Says he changed jobs last month and earns less.");
    expect(html).toContain("I switched jobs last month, so my pay is lower now. Does that matter?");
    expect(html).toContain("Call Marcus to review the change and update the projected income on the application together.");
    expect(html).toMatch(new RegExp(`name="escalationId" value="${escalationId}"`));
    expect(html).toContain("Mark handled");
  });

  it("Mark handled closes the Escalation, and the card goes", async () => {
    const escalationId = await escalateMarcus();
    const form = new FormData();
    form.set("escalationId", escalationId);
    await markHandled(form);
    expect(store.list("escalations").find((e) => e.id === escalationId)!.status).toBe("handled");
    expect(await view(MARCUS)).not.toContain("Mark handled");
  });
});

describe("the queue", () => {
  it("ranks the escalated Client first and badges them", async () => {
    // Clear the seeded Escalations so Marcus's is the only one open.
    for (const e of store.list("escalations")) store.update("escalations", { ...e, status: "handled", handledAt: e.raisedAt });
    await escalateMarcus();
    const html = await view();
    const firstRow = html.split('role="row"')[2];
    expect(firstRow).toContain("Marcus Whitlow");
    expect(firstRow).toContain("Escalation");
  });
});

describe("the paused upload page", () => {
  it("says the agent will contact the Client and offers no upload", () => {
    const html = renderToStaticMarkup(<UploadPage token="7Q2K" state={{ kind: "paused", agentFirstName: "Andrew" }} />);
    expect(html).toContain("Your agent will contact you");
    expect(html).toContain("Andrew needs to talk with you first. Please don&#x27;t upload anything yet.");
    expect(html).not.toContain('type="file"');
    expect(html).not.toContain("come back later");
  });
});
