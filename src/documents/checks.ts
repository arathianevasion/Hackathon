import type { DmiType, IsoDate, PrecheckResult } from "../contract";
import { daysBetween } from "../dates";
import type { ExtractedFields } from "./extract";
import {
  ALLOWED_MEDIA_TYPES,
  CURRENT_WITHIN_DAYS,
  dmiRules,
  incomeMismatchThreshold,
  MAX_FILE_BYTES,
  type CheckNumber,
  type RequiredField,
} from "./rules";

/** Everything the deterministic checks compare: the file, the extracted fields, the Client and their application. */
export interface JudgeInput {
  dmiType: DmiType;
  file: { mediaType: string; sizeBytes: number };
  fields: ExtractedFields;
  client: { firstName: string; lastName: string };
  /** What the Client attested on their Marketplace application. */
  application: { attestedAnnualIncome: number; ssn: string };
  today: IsoDate;
  /** A share of attested income; defaults to the configured `incomeMismatchThreshold()`. */
  incomeMismatchThreshold?: number;
}

export interface Judgement {
  result: Exclude<PrecheckResult, "pending">;
  /** Every issue found, in check order; empty when sufficient. Never echoes extracted text, and never more than an SSN's last 4. */
  reasons: string[];
  checksRun: CheckNumber[];
}

const PERIODS_PER_YEAR = { weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12 } as const;

/** The reasons the checks give that guidance needs to recognise; one place, so the words can't drift apart. */
export const REASON = {
  cropped: "The document is cropped",
  illegible: "The document is not legible",
  nameMismatch: "The name does not match the Client",
  missing: (field: RequiredField) => `${FIELD_LABEL[field]} is missing`,
  ssnMismatchPrefix: "The SSN ending ",
} as const;

export const FIELD_LABEL: Record<RequiredField, string> = {
  name: "Name",
  ssn: "SSN",
  pay: "Pay",
  payPeriod: "Pay period",
  payDate: "Pay date",
  annualIncome: "Income",
  taxYear: "Tax year",
};

/**
 * Judges a Document by the spec's deterministic checks (ADR 0001): every check
 * for the DMI type runs, every issue is listed, and the model's only part was
 * extracting `fields`. Checks 1 to 5 failing make it insufficient; an income
 * mismatch alone (check 6) makes it ambiguous; an SSN mismatch, insufficient.
 */
export function judgeDocument(input: JudgeInput): Judgement {
  const rules = dmiRules(input.dmiType);
  if (rules.checks.length === 0) throw new Error(`${input.dmiType} DMIs are not checked: they go to the Agent`);
  const { fields } = input;
  const docKey = rules.acceptableDocuments.find((d) => d.toLowerCase() === fields.documentType?.trim().toLowerCase());

  const failed: { check: CheckNumber; reason: string }[] = [];
  const fail = (check: CheckNumber, reason: string) => failed.push({ check, reason });

  for (const check of rules.checks) {
    switch (check) {
      case 1:
        if (!(ALLOWED_MEDIA_TYPES as readonly string[]).includes(input.file.mediaType)) fail(1, "The file is not a photo, JPG, PNG or PDF");
        if (input.file.sizeBytes >= MAX_FILE_BYTES) fail(1, "The file is 10 MB or larger");
        if (!fields.legible) fail(1, REASON.illegible);
        if (fields.cropped) fail(1, REASON.cropped);
        break;
      case 2:
        if (!docKey) fail(2, "Not a document that works for this DMI");
        break;
      case 3:
        if (fields.name !== null && !sameName(fields.name, input.client)) fail(3, REASON.nameMismatch);
        break;
      case 4:
        for (const field of docKey ? rules.requiredFields[docKey] : ["name" as const]) {
          if (!present(fields, field)) fail(4, REASON.missing(field));
        }
        break;
      case 5: {
        const stale = staleness(fields, input.today);
        if (stale) fail(5, stale);
        break;
      }
      case 6:
        if (input.dmiType === "income") {
          const annual = annualized(fields);
          const attested = input.application.attestedAnnualIncome;
          const threshold = input.incomeMismatchThreshold ?? incomeMismatchThreshold();
          if (annual !== null && Math.abs(annual - attested) / attested > threshold) {
            fail(6, `Annualized income is more than ${Math.round(threshold * 1000) / 10}% from the income on the application`);
          }
        } else if (fields.ssn !== null && digits(fields.ssn) !== digits(input.application.ssn)) {
          fail(6, `${REASON.ssnMismatchPrefix}${digits(fields.ssn).slice(-4)} does not match the application`);
        }
        break;
    }
  }

  const reasons = failed.map((f) => f.reason);
  const incomeMismatchOnly = failed.length > 0 && failed.every((f) => f.check === 6) && input.dmiType === "income";
  const result = failed.length === 0 ? "sufficient" : incomeMismatchOnly ? "ambiguous" : "insufficient";
  return { result, reasons, checksRun: [...rules.checks] };
}

function present(fields: ExtractedFields, field: RequiredField): boolean {
  switch (field) {
    case "payPeriod":
      return fields.payPeriodStart !== null && fields.payPeriodEnd !== null;
    case "name":
    case "ssn":
      return Boolean(fields[field]?.trim());
    default:
      return fields[field] !== null;
  }
}

/** Why the document is not current (check 5), or null: latest tax year, or a pay or letter date in the last 60 days. */
function staleness(fields: ExtractedFields, today: IsoDate): string | null {
  if (fields.taxYear !== null) {
    const latest = Number(today.slice(0, 4)) - 1;
    return fields.taxYear < latest ? `The tax year is not the latest one (${latest})` : null;
  }
  if (fields.payDate === null) return null;
  const age = daysBetween(fields.payDate, today);
  return age > CURRENT_WITHIN_DAYS ? `The pay stub is more than ${CURRENT_WITHIN_DAYS} days old` : null;
}

function annualized(fields: ExtractedFields): number | null {
  if (fields.pay) return fields.pay.amount * PERIODS_PER_YEAR[fields.pay.frequency];
  return fields.annualIncome;
}

/** Every part of the Client's first and last name appears in the printed name; case, punctuation and middle names aside. */
function sameName(printed: string, client: { firstName: string; lastName: string }): boolean {
  const words = (s: string) => s.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  const seen = new Set(words(printed));
  return words(`${client.firstName} ${client.lastName}`).every((w) => seen.has(w));
}

function digits(s: string): string {
  return s.replace(/\D/g, "");
}

/**
 * The fields the Agent is shown on an Escalation for an ambiguous Document:
 * what was extracted, with the SSN cut to its last 4. Never the file itself.
 */
export function describeExtracted(fields: ExtractedFields): string {
  const parts: [string, string | number | null][] = [
    ["Document", fields.documentType],
    ["Name", fields.name],
    ["SSN", fields.ssn === null ? null : `•••-••-${digits(fields.ssn).slice(-4)}`],
    ["Pay", fields.pay ? `${fields.pay.amount} ${fields.pay.frequency}` : null],
    ["Annual income", fields.annualIncome],
    ["Pay period", fields.payPeriodStart && fields.payPeriodEnd ? `${fields.payPeriodStart} to ${fields.payPeriodEnd}` : null],
    ["Pay date", fields.payDate],
    ["Tax year", fields.taxYear],
    ["Employer", fields.employer],
  ];
  return parts.filter(([, v]) => v !== null).map(([k, v]) => `${k}: ${v}`).join("; ");
}
