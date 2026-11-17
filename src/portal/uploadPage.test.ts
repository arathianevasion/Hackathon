import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTools } from "../assistant/tools";
import { openStore, type Store } from "../store/store";
import { issuePortalLink, openUploadSession, PORTAL_LINK_BASE } from "./portalLink";
import { feedbackKey, uploadPageState } from "./uploadPage";

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
    expect(Object.keys(state).sort()).toEqual(["agentFirstName", "attempt", "copy", "dmiType", "due", "firstName", "fixes", "kind"]);
    const everything = JSON.stringify(state);
    for (const secret of ["Delgado-Finch", "555-01", "DEMO-APP", "CR-1041", "Demo Silver", "40,000", "40000", "900-"]) expect(everything).not.toContain(secret);
  });

  it("lists every fix after an insufficient check, and never carries the upload itself", () => {
    const token = opened();
    store.add("documents", {
      id: "dmi-01-upload-1",
      dmiId: "dmi-01",
      documentType: "pay stub",
      fileName: "my-private-photo.png",
      uploadedAt: NOW.toISOString(),
      precheck: { result: "insufficient", reasons: ["The document is cropped", "Name is missing", "Pay period is missing"] },
      submission: "not_submitted",
      watermark: "SPECIMEN",
    });
    store.add("documentFiles", { id: "dmi-01-upload-1", mediaType: "image/png", sizeBytes: 5, base64: "U1BFQ0lNRU4=" });
    const state = uploadPageState(store, token, NOW);
    expect(state).toMatchObject({
      kind: "open",
      fixes: {
        title: "2 things to fix",
        fixes: ["Your name: the top of the stub is cut off", "Pay period: the dates are cut off"],
        closing: "Retake the photo with the whole stub in the frame, flat and in good light.",
      },
    });
    const everything = JSON.stringify(state);
    for (const upload of ["my-private-photo", "U1BFQ0lNRU4=", "image/png"]) expect(everything).not.toContain(upload);
  });

  it("shows the mismatch panel after a name or SSN mismatch, naming nobody", () => {
    const token = opened();
    store.add("documents", {
      id: "d1", dmiId: "dmi-01", documentType: "pay stub", fileName: "a.png", uploadedAt: NOW.toISOString(), submission: "not_submitted", watermark: "SPECIMEN",
      precheck: { result: "insufficient", reasons: ["The name does not match the Client"] },
    });
    expect(uploadPageState(store, token, NOW)).toMatchObject({
      kind: "open",
      fixes: {
        title: "1 thing to fix",
        fixes: ["This document doesn't appear to be yours: the name or Social Security number doesn't match your application."],
        closing: "Upload one of the documents listed below that shows your name.",
      },
    });
  });

  it.each([
    ["cropped", ["The document is cropped"]],
    ["illegible", ["The document is not legible"]],
    ["a missing field", ["Pay is missing"]],
    ["the wrong document", ["Not a document that works for this DMI"]],
    ["a name mismatch", ["The name does not match the Client"]],
    ["an SSN mismatch", ["The SSN ending 1234 does not match the application"]],
  ])("shows visible fixes after an upload rejected as %s", (_kind, reasons) => {
    const token = opened();
    store.add("documents", {
      id: "d1", dmiId: "dmi-01", documentType: "pay stub", fileName: "a.png", uploadedAt: NOW.toISOString(), submission: "not_submitted", watermark: "SPECIMEN",
      precheck: { result: "insufficient", reasons },
    });
    const state = uploadPageState(store, token, NOW);
    expect(state).toMatchObject({ kind: "open", fixes: { fixes: expect.arrayContaining([expect.any(String)]) } });
    expect(feedbackKey(state)).not.toBeNull();
  });

  it("shows the escalated page once an Escalation is open", async () => {
    const token = opened();
    await createTools({ store, now: () => NOW, extract: () => Promise.reject(new Error("none")) }).escalate_to_agent({
      clientId: ROSA, trigger: "name_or_ssn_mismatch", summary: "s", clientWords: null, suggestedNextStep: "n",
    });
    const state = uploadPageState(store, token, NOW);
    expect(state.kind).toBe("paused");
    expect(feedbackKey(state)).toBe("paused");
  });

  it("shows no fixes once a later upload is waiting for its check", () => {
    const token = opened();
    const base = { dmiId: "dmi-01", documentType: "pay stub", fileName: "a.png", uploadedAt: NOW.toISOString(), submission: "not_submitted" as const, watermark: "SPECIMEN" as const };
    store.add("documents", { ...base, id: "d1", precheck: { result: "insufficient", reasons: ["Name is missing"] } });
    store.add("documents", { ...base, id: "d2", precheck: { result: "pending", reasons: [] } });
    expect(uploadPageState(store, token, NOW)).toMatchObject({ fixes: null });
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

  it("shows the paused state while an Escalation is open: the Agent will be in touch, and no upload is asked for", async () => {
    const token = opened();
    const tools = createTools({ store, now: () => NOW, extract: () => Promise.reject(new Error("none")) });
    await tools.escalate_to_agent({ clientId: ROSA, trigger: "income_or_application_change", summary: "s", clientWords: null, suggestedNextStep: null });
    expect(uploadPageState(store, token, NOW)).toEqual({ kind: "paused", agentFirstName: "Kalyani" });
  });
});

describe("feedbackKey", () => {
  const open = (attempt: number, fixes: unknown) => ({ kind: "open", attempt, fixes }) as never;
  it("changes with each rejected upload, so the page scrolls to its feedback every time", () => {
    const fixes = { title: "1 thing to fix", fixes: ["x"], closing: "y" };
    expect(feedbackKey(open(1, fixes))).not.toBeNull();
    expect(feedbackKey(open(1, fixes))).not.toBe(feedbackKey(open(2, fixes)));
  });
  it("is set for the escalated page and null when there is no feedback", () => {
    expect(feedbackKey({ kind: "paused", agentFirstName: "Kalyani" })).not.toBeNull();
    expect(feedbackKey(open(1, null))).toBeNull();
    expect(feedbackKey({ kind: "expired" })).toBeNull();
  });
});
