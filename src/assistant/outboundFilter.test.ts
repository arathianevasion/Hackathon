import { describe, expect, it } from "vitest";
import { screenOutbound } from "./outboundFilter";

const LINK = "https://portal.example/r/7Q2KX4MPRT";
const issued = [LINK];

describe("screenOutbound", () => {
  it("passes the first text with its Portal link", () => {
    const text = `Hi Rosa, I'm your AI Client Advocate, working with your insurance agent, Andrew. The Marketplace needs proof of your income by Nov 26. Everything you need is here: ${LINK}\nReply with any questions. Reply STOP to opt out.`;
    expect(screenOutbound(text, issued)).toEqual({ ok: true });
  });

  it("passes an SSN already masked to the last 4", () => {
    expect(screenOutbound("The card ending •••-••-4471 is on file.", issued)).toEqual({ ok: true });
  });

  it.each([
    ["dashed", "Is your number 123-45-6789?"],
    ["spaced", "Is your number 123 45 6789?"],
    ["run together", "Is your number 123456789?"],
  ])("blocks an SSN-like number (%s)", (_, text) => {
    expect(screenOutbound(text, issued)).toEqual({ ok: false, blocked: ["ssn_like_number"] });
  });

  it.each([
    ["dollar sign", "Your application says $42,000 a year."],
    ["dollar sign, no comma", "Your stub shows $1850."],
    ["thousands separator", "Your application says 42,000 a year."],
    ["k shorthand", "Your application says 42k a year."],
    ["dollars spelled out", "Your application says 42000 dollars."],
    ["a monthly rate", "Your stub shows 1850 a month."],
    ["a rate per year", "That is 42000 per year."],
    ["a slash rate", "That is 1850/mo."],
  ])("blocks an income amount (%s)", (_, text) => {
    expect(screenOutbound(text, issued)).toEqual({ ok: false, blocked: ["income_amount"] });
  });

  it.each([
    ["another site", "See https://example.com/help"],
    ["no scheme", "See healthcare.gov for more."],
    ["www", "See www.example.org"],
    ["look-alike portal path", "Upload here: https://portal.example/upload"],
    ["portal link never issued", "Upload here: https://portal.example/r/AAAAAAAAAA"],
    ["portal host with a suffix", "Upload here: https://portal.example.evil.test/r/7Q2KX4MPRT"],
  ])("blocks a link that is not an issued Portal link (%s)", (_, text) => {
    expect(screenOutbound(text, issued)).toEqual({ ok: false, blocked: ["non_portal_link"] });
  });

  it("names every rule a text breaks", () => {
    expect(screenOutbound("123-45-6789 earns $40,000, see https://example.com", issued)).toEqual({
      ok: false,
      blocked: ["ssn_like_number", "income_amount", "non_portal_link"],
    });
  });
});
