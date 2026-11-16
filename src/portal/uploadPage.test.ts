import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openStore, type Store } from "../store/store";
import { issuePortalLink, openUploadSession, PORTAL_LINK_BASE } from "./portalLink";
import { uploadPageState } from "./uploadPage";

const NOW = new Date("2026-11-16T15:00:00Z");
const ROSA = "client-01"; // income DMI dmi-01, due 2026-11-26

describe("uploadPageState", () => {
  let store: Store;
  beforeEach(() => {
    store = openStore(":memory:");
    store.reset(NOW);
  });
  afterEach(() => store.close());

  const opened = () => {
    const link = issuePortalLink(store, ROSA, "dmi-01", NOW);
    openUploadSession(store, link.url, NOW);
    return link.url.slice(PORTAL_LINK_BASE.length);
  };

  it("gives the page only the first name, DMI type and due date, plus variant D's words", () => {
    const state = uploadPageState(store, opened(), NOW);
    expect(state).toMatchObject({ kind: "open", firstName: "Rosa", dmiType: "income", due: "Nov 26" });
    expect(Object.keys(state).sort()).toEqual(["copy", "dmiType", "due", "firstName", "kind"]);
    const everything = JSON.stringify(state);
    for (const secret of ["Delgado-Finch", "555-01", "DEMO-APP", "CR-1041", "Demo Silver", "40,000", "40000", "900-"]) expect(everything).not.toContain(secret);
  });

  it("shows the Document as sent once it is with the Marketplace", () => {
    const token = opened();
    store.update("dmis", { ...store.list("dmis").find((d) => d.id === "dmi-01")!, status: "documents_submitted" });
    expect(uploadPageState(store, token, NOW)).toMatchObject({ kind: "submitted", firstName: "Rosa" });
  });

  it("shows a link with no running session as expired, with no personal information at all", () => {
    const token = opened();
    expect(uploadPageState(store, token, new Date(NOW.getTime() + 31 * 60_000))).toEqual({ kind: "expired" });
    expect(uploadPageState(store, "NOPE", NOW)).toEqual({ kind: "expired" });
  });
});
