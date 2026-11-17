import { FIELD_LABEL, REASON } from "./checks";
import type { RequiredField } from "./rules";

/** The fixes for an insufficient Document, in the Client's words: one list for the page and the text. */
export interface Guidance {
  /** "2 things to fix", as variant D's page titles it. */
  title: string;
  /** One line per failed rule, in check order. */
  fixes: string[];
  /** What to send instead. */
  closing: string;
}

const FIELDS = Object.keys(FIELD_LABEL) as RequiredField[];

/** How a missing field reads to the Client; a cropped photo says where it was cut off (variant D, verbatim). */
const MISSING: Record<RequiredField, { cropped: string; plain: string }> = {
  name: { cropped: "Your name: the top of the stub is cut off", plain: "Your name: it isn't visible" },
  payPeriod: { cropped: "Pay period: the dates are cut off", plain: "Pay period: the dates aren't visible" },
  pay: { cropped: "Your pay: it's cut off", plain: "Your pay: it isn't visible" },
  payDate: { cropped: "Pay date: it's cut off", plain: "Pay date: it isn't visible" },
  ssn: { cropped: "Your Social Security number: it's cut off", plain: "Your Social Security number: it isn't visible" },
  annualIncome: { cropped: "Your income: it's cut off", plain: "Your income: it isn't visible" },
  taxYear: { cropped: "Tax year: it's cut off", plain: "Tax year: it isn't visible" },
};

const RETAKE = "Retake the photo with the whole stub in the frame, flat and in good light.";
const OTHER_DOCUMENT = "Choose one of the documents listed on the page.";

/**
 * Writes the fixes from the failed rules' reasons (`Judgement.reasons`): nothing
 * here decides pass or fail. Null when the Document failed on who it belongs to
 * (a name or SSN that doesn't match the application): that is for the Agent,
 * not another upload.
 */
export function guidanceFor(reasons: string[]): Guidance | null {
  if (reasons.some((r) => r === REASON.nameMismatch || r.startsWith(REASON.ssnMismatchPrefix))) return null;
  if (reasons.length === 0) return null;
  const cropped = reasons.includes(REASON.cropped);
  const photo = [REASON.cropped, REASON.illegible];
  const lines = reasons.map((r) => {
    const field = FIELDS.find((f) => r === REASON.missing(f));
    return field ? MISSING[field][cropped ? "cropped" : "plain"] : r;
  });
  // A cropped or unreadable photo is explained by the closing line once the missing parts are listed.
  const fixes = lines.filter((line, i) => !photo.includes(reasons[i]) || lines.every((_, j) => photo.includes(reasons[j])));
  const retake = reasons.some((r) => photo.includes(r) || FIELDS.some((f) => r === REASON.missing(f)));
  return {
    title: `${fixes.length} ${fixes.length === 1 ? "thing" : "things"} to fix`,
    fixes,
    closing: retake ? RETAKE : OTHER_DOCUMENT,
  };
}

/** The same fixes as a text to the Client; it points back to the page's link without repeating it. */
export function guidanceText({ title, fixes, closing }: Guidance): string {
  return `I checked your photo. ${title}:\n${fixes.map((f, i) => `${i + 1}. ${f}`).join("\n")}\n\n${closing} Same link.`;
}
