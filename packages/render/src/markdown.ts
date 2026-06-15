/**
 * Renders a prose segment to HTML via `marked`.
 *
 * Hardened for untrusted input (the renderer's output is shown in the
 * playground and hosted previews, which render documents from strangers):
 *
 * - Raw HTML is **not** passed through — `marked` v14 emits raw HTML by
 *   default, which is an XSS vector. We decline the block `html` and inline
 *   `tag` tokenizers so any literal `<tag>` falls through to text and is
 *   entity-escaped. This also matches Avodado's house rule: express structure
 *   through blocks, never raw HTML.
 * - Link / image hrefs with `javascript:`, `data:`, or `vbscript:` schemes are
 *   rewritten to `#` (see {@link safeUrl}).
 *
 * Output is deterministic (no auto heading ids, no smartypants).
 */

import { Marked, type Tokens } from 'marked';
import { safeUrl } from './sanitize.js';

const marked = new Marked({ gfm: true, breaks: false });

marked.use({
  tokenizer: {
    // Decline raw HTML at both block and inline level; the text falls through
    // to the paragraph/text tokenizer, which escapes it.
    html(): undefined {
      return undefined;
    },
    tag(): undefined {
      return undefined;
    },
  },
  renderer: {
    link(token: Tokens.Link): string {
      const href = safeUrl(token.href);
      const title = token.title !== null && token.title !== undefined ? ` title="${token.title}"` : '';
      const text = this.parser.parseInline(token.tokens);
      return `<a href="${href}"${title}>${text}</a>`;
    },
    image(token: Tokens.Image): string {
      const href = safeUrl(token.href);
      const title = token.title !== null && token.title !== undefined ? ` title="${token.title}"` : '';
      return `<img src="${href}" alt="${token.text}"${title}>`;
    },
  },
});

/**
 * Renders Markdown prose to an HTML string wrapped in `<div class="prose">`.
 *
 * @param text - The Markdown source.
 * @returns The HTML output, wrapped in a `prose` div for styling scope.
 */
export function renderProse(text: string): string {
  const html = marked.parse(text, { async: false });
  return `<div class="prose">${html}</div>`;
}
