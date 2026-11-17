import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CheckingPanel } from "./UploadPage";

describe("CheckingPanel", () => {
  const html = renderToStaticMarkup(<CheckingPanel />);

  it("keeps the status text unchanged and puts a decorative spinner beside the title", () => {
    expect(html).toContain('role="status"');
    expect(html).toContain("Checking your document…");
    expect(html).toContain("This takes a few seconds. You&#x27;ll get a text with the result.");
    expect(html).toMatch(/<span class="spinner" aria-hidden="true"><\/span>/);
  });

  it("styles the spinner in the accent colour, and swaps the spin for a static indicator under reduced motion", () => {
    const css = readFileSync("app/globals.css", "utf8");
    expect(css).toMatch(/\.spinner\s*\{[^}]*var\(--accent\)[^}]*animation:/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\.spinner\s*\{[^}]*animation:\s*none/);
  });
});
