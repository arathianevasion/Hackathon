import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openStore, type Store } from "../store/store";
import { issuePortalLink, openUploadSession, uploadSession } from "./portalLink";
import { receiveUpload } from "./upload";

const NOW = new Date("2026-11-16T15:00:00Z");
const ROSA = "client-01";
const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);
const FILE = { choice: "Pay stub", fileName: "stub.png", mediaType: "image/png", bytes: Buffer.from("SPECIMEN pay stub") };

describe("the upload session", () => {
  let store: Store;
  beforeEach(() => {
    store = openStore(":memory:");
    store.reset(NOW);
  });
  afterEach(() => store.close());

  it("opens a 30-minute upload session on the link's first open, so a reload in that time still works", () => {
    const link = issuePortalLink(store, ROSA, "dmi-01", NOW);
    expect(openUploadSession(store, link.url, NOW)).toMatchObject({ ok: true });
    expect(openUploadSession(store, link.url, at(29))).toMatchObject({ ok: true });
    expect(uploadSession(store, link.url, at(29))).toMatchObject({ ok: true, link: { dmiId: "dmi-01", clientId: ROSA } });
  });

  it("closes the session after 30 minutes: the single-use link does not open again", () => {
    const link = issuePortalLink(store, ROSA, "dmi-01", NOW);
    openUploadSession(store, link.url, NOW);
    expect(openUploadSession(store, link.url, at(30))).toEqual({ ok: false, reason: "used" });
    expect(uploadSession(store, link.url, at(30))).toEqual({ ok: false, reason: "used" });
  });

  it("has no session for a link that was never opened, has expired or was never issued", () => {
    const link = issuePortalLink(store, ROSA, "dmi-01", NOW);
    expect(uploadSession(store, link.url, NOW)).toEqual({ ok: false, reason: "not_opened" });
    expect(openUploadSession(store, link.url, at(72 * 60))).toEqual({ ok: false, reason: "expired" });
    expect(openUploadSession(store, "https://portal.example/r/NOPE", NOW)).toEqual({ ok: false, reason: "unknown" });
  });
});

describe("receiveUpload", () => {
  let store: Store;
  beforeEach(() => {
    store = openStore(":memory:");
    store.reset(NOW);
  });
  afterEach(() => store.close());
  const deps = (minutes = 1) => ({ store, now: () => at(minutes) });

  it("stores the Document as pending with its file, and returns the event that runs the Assistant", () => {
    const link = issuePortalLink(store, ROSA, "dmi-01", NOW);
    openUploadSession(store, link.url, NOW);
    const event = receiveUpload(deps(), link.url, FILE);
    expect(event).toEqual({ name: "document.uploaded", clientId: ROSA, dmiId: "dmi-01", documentId: expect.any(String) });
    expect(store.list("documents").find((d) => d.id === event.documentId)).toEqual({
      id: event.documentId,
      dmiId: "dmi-01",
      documentType: "pay stub",
      fileName: "stub.png",
      uploadedAt: at(1).toISOString(),
      precheck: { result: "pending", reasons: [] },
      submission: "not_submitted",
      watermark: "SPECIMEN",
    });
    expect(store.list("documentFiles").find((f) => f.id === event.documentId)).toEqual({
      id: event.documentId,
      mediaType: "image/png",
      sizeBytes: FILE.bytes.length,
      base64: FILE.bytes.toString("base64"),
    });
  });

  it("refuses an upload without an open session", () => {
    const link = issuePortalLink(store, ROSA, "dmi-01", NOW);
    expect(() => receiveUpload(deps(), link.url, FILE)).toThrow(/not_opened/);
    openUploadSession(store, link.url, NOW);
    expect(() => receiveUpload(deps(31), link.url, FILE)).toThrow(/used/);
    expect(store.list("documents").filter((d) => d.dmiId === "dmi-01")).toEqual([]);
  });

  it("refuses an upload for a DMI that is no longer open", () => {
    const link = issuePortalLink(store, ROSA, "dmi-01", NOW);
    openUploadSession(store, link.url, NOW);
    store.update("dmis", { ...store.list("dmis").find((d) => d.id === "dmi-01")!, status: "documents_submitted" });
    expect(() => receiveUpload(deps(), link.url, FILE)).toThrow(/documents_submitted/);
  });
});
