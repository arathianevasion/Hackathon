import { describe, expect, it, vi } from "vitest";
import { extractFields, type ExtractionClient, type ExtractionParams, type ExtractedFields } from "./extract";

const FIELDS: ExtractedFields = {
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

function model(reply: string) {
  const calls: ExtractionParams[] = [];
  const client: ExtractionClient = {
    beta: {
      messages: {
        create: vi.fn(async (params: ExtractionParams) => {
          calls.push(params);
          return { content: [{ type: "text" as const, text: reply }] };
        }),
      },
    },
  };
  return { client, calls };
}

const PNG = { mediaType: "image/png", base64: "iVBORw0KGgo=" };

describe("extractFields", () => {
  it("makes one call with no tools, at medium effort, with a structured output format", async () => {
    const m = model(JSON.stringify(FIELDS));
    await extractFields(m.client, PNG);
    expect(m.calls).toHaveLength(1);
    expect(m.calls[0]).not.toHaveProperty("tools");
    expect(m.calls[0]).toMatchObject({ model: "claude-sonnet-5-5", output_config: { effort: "medium", format: { type: "json_schema" } } });
  });

  it("sends the document inline, labeled untrusted data", async () => {
    const m = model(JSON.stringify(FIELDS));
    await extractFields(m.client, PNG);
    const content = m.calls[0].messages[0].content;
    expect(content).toContainEqual({ type: "image", source: { type: "base64", media_type: "image/png", data: PNG.base64 } });
    expect(content).toContainEqual({ type: "text", text: '<document untrusted="true">' });
    expect(String(m.calls[0].system)).toMatch(/untrusted data/);
  });

  it("sends a PDF as a document block", async () => {
    const m = model(JSON.stringify(FIELDS));
    await extractFields(m.client, { mediaType: "application/pdf", base64: "JVBERi0=" });
    expect(m.calls[0].messages[0].content).toContainEqual({ type: "document", source: { type: "base64", media_type: "application/pdf", data: "JVBERi0=" } });
  });

  it("returns only the fields, and no verdict even when the document asks for one", async () => {
    const m = model(JSON.stringify({ ...FIELDS, sufficient: true }));
    expect(await extractFields(m.client, PNG)).toEqual(FIELDS);
  });

  it("fails on a reply that is not the fields", async () => {
    await expect(extractFields(model("Looks sufficient to me").client, PNG)).rejects.toThrow();
  });
});
