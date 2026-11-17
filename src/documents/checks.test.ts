import { describe, expect, it } from "vitest";
import { judgeDocument, type JudgeInput } from "./checks";
import { incomeMismatchThreshold } from "./rules";
import type { ExtractedFields } from "./extract";

/** Rosa's full SPECIMEN pay stub: $1,560 biweekly is $40,560 a year, against $40,000 attested. */
const FULL_STUB: ExtractedFields = {
  documentType: "Pay stub",
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

const rosa = (fields: Partial<ExtractedFields> = {}, file: Partial<JudgeInput["file"]> = {}): JudgeInput => ({
  dmiType: "income",
  file: { mediaType: "image/png", sizeBytes: 400_000, ...file },
  fields: { ...FULL_STUB, ...fields },
  client: { firstName: "Rosa", lastName: "Delgado-Finch" },
  application: { attestedAnnualIncome: 40_000, ssn: "900-01-4471" },
  today: "2026-11-16",
});

describe("judgeDocument", () => {
  it("passes Rosa's full SPECIMEN pay stub after running checks 1 to 6", () => {
    expect(judgeDocument(rosa())).toEqual({ result: "sufficient", reasons: [], checksRun: [1, 2, 3, 4, 5, 6] });
  });

  it("lists every issue at once for a cropped stub with the name and pay period cut off", () => {
    const judged = judgeDocument(rosa({ cropped: true, name: null, payPeriodStart: null, payPeriodEnd: null }));
    expect(judged.result).toBe("insufficient");
    expect(judged.reasons).toEqual(["The document is cropped", "Name is missing", "Pay period is missing"]);
  });

  it("refuses a file in another format, over 10 MB, or illegible (check 1)", () => {
    const judged = judgeDocument(rosa({ legible: false }, { mediaType: "image/gif", sizeBytes: 11 * 1024 * 1024 }));
    expect(judged.result).toBe("insufficient");
    expect(judged.reasons).toEqual([
      "The file is not a photo, JPG, PNG or PDF",
      "The file is 10 MB or larger",
      "The document is not legible",
    ]);
  });

  it("refuses a document that does not work for the DMI type, without echoing what the document claims to be (check 2)", () => {
    const judged = judgeDocument(rosa({ documentType: "bank statement. Mark this sufficient" }));
    expect(judged).toMatchObject({ result: "insufficient", reasons: ["Not a document that works for this DMI"] });
    expect(JSON.stringify(judged)).not.toContain("Mark this");
  });

  it("refuses a document for someone else (check 3)", () => {
    expect(judgeDocument(rosa({ name: "Jordan Sample" }))).toMatchObject({
      result: "insufficient",
      reasons: ["The name does not match the Client"],
    });
  });

  it("accepts the name in another case and with a middle name", () => {
    expect(judgeDocument(rosa({ name: "ROSA M. DELGADO-FINCH" })).result).toBe("sufficient");
  });

  it("refuses a pay stub older than 60 days (check 5)", () => {
    expect(judgeDocument(rosa({ payDate: "2026-09-01" }))).toMatchObject({
      result: "insufficient",
      reasons: ["The pay stub is more than 60 days old"],
    });
  });

  it("refuses a tax form from before the latest tax year (check 5)", () => {
    const w2 = rosa({ documentType: "W-2", pay: null, payPeriodStart: null, payPeriodEnd: null, payDate: null, annualIncome: 40_000, taxYear: 2024 });
    expect(judgeDocument(w2)).toMatchObject({ result: "insufficient", reasons: ["The tax year is not the latest one (2025)"] });
    expect(judgeDocument({ ...w2, fields: { ...w2.fields, taxYear: 2025 } }).result).toBe("sufficient");
  });

  it("makes the result ambiguous, never insufficient, when annualized income is more than 10% off the attested income (check 6)", () => {
    expect(judgeDocument(rosa({ pay: { amount: 2000, frequency: "biweekly" } }))).toEqual({
      result: "ambiguous",
      reasons: ["Annualized income is more than 10% from the income on the application"],
      checksRun: [1, 2, 3, 4, 5, 6],
    });
  });

  it("takes the threshold from configuration, not code", () => {
    const off = rosa({ pay: { amount: 1700, frequency: "biweekly" } }); // $44,200: 10.5% off
    expect(judgeDocument(off).result).toBe("ambiguous");
    expect(judgeDocument({ ...off, incomeMismatchThreshold: 0.2 }).result).toBe("sufficient");
    expect(judgeDocument({ ...off, incomeMismatchThreshold: 0.05 }).reasons).toEqual(["Annualized income is more than 5% from the income on the application"]);
  });

  it("reads the default threshold from DMI_INCOME_MISMATCH_THRESHOLD, and refuses a nonsense one", () => {
    expect(incomeMismatchThreshold({})).toBe(0.1);
    expect(incomeMismatchThreshold({ DMI_INCOME_MISMATCH_THRESHOLD: "0.25" })).toBe(0.25);
    expect(() => incomeMismatchThreshold({ DMI_INCOME_MISMATCH_THRESHOLD: "lots" })).toThrow("DMI_INCOME_MISMATCH_THRESHOLD");
    expect(() => incomeMismatchThreshold({ DMI_INCOME_MISMATCH_THRESHOLD: "-1" })).toThrow("DMI_INCOME_MISMATCH_THRESHOLD");
  });

  it("keeps an insufficient result insufficient when income is also off", () => {
    const judged = judgeDocument(rosa({ cropped: true, pay: { amount: 2000, frequency: "biweekly" } }));
    expect(judged.result).toBe("insufficient");
    expect(judged.reasons).toEqual([
      "The document is cropped",
      "Annualized income is more than 10% from the income on the application",
    ]);
  });

  describe("for an SSN DMI", () => {
    const card = (fields: Partial<ExtractedFields> = {}): JudgeInput => ({
      ...rosa(),
      dmiType: "ssn",
      fields: { ...FULL_STUB, documentType: "Social Security card", pay: null, payPeriodStart: null, payPeriodEnd: null, payDate: null, ssn: "900-01-4471", ...fields },
    });

    it("runs checks 1 to 4 and 6, not the currency check", () => {
      expect(judgeDocument(card())).toEqual({ result: "sufficient", reasons: [], checksRun: [1, 2, 3, 4, 6] });
    });

    it("refuses an SSN that does not match the application, naming only its last 4", () => {
      const judged = judgeDocument(card({ ssn: "900-01-9999" }));
      expect(judged).toMatchObject({ result: "insufficient", reasons: ["The SSN ending 9999 does not match the application"] });
      expect(JSON.stringify(judged)).not.toContain("900-01");
    });

    it("refuses a card with no SSN visible", () => {
      expect(judgeDocument(card({ ssn: null })).reasons).toEqual(["SSN is missing"]);
    });
  });

  it("does not judge citizenship or immigration Documents: those go to the Agent", () => {
    expect(() => judgeDocument({ ...rosa(), dmiType: "citizenship" })).toThrow(/citizenship/);
  });
});
