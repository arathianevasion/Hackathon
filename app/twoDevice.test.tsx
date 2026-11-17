import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { openStore, type Store } from "../src/store/store";
import AgentView from "./page";
import PhonePage from "./phone/page";
import UploadRoute from "./r/[token]/page";
import { issuePortalLink, PORTAL_LINK_BASE } from "../src/portal/portalLink";

const NOW = new Date();
let store: Store;
vi.mock("../src/store/demo", () => ({ demoStore: () => store }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({ redirect: () => {}, useRouter: () => ({ refresh: () => {} }) }));

const ROSA = "client-01";
const render = async (el: Promise<React.ReactNode> | React.ReactNode) => renderToStaticMarkup(await el);

beforeEach(() => {
  store = openStore(":memory:");
  store.reset(NOW);
});

function textRosa(text: string) {
  store.add("messages", { id: "m-test", clientId: ROSA, sender: "assistant", text, sentAt: NOW.toISOString() } as never);
}

describe("/phone", () => {
  it("renders the Client's Messages view and reply box, without the Agent view", async () => {
    textRosa("Hi Rosa, please send a pay stub.");
    const html = await render(PhonePage({ searchParams: Promise.resolve({ client: ROSA }) }));
    expect(html).toContain("Hi Rosa, please send a pay stub.");
    expect(html).toContain('placeholder="Text message"');
    expect(html).not.toContain("Your Enrollment Follow-ups");
    expect(html).not.toContain("Action log");
  });

  it("points a Portal link at the real upload-page URL on this server", async () => {
    const link = issuePortalLink(store, ROSA, "dmi-01", NOW);
    textRosa(`Upload here: ${link.url}`);
    const html = await render(PhonePage({ searchParams: Promise.resolve({ client: ROSA }) }));
    expect(html).toContain(`href="/r/${link.url.slice(PORTAL_LINK_BASE.length)}?client=${ROSA}"`);
  });
});

describe("/r/[token]", () => {
  it("renders the upload page states for the token, and Done returns to /phone", async () => {
    const link = issuePortalLink(store, ROSA, "dmi-01", NOW);
    const token = link.url.slice(PORTAL_LINK_BASE.length);
    const open = await render(UploadRoute({ params: Promise.resolve({ token }), searchParams: Promise.resolve({ client: ROSA }) }));
    expect(open).toContain("Upload proof of income");
    expect(open).toContain(`href="/phone?client=${ROSA}"`);
    const gone = await render(UploadRoute({ params: Promise.resolve({ token: "NOSUCHTOKEN" }), searchParams: Promise.resolve({ client: ROSA }) }));
    expect(gone).toContain("This link has expired.");
  });
});

describe("Agent view phone parameter", () => {
  it("hides the phone simulator with phone=off and shows it otherwise", async () => {
    const on = await render(AgentView({ searchParams: Promise.resolve({ client: ROSA }) }));
    const off = await render(AgentView({ searchParams: Promise.resolve({ client: ROSA, phone: "off" }) }));
    expect(on).toContain("Client phone simulator");
    expect(off).not.toContain("Client phone simulator");
    expect(off).toContain("Action log");
  });
});
