import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { openStore, type Store } from "../src/store/store";
import { issuePortalLink, PORTAL_LINK_BASE } from "../src/portal/portalLink";
import { uploadPageCopy, type UploadPageState } from "../src/portal/uploadPage";
import { nestingErrors } from "./htmlNesting";
import AgentView from "./page";
import PhonePage from "./phone/page";
import { PhoneSimulator } from "./PhoneSimulator";
import UploadRoute from "./r/[token]/page";
import { UploadPage } from "./UploadPage";

const NOW = new Date();
let store: Store;
vi.mock("../src/store/demo", () => ({ demoStore: () => store }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({ redirect: () => {}, useRouter: () => ({ refresh: () => {} }) }));

const ROSA = "client-01";
let consoleError: MockInstance;

beforeEach(() => {
  store = openStore(":memory:");
  store.reset(NOW);
  consoleError = vi.spyOn(console, "error");
});

afterEach(() => {
  // React reports invalid nesting and other render problems on console.error.
  expect(consoleError).not.toHaveBeenCalled();
  consoleError.mockRestore();
});

/** Rosa's Thread with a Portal link in it, so the phone has a tappable link. */
function textRosaALink(): string {
  const link = issuePortalLink(store, ROSA, "dmi-01", NOW);
  store.add("messages", { id: "m-link", clientId: ROSA, sender: "assistant", text: `Everything you need is here: ${link.url}`, sentAt: NOW.toISOString() } as never);
  store.add("messages", { id: "m-reply", clientId: ROSA, sender: "client", text: "ok", sentAt: NOW.toISOString() } as never);
  return link.url.slice(PORTAL_LINK_BASE.length);
}

const income = { firstName: "Rosa", dmiType: "income" as const, due: "Dec 2", copy: uploadPageCopy("income"), attempt: 0 };
const fixes = { title: "2 things to fix", fixes: ["Your name: the top of the stub is cut off"], closing: "Retake the photo." };
const STATES: Record<string, UploadPageState> = {
  open: { kind: "open", ...income, fixes: null },
  insufficient: { kind: "open", ...income, fixes, attempt: 1 },
  later: { kind: "later", ...income, fixes: null },
  submitted: { kind: "submitted", ...income, fixes: null },
  expired: { kind: "expired" },
  paused: { kind: "paused", agentFirstName: "Andrew" },
  ssn: { kind: "open", ...income, dmiType: "ssn", copy: uploadPageCopy("ssn"), fixes: null },
};

describe("every screen renders markup the browser keeps as it is", () => {
  it("the Agent view, with a Client selected and with the phone off", async () => {
    textRosaALink();
    for (const searchParams of [{}, { client: ROSA }, { client: ROSA, phone: "off" }]) {
      const html = renderToStaticMarkup(await AgentView({ searchParams: Promise.resolve(searchParams) }));
      expect(nestingErrors(html)).toEqual([]);
    }
  });

  it("the Agent view's in-phone browser on a Portal link", async () => {
    const token = textRosaALink();
    const html = renderToStaticMarkup(await AgentView({ searchParams: Promise.resolve({ client: ROSA, portal: token }) }));
    expect(html).toContain("portal.example/r/");
    expect(nestingErrors(html)).toEqual([]);
  });

  it.each(Object.keys(STATES))("the in-phone browser on the %s upload page", (state) => {
    const html = renderToStaticMarkup(<PhoneSimulator clientId={ROSA as never} messages={[]} browser={{ token: "7Q2K", state: STATES[state] }} />);
    expect(nestingErrors(html)).toEqual([]);
  });

  it.each(Object.keys(STATES))("the %s upload page on its own", (state) => {
    expect(nestingErrors(renderToStaticMarkup(<UploadPage token="7Q2K" state={STATES[state]} />))).toEqual([]);
  });

  it("/phone, with and without a Client", async () => {
    textRosaALink();
    for (const searchParams of [{}, { client: ROSA }]) {
      const html = renderToStaticMarkup(await PhonePage({ searchParams: Promise.resolve(searchParams) }));
      expect(nestingErrors(html)).toEqual([]);
    }
  });

  it("/r/[token], open and expired", async () => {
    const token = textRosaALink();
    for (const t of [token, "NOSUCHTOKEN"]) {
      const html = renderToStaticMarkup(await UploadRoute({ params: Promise.resolve({ token: t }), searchParams: Promise.resolve({ client: ROSA }) }));
      expect(nestingErrors(html)).toEqual([]);
    }
  });
});
