import { z } from "zod";

/** How often a pay stub's pay recurs; used to annualize it (check 6). */
export const PAY_FREQUENCIES = ["weekly", "biweekly", "semimonthly", "monthly"] as const;

/**
 * The fields the vision model extracts from a Document (spec: document type,
 * name, SSN, amounts, pay period or tax year, dates, employer, legible or
 * cropped). Field names only: the schema carries no personal data.
 */
export const extractedFieldsSchema = z.object({
  documentType: z.string().nullable().describe('What the document is, e.g. "pay stub", "W-2", "Social Security card"'),
  name: z.string().nullable().describe("The person's full name as printed"),
  ssn: z.string().nullable().describe("The Social Security number as printed"),
  pay: z
    .object({ amount: z.number(), frequency: z.enum(PAY_FREQUENCIES) })
    .nullable()
    .describe("Gross pay for one pay period, and how often it is paid"),
  annualIncome: z.number().nullable().describe("Yearly income shown, for tax forms and benefit letters"),
  payPeriodStart: z.string().nullable().describe("YYYY-MM-DD"),
  payPeriodEnd: z.string().nullable().describe("YYYY-MM-DD"),
  payDate: z.string().nullable().describe("Pay date or letter date, YYYY-MM-DD"),
  taxYear: z.number().nullable(),
  employer: z.string().nullable(),
  legible: z.boolean(),
  cropped: z.boolean(),
});

export type ExtractedFields = z.infer<typeof extractedFieldsSchema>;
