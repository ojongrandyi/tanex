// Product descriptions (docs/SHOP_SPEC.md §7.2): the same TipTap JSON → sanitised HTML pipeline as
// blog posts (server/blog/render.ts), limited to headings, paragraphs, bold, italic, links and
// lists. Anything else (a table or image pasted from elsewhere) is unwrapped to its text or dropped
// before rendering, so the shop never shows blog-only blocks.
import { parseDoc, renderDoc, type PMNode } from '../blog/render.js';

const BLOCKS = new Set(['doc', 'paragraph', 'heading', 'bulletList', 'orderedList', 'listItem', 'text', 'hardBreak']);
const MARKS = new Set(['bold', 'italic', 'link']);
/** Leaves with nothing worth keeping. */
const DROP = new Set(['image', 'figure', 'horizontalRule']);

/** Max length of a description's JSON (the blog allows 1 MB; a product needs far less). */
export const MAX_DESCRIPTION_JSON = 100_000;

function clean(node: PMNode): PMNode[] {
  if (DROP.has(node.type)) return [];
  const content = (node.content ?? []).flatMap(clean);
  if (!BLOCKS.has(node.type)) {
    // Unwrap: keep the children (callout, blockquote, table cells…); text inside a code block
    // becomes a paragraph.
    if (node.type === 'codeBlock') return content.length ? [{ type: 'paragraph', content }] : [];
    return content;
  }
  const out: PMNode = { type: node.type };
  if (node.type === 'heading') {
    const level = Number(node.attrs?.level);
    out.attrs = { level: level === 3 || level === 4 ? level : 2 };
  }
  if (node.attrs && node.type === 'orderedList') out.attrs = { start: node.attrs.start ?? 1 };
  if (node.type === 'text') {
    out.text = node.text ?? '';
    const marks = (node.marks ?? []).filter((m) => MARKS.has(m.type));
    if (marks.length) out.marks = marks;
  }
  if (content.length) out.content = content;
  // A list item or list must keep block children; wrap stray text in a paragraph.
  if ((node.type === 'listItem' || node.type === 'doc') && out.content?.some((c) => c.type === 'text')) {
    out.content = [{ type: 'paragraph', content: out.content }];
  }
  return [out];
}

export type DescriptionCheck =
  | { ok: true; json: string | null; html: string | null }
  | { ok: false; error: string };

/** null/empty → no description. Otherwise checks, trims to the allowed blocks and renders. */
export function readDescription(input: unknown): DescriptionCheck {
  if (input === null || input === undefined || input === '') return { ok: true, json: null, html: null };
  if (typeof input === 'string' && input.length > MAX_DESCRIPTION_JSON) return { ok: false, error: 'The description is too long.' };
  const parsed = parseDoc(input);
  if (!parsed.ok) return { ok: false, error: 'The description is not valid.' };
  const [doc] = clean(parsed.doc);
  const json = JSON.stringify(doc ?? { type: 'doc', content: [] });
  if (json.length > MAX_DESCRIPTION_JSON) return { ok: false, error: 'The description is too long.' };
  const rendered = renderDoc(doc ?? { type: 'doc', content: [] });
  const empty = rendered.text.trim() === '';
  return { ok: true, json: empty ? null : json, html: empty ? null : rendered.html };
}
