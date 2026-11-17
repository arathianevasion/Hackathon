/**
 * Finds the nesting a browser's HTML parser would rewrite (a <form> in a <p>,
 * a <tr> straight in a <table>, a link in a link), which is what turns server
 * HTML into a hydration mismatch. Reads React's own rendered markup, so it
 * handles only what React emits: no raw text elements, attributes escaped.
 */

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

/** Start tags that close an open <p> in the parser. */
const CLOSES_P = new Set([
  "address", "article", "aside", "blockquote", "details", "dialog", "div", "dl", "fieldset", "figcaption", "figure",
  "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hgroup", "hr", "li", "main", "menu", "nav", "ol",
  "p", "pre", "section", "summary", "table", "ul",
]);

const HEADING = /^h[1-6]$/;

/** Elements that may not appear inside themselves or each other. */
const INTERACTIVE = new Set(["a", "button", "select", "textarea", "label"]);

/** For table and list parts: the only parents the parser leaves them in. */
const ALLOWED_PARENTS: Record<string, string[]> = {
  li: ["ul", "ol", "menu"],
  thead: ["table"],
  tbody: ["table"],
  tfoot: ["table"],
  tr: ["thead", "tbody", "tfoot"],
  td: ["tr"],
  th: ["tr"],
};

/** Children a table-section element may hold; anything else (text included) is moved out by the parser. */
const TABLE_CHILDREN: Record<string, string[]> = {
  table: ["caption", "colgroup", "thead", "tbody", "tfoot"],
  thead: ["tr"],
  tbody: ["tr"],
  tfoot: ["tr"],
  tr: ["td", "th"],
};

/** Every place in the markup where the parser would not build the tree React rendered. */
export function nestingErrors(html: string): string[] {
  const errors: string[] = [];
  const open: string[] = [];
  const token = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|([^<]+)/g;
  for (const m of html.matchAll(token)) {
    const [, end, start, attrs, text] = m;
    const parent = open.at(-1);
    if (text !== undefined) {
      if (parent && TABLE_CHILDREN[parent] && text.trim() !== "") errors.push(`text inside <${parent}>`);
      continue;
    }
    if (end !== undefined) {
      const tag = end.toLowerCase();
      const at = open.lastIndexOf(tag);
      if (at !== -1) open.length = at;
      continue;
    }
    if (start === undefined) continue; // a comment
    const tag = start.toLowerCase();
    const hiddenInput = tag === "input" && /\btype="hidden"/.test(attrs);
    const problem = (inside: string) => errors.push(`<${tag}> inside <${inside}>`);
    if (CLOSES_P.has(tag) && open.includes("p")) problem("p");
    else if (tag === "form" && open.includes("form")) problem("form");
    else if (HEADING.test(tag) && open.some((o) => HEADING.test(o))) problem(open.findLast((o) => HEADING.test(o))!);
    else if ((INTERACTIVE.has(tag) || (tag === "input" && !hiddenInput)) && open.some((o) => o === "a" || o === "button")) {
      problem(open.findLast((o) => o === "a" || o === "button")!);
    } else if (ALLOWED_PARENTS[tag] && !ALLOWED_PARENTS[tag].includes(parent ?? "")) problem(parent ?? "the document");
    else if (parent && TABLE_CHILDREN[parent] && !TABLE_CHILDREN[parent].includes(tag)) problem(parent);
    if (!VOID.has(tag) && !attrs.trimEnd().endsWith("/")) open.push(tag);
  }
  return errors;
}
