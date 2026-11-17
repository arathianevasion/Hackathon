import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_CODE, SESSION_COOKIE, SESSION_VALUE } from "../src/agentSession";
import { openStore, type Store } from "../src/store/store";
import { signIn, signOut } from "./actions";
import AgentView from "./page";

let store: Store;
let jar: Map<string, string>;
vi.mock("../src/store/demo", () => ({ demoStore: () => store }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({
  // The real redirect throws, which ends the action.
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  }, useRouter: () => ({ refresh: () => {} }),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
}));

beforeEach(() => {
  store = openStore(":memory:");
  store.reset(new Date());
  jar = new Map();
});
afterEach(() => store.close());

const view = async (params: Record<string, string> = {}) =>
  renderToStaticMarkup(await AgentView({ searchParams: Promise.resolve({ phone: "off", ...params }) }));
const signedIn = () => jar.set(SESSION_COOKIE, SESSION_VALUE);
const form = (code: string) => {
  const f = new FormData();
  f.set("code", code);
  return f;
};
/** The names in the queue, in order. */
const queueNames = (html: string) => [...html.matchAll(/class="name"[^>]*>([^<]+)</g)].map((m) => m[1]);

describe("sign-in", () => {
  it("gates the view: no Clients, the code form instead", async () => {
    const html = await view();
    expect(html).toContain("one-time code");
    expect(html).not.toContain("Enrollment follow-ups");
    expect(html).not.toContain("Rosa");
  });

  it("the right code signs in; a wrong one does not", async () => {
    await expect(signIn(form("000000"))).rejects.toThrow("redirect:/?signin=wrong");
    expect(jar.has(SESSION_COOKIE)).toBe(false);
    await expect(signIn(form(DEMO_CODE))).rejects.toThrow("redirect:/");
    expect(jar.get(SESSION_COOKIE)).toBe(SESSION_VALUE);
    expect(await view()).toContain("Enrollment follow-ups");
  });

  it("shows the error after a wrong code, and sign-out gates the view again", async () => {
    expect(await view({ signin: "wrong" })).toContain("didn’t match");
    signedIn();
    await expect(signOut()).rejects.toThrow("redirect:/");
    expect(await view()).toContain("one-time code");
  });
});

describe("the header", () => {
  beforeEach(signedIn);

  it("names the product and the Agent", async () => {
    const html = await view();
    expect(html).toMatch(/<h1>Integrity Client Advocate<\/h1>/);
    expect(html).toContain("Andrew");
  });
});

describe("the Client's phone switch", () => {
  beforeEach(signedIn);
  const shown = async (params: Record<string, string | undefined>) => {
    const html = await view(params as Record<string, string>);
    return { html, checked: html.match(/role="switch" aria-checked="(true|false)"/)?.[1], deskOn: /class="desk phone-on"/.test(html) };
  };

  it("is a switch, on by default, with the phone shown", async () => {
    const { html, checked, deskOn } = await shown({ phone: undefined, client: "client-01" });
    expect(checked).toBe("true");
    expect(deskOn).toBe(true);
    expect(html).toContain("Client phone simulator");
    expect(html).toContain("Client’s phone");
  });

  it("stays off after a reload once this browser switched it off", async () => {
    jar.set("client-phone", "off");
    const { checked, deskOn } = await shown({ phone: undefined, client: "client-01" });
    expect(checked).toBe("false");
    expect(deskOn).toBe(false);
  });

  it("is off with ?phone=off, and the simulator isn't rendered", async () => {
    const { html, checked, deskOn } = await shown({ phone: "off", client: "client-01" });
    expect(checked).toBe("false");
    expect(deskOn).toBe(false);
    expect(html).not.toContain("Client phone simulator");
  });
});

describe("the totals", () => {
  beforeEach(signedIn);

  it("are filter chips with the counts the stat cards had", async () => {
    const html = await view();
    const counts = Object.fromEntries([...html.matchAll(/class="filter[^"]*"[^>]*>([^<]+)<b>(\d+)<\/b>/g)].map((m) => [m[1].trim(), Number(m[2])]));
    const open = store.list("escalations").filter((e) => e.status === "open");
    expect(Object.keys(counts)).toEqual(["Needs you", "Due soon", "Submitted", "Resolved"]);
    expect(counts["Needs you"]).toBe(new Set(open.map((e) => e.clientId)).size);
    expect(counts["Resolved"]).toBe(store.list("dmis").filter((d) => d.status === "resolved").length);
  });

  it("show the counts as links that filter the queue", async () => {
    const html = await view();
    expect(html).toContain('href="/?filter=escalations"');
    expect(html).toContain('href="/?filter=due_soon"');
    expect(html).toContain('href="/?filter=submitted"');
    expect(html).toContain('href="/?filter=resolved"');
  });

  it("filtering narrows the queue, and the active total links back to the whole queue", async () => {
    const all = queueNames(await view());
    const html = await view({ filter: "resolved" });
    const some = queueNames(html);
    expect(some.length).toBeGreaterThan(0);
    expect(some.length).toBeLessThan(all.length);
    expect(html).toMatch(/aria-current="true"[^>]*href="\/"|href="\/"[^>]*aria-current="true"/);
  });

  it("keeps the selected Client when filtering", async () => {
    expect(await view({ client: "client-02" })).toContain('href="/?client=client-02&amp;filter=due_soon"');
  });
});

describe("the queue", () => {
  beforeEach(signedIn);

  it("badges an at-risk Client", async () => {
    const days = store.list("dmis").find((d) => d.status === "open")!;
    store.update("dmis", { ...days, deadline: new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10) });
    expect(await view()).toContain("At risk");
  });

  it("gives each row a window bar, red when the deadline is close and green once resolved", async () => {
    const dmi = store.list("dmis").find((d) => d.status === "open")!;
    store.update("dmis", { ...dmi, deadline: new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10) });
    const html = await view();
    expect(html).toMatch(/class="win soon"><i style="width:\d+%"><\/i>/);
    expect(html).toContain('class="win done"><i style="width:100%"></i>');
  });

  it("lists resolved Clients under a Resolved label", async () => {
    const html = await view();
    const [open, resolved] = html.split('class="group"');
    expect(resolved).toBeDefined();
    const name = store.list("clients").find((c) => c.id === store.list("dmis").find((d) => d.status === "resolved")!.clientId)!;
    expect(resolved).toContain(`${name.firstName} ${name.lastName}`);
    expect(open).not.toContain(`${name.firstName} ${name.lastName}`);
  });
});

describe("the detail panel", () => {
  beforeEach(signedIn);

  it("adds the window meter and the CRM placeholder to the action log and Notifications", async () => {
    const html = await view({ client: "client-01" });
    expect(html).toMatch(/role="meter"[^>]*aria-valuenow="\d+"/);
    expect(html).toMatch(/\d+-day window/);
    expect(html).toContain("View CRM record");
    expect(html).toContain("Action log");
    expect(html).toContain("Notifications");
  });
});
