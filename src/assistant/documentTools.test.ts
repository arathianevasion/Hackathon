import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { ExtractedFields, InlineFile } from "../documents/extract";
import { openStore, type Store } from "../store/store";
import { createTools, type Tools } from "./tools";

const NOW = new Date("2026-11-16T15:00:00Z");
const ROSA = "client-01"; // income DMI dmi-01, CR-1041, attested $40,000
const LENA = "client-05"; // SSN DMI dmi-05, application SSN 900-05-4405

const FULL_STUB: ExtractedFields = {
  documentType: "pay stub",
  name: "Rosa Delgado-Finch",
  ssn: null,
  pay: { amount: 1560, frequency: "biweekly" },
  annualIncome: null,
  payPeriodStart: "2026-10-16",
  payPeriodEnd: "2026-10-31",
  payDate: "2026-11-05",
  taxYear: null,
  employer: "Northwind Fabrication LLC",
  legible: true,
  cropped: false,
};

describe("document tools", () => {
  let store: Store;
  let extracted: ExtractedFields;
  let extract: Mock<(file: InlineFile) => Promise<ExtractedFields>>;
  let tools: Tools;
  let seededLog: number;

  beforeEach(() => {
    store = openStore(":memory:");
    store.reset(NOW);
    extracted = FULL_STUB;
    extract = vi.fn(async () => extracted);
    tools = createTools({ store, now: () => NOW, extract });
    seededLog = store.list("actionLog").length;
  });
  afterEach(() => store.close());

  /** A Client uploads a file for a DMI, as the upload page stores it. */
  const upload = (dmiId: string, id = `${dmiId}-upload-1`) => {
    store.add("documents", {
      id,
      dmiId,
      documentType: "pay stub",
      fileName: "SPECIMEN-pay-stub.png",
      uploadedAt: NOW.toISOString(),
      precheck: { result: "pending", reasons: [] },
      submission: "not_submitted",
      watermark: "SPECIMEN",
    });
    store.add("documentFiles", { id, mediaType: "image/png", sizeBytes: 300_000, base64: "iVBORw0KGgo=" });
    return id;
  };
  const doc = (id: string) => store.list("documents").find((d) => d.id === id)!;
  const dmi = (id: string) => store.list("dmis").find((d) => d.id === id)!;
  const newLog = () => store.list("actionLog").slice(seededLog);

  describe("precheck_document", () => {
    it("extracts the uploaded file, judges it by the rules and records the result on the Document", async () => {
      const id = upload("dmi-01");
      expect(await tools.precheck_document({ documentId: id })).toEqual({ result: "sufficient", reasons: [] });
      expect(extract).toHaveBeenCalledWith({ mediaType: "image/png", base64: "iVBORw0KGgo=" });
      expect(doc(id).precheck).toEqual({ result: "sufficient", reasons: [] });
      expect(newLog().at(-1)).toMatchObject({ clientId: ROSA, tool: "precheck_document", consentRecordId: "CR-1041", result: "Sufficient" });
    });

    it("lists every failed check for a cropped stub", async () => {
      extracted = { ...FULL_STUB, cropped: true, name: null, payPeriodStart: null };
      const id = upload("dmi-01");
      expect(await tools.precheck_document({ documentId: id })).toEqual({
        result: "insufficient",
        reasons: ["The document is cropped", "Name is missing", "Pay period is missing"],
      });
      expect(newLog().at(-1)!.result).toBe("Insufficient: The document is cropped; Name is missing; Pay period is missing");
    });

    it("never stores, logs or returns an extracted SSN beyond its last 4", async () => {
      extracted = { ...FULL_STUB, documentType: "Social Security card", name: "Lena Marsh", pay: null, payPeriodStart: null, payPeriodEnd: null, payDate: null, ssn: "900-05-1234" };
      const id = upload("dmi-05");
      const result = await tools.precheck_document({ documentId: id });
      expect(result.reasons).toEqual(["The SSN ending 1234 does not match the application"]);
      expect(JSON.stringify([result, store.list("documents"), store.list("actionLog")])).not.toMatch(/900-05-1234|900051234/);
    });

    it("passes an SSN card whose number matches the application", async () => {
      extracted = { ...FULL_STUB, documentType: "Social Security card", name: "Lena Marsh", pay: null, payPeriodStart: null, payPeriodEnd: null, payDate: null, ssn: "900-05-4405" };
      expect((await tools.precheck_document({ documentId: upload("dmi-05") })).result).toBe("sufficient");
      expect(newLog().at(-1)!.clientId).toBe(LENA);
    });

    it("throws for a Document that does not exist", async () => {
      await expect(tools.precheck_document({ documentId: "nope" })).rejects.toThrow(/nope/);
    });
  });

  describe("get_dmi_status", () => {
    it("reads the Marketplace status of a DMI and logs the read", async () => {
      expect(await tools.get_dmi_status({ dmiId: "dmi-01" })).toEqual({ dmiId: "dmi-01", status: "open" });
      store.update("dmis", { ...dmi("dmi-01"), status: "resolved", resolvedAt: NOW.toISOString() });
      expect(await tools.get_dmi_status({ dmiId: "dmi-01" })).toEqual({ dmiId: "dmi-01", status: "resolved" });
      expect(newLog().at(-1)).toMatchObject({ clientId: ROSA, tool: "get_dmi_status", result: "Marketplace status: resolved" });
    });

    it("throws for a DMI that does not exist", async () => {
      await expect(tools.get_dmi_status({ dmiId: "dmi-nope" })).rejects.toThrow("No DMI dmi-nope");
    });
  });

  describe("submit_documents", () => {
    it("submits a sufficient Document to the mocked Marketplace, notifies the Agent and logs it with the Consent record", async () => {
      const id = upload("dmi-01");
      await tools.precheck_document({ documentId: id });
      const notes = store.list("notifications").length;
      expect(await tools.submit_documents({ dmiId: "dmi-01", documentIds: [id] })).toEqual({ submitted: true, dmiStatus: "documents_submitted" });
      expect(doc(id).submission).toBe("submitted");
      expect(dmi("dmi-01").status).toBe("documents_submitted");
      expect(store.list("notifications").slice(notes)).toEqual([
        { id: expect.any(String), agentId: "agent-1", clientId: ROSA, event: "documents_submitted", at: NOW.toISOString() },
      ]);
      expect(newLog().at(-1)).toMatchObject({ tool: "submit_documents", consentRecordId: "CR-1041", result: "Submitted to the Marketplace" });
    });

    it.each([
      ["not yet checked", null],
      ["insufficient", { ...FULL_STUB, cropped: true }],
      ["ambiguous", { ...FULL_STUB, pay: { amount: 3000, frequency: "biweekly" as const } }],
    ])("refuses a Document that is %s, submitting nothing", async (_label, fields) => {
      const id = upload("dmi-01");
      if (fields) {
        extracted = fields;
        await tools.precheck_document({ documentId: id });
      }
      const notes = store.list("notifications").length;
      expect(await tools.submit_documents({ dmiId: "dmi-01", documentIds: [id] })).toEqual({ submitted: false, dmiStatus: "open" });
      expect(doc(id).submission).toBe("not_submitted");
      expect(dmi("dmi-01").status).toBe("open");
      expect(store.list("notifications")).toHaveLength(notes);
      expect(newLog().at(-1)).toMatchObject({ tool: "submit_documents", result: `Refused: ${id} is not sufficient` });
    });

    it("refuses when any one of the Documents is not sufficient", async () => {
      const good = upload("dmi-01", "good");
      await tools.precheck_document({ documentId: good });
      const bad = upload("dmi-01", "bad");
      expect((await tools.submit_documents({ dmiId: "dmi-01", documentIds: [good, bad] })).submitted).toBe(false);
      expect(doc(good).submission).toBe("not_submitted");
    });

    it("refuses a Document that belongs to another DMI", async () => {
      extracted = { ...FULL_STUB, documentType: "Social Security card", name: "Lena Marsh", ssn: "900-05-4405" };
      const lenas = upload("dmi-05");
      await tools.precheck_document({ documentId: lenas });
      expect((await tools.submit_documents({ dmiId: "dmi-01", documentIds: [lenas] })).submitted).toBe(false);
    });

    it("refuses with no Documents", async () => {
      expect((await tools.submit_documents({ dmiId: "dmi-01", documentIds: [] })).submitted).toBe(false);
    });

    it("refuses without consent for document submission", async () => {
      const id = upload("dmi-01");
      await tools.precheck_document({ documentId: id });
      const consent = store.list("consentRecords").find((c) => c.clientId === ROSA)!;
      store.update("consentRecords", { ...consent, actions: ["text_outreach", "portal_link"] });
      expect((await tools.submit_documents({ dmiId: "dmi-01", documentIds: [id] })).submitted).toBe(false);
      expect(doc(id).submission).toBe("not_submitted");
    });

    it("does not submit the same Document twice", async () => {
      const id = upload("dmi-01");
      await tools.precheck_document({ documentId: id });
      await tools.submit_documents({ dmiId: "dmi-01", documentIds: [id] });
      expect((await tools.submit_documents({ dmiId: "dmi-01", documentIds: [id] })).submitted).toBe(false);
    });
  });

  describe("lookup_dmi_rules", () => {
    it("gives the documents that work and the deadline fallback per DMI type", async () => {
      expect(await tools.lookup_dmi_rules({ dmiType: "income" })).toEqual({
        dmiType: "income",
        acceptableDocuments: ["pay stub", "W-2", "1099", "1040", "Social Security benefits letter", "unemployment letter"],
        defaultDeadlineDays: 90,
      });
    });
  });
});
