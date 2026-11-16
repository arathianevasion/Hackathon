import type { DmiRules, DmiType } from "../contract";

/** The document checks, numbered as in the spec ("How a document is judged"). */
export type CheckNumber = 1 | 2 | 3 | 4 | 5 | 6;

/** A field the extraction can return, as the required-fields check names it. */
export type RequiredField = "name" | "ssn" | "pay" | "payPeriod" | "payDate" | "annualIncome" | "taxYear";

/** What `lookup_dmi_rules` knows per DMI type, beyond the contract's `DmiRules`. */
export interface DocumentRules extends DmiRules {
  /** The checks that run for this DMI type; citizenship and immigration go to the Agent, so none. */
  checks: CheckNumber[];
  /** Required fields per document that works, keyed as in `acceptableDocuments`. */
  requiredFields: Record<string, RequiredField[]>;
}

/** Formats a Document may arrive in (check 1). */
export const ALLOWED_MEDIA_TYPES = ["image/jpeg", "image/png", "application/pdf"] as const;
/** Largest file accepted (check 1): under 10 MB. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
/** Pay stubs and letters count as current for this many days (check 5). */
export const CURRENT_WITHIN_DAYS = 60;
/** Annualized income further than this share from the attested income makes the result ambiguous (check 6). */
export const INCOME_MISMATCH_THRESHOLD = 0.1;

const TAX_FORM: RequiredField[] = ["name", "annualIncome", "taxYear"];
const LETTER: RequiredField[] = ["name", "annualIncome", "payDate"];
const SHOWS_SSN: RequiredField[] = ["name", "ssn"];

const RULES: Record<DmiType, DocumentRules> = {
  income: {
    dmiType: "income",
    acceptableDocuments: ["pay stub", "W-2", "1099", "1040", "Social Security benefits letter", "unemployment letter"],
    defaultDeadlineDays: 90,
    checks: [1, 2, 3, 4, 5, 6],
    requiredFields: {
      "pay stub": ["name", "pay", "payPeriod", "payDate"],
      "W-2": TAX_FORM,
      "1099": TAX_FORM,
      "1040": TAX_FORM,
      "Social Security benefits letter": LETTER,
      "unemployment letter": LETTER,
    },
  },
  ssn: {
    dmiType: "ssn",
    acceptableDocuments: ["Social Security card", "W-2", "1099", "1040", "pay stub", "SSA letter"],
    defaultDeadlineDays: 90,
    checks: [1, 2, 3, 4, 6],
    requiredFields: {
      "Social Security card": SHOWS_SSN,
      "W-2": SHOWS_SSN,
      "1099": SHOWS_SSN,
      "1040": SHOWS_SSN,
      "pay stub": SHOWS_SSN,
      "SSA letter": SHOWS_SSN,
    },
  },
  citizenship: { dmiType: "citizenship", acceptableDocuments: [], defaultDeadlineDays: 95, checks: [], requiredFields: {} },
  immigration: { dmiType: "immigration", acceptableDocuments: [], defaultDeadlineDays: 95, checks: [], requiredFields: {} },
};

/** The deadline, documents that work, checks and required fields for one DMI type. */
export function dmiRules(type: DmiType): DocumentRules {
  return RULES[type];
}
