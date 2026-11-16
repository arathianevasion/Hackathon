/** Why the outbound filter stopped a text. */
export type BlockedReason = "ssn_like_number" | "income_amount" | "non_portal_link";

export type Screening = { ok: true } | { ok: false; blocked: BlockedReason[] };

/** Nine digits shaped like an SSN: 123-45-6789, 123 45 6789 or 123456789. */
const SSN_LIKE = /(?<![\d-])\d{3}[- ]?\d{2}[- ]?\d{4}(?![\d-])/;

/** A money amount: $1850, 42,000, 42k, 42000 dollars, or a rate such as 1850 a month or 1850/mo. */
const INCOME_AMOUNTS = [
  /\$\s?\d/,
  /\b\d{1,3}(?:,\d{3})+\b/,
  /\b\d+(?:\.\d+)?\s?k\b/i,
  /\b\d[\d,.]*\s?(?:dollars|usd)\b/i,
  /\b\d[\d,.]*\s?(?:an?|per|\/)\s?(?:hour|hr|week|wk|month|mo|year|yr|paycheck)\b/i,
];

/** Anything a phone would turn into a link: a scheme, www., or a bare domain. */
const LINK_LIKE = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}\b(?:\/\S*)?/gi;

/**
 * The outbound filter `send_text` runs on every text (ADR 0001): no SSN-like
 * numbers, no income amounts, and no links except this Client's Portal links
 * that are still open (`openLinks`, exact urls).
 */
export function screenOutbound(text: string, openLinks: readonly string[]): Screening {
  const blocked: BlockedReason[] = [];
  if (SSN_LIKE.test(text)) blocked.push("ssn_like_number");
  if (INCOME_AMOUNTS.some((pattern) => pattern.test(text))) blocked.push("income_amount");
  const links = text.match(LINK_LIKE) ?? [];
  if (links.some((link) => !openLinks.includes(stripTrailingPunctuation(link)))) blocked.push("non_portal_link");
  return blocked.length === 0 ? { ok: true } : { ok: false, blocked };
}

function stripTrailingPunctuation(link: string): string {
  return link.replace(/[.,;:!?)\]]+$/, "");
}
