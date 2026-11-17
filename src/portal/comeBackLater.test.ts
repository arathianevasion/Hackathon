import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTools } from "../assistant/tools";
import { createClock } from "../cadence/clock";
import { fastForward, nextNudgeAt } from "../cadence/engine";
import { openStore, type Store } from "../store/store";
import { comeBackLater } from "./comeBackLater";
import { issuePortalLink, openUploadSession, PORTAL_LINK_BASE } from "./portalLink";
import { receiveUpload } from "./upload";
import { uploadPageState } from "./uploadPage";

const NOW = new Date("2026-11-16T15:00:00Z"); // 10:00 local
const ROSA = "client-01"; // income DMI dmi-01, due 2026-11-26: the compressed schedule, nudge after 1 day
const MARCUS = "client-02"; // income, 23 days left: nudge after 3 days
const PHOTO = { choice: "Pay stub", fileName: "stub.png", mediaType: "image/png", bytes: new Uint8Array([1, 2, 3]) };

describe("coming back later from the upload page", () => {
  let store: Store;
  beforeEach(() => {
    store = openStore(":memory:");
    store.reset(NOW);
  });
  afterEach(() => store.close());

  const deps = (at = NOW) => ({ store, now: () => at });
  const opened = (clientId = ROSA, dmiId = "dmi-01") => {
    store.add("messages", { id: "m-first", clientId, sender: "assistant", sentAt: NOW.toISOString(), text: "first text" });
    const link = issuePortalLink(store, clientId, dmiId, NOW);
    openUploadSession(store, link.url, NOW);
    return link.url.slice(PORTAL_LINK_BASE.length);
  };
  const thread = (clientId: string) => store.list("messages").filter((m) => m.clientId === clientId);

  it("closes the link and shows the later page; no upload is possible after", async () => {
    const token = opened();
    await comeBackLater(deps(), token);
    expect(uploadPageState(store, token, NOW)).toMatchObject({ kind: "later", firstName: "Rosa", dmiType: "income", due: "Nov 26" });
    expect(() => receiveUpload(deps(), `${PORTAL_LINK_BASE}${token}`, PHOTO)).toThrow(/closed/);
    expect(openUploadSession(store, `${PORTAL_LINK_BASE}${token}`, NOW)).toEqual({ ok: false, reason: "closed" });
    expect(store.list("documents").filter((d) => d.dmiId === "dmi-01" && d.fileName === "stub.png")).toEqual([]);
  });

  it("texts the Client the promise, naming the day the scheduled nudge goes out", async () => {
    const token = opened();
    await comeBackLater(deps(), token);
    expect(thread(ROSA).at(-1)).toMatchObject({
      sender: "assistant",
      text: `No rush. When you find it, text me "ready" and I'll send a fresh link. If I haven't heard from you, I'll check in on Nov 17.`,
    });
    expect(nextNudgeAt(store, ROSA)!.toISOString()).toBe("2026-11-17T15:00:00.000Z");
  });

  it("names the day the engine really nudges: 3 days out on the long schedule", async () => {
    const token = opened(MARCUS, "dmi-02");
    await comeBackLater(deps(), token);
    expect(thread(MARCUS).at(-1)!.text).toContain("I'll check in on Nov 19.");
    const clock = createClock(NOW);
    const tools = createTools({ store, now: clock.now, extract: async () => ({}) as never });
    const fired = await fastForward({ store, clock, tools }, 3);
    expect(fired).toEqual([{ clientId: MARCUS, dmiId: "dmi-02", step: "nudge" }]);
    expect(thread(MARCUS).at(-1)!.sentAt.slice(0, 10)).toBe("2026-11-19");
  });

  it("does nothing for a link that has expired or does not exist", async () => {
    const link = issuePortalLink(store, ROSA, "dmi-01", new Date(NOW.getTime() - 100 * 3_600_000));
    const before = store.list("messages").length;
    await comeBackLater(deps(), link.url.slice(PORTAL_LINK_BASE.length));
    await comeBackLater(deps(), "NOSUCHTOKEN");
    expect(store.list("messages")).toHaveLength(before);
  });

  it("shows the expired page for an expired link, and takes no upload", () => {
    const link = issuePortalLink(store, ROSA, "dmi-01", new Date(NOW.getTime() - 73 * 3_600_000));
    const token = link.url.slice(PORTAL_LINK_BASE.length);
    expect(uploadPageState(store, token, NOW)).toEqual({ kind: "expired" });
    expect(() => receiveUpload(deps(), link.url, PHOTO)).toThrow(/expired/);
  });
});
