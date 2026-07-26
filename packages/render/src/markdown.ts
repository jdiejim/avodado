import { readSourceMarker, stripHeadingMarkers } from '@avodado/core';
import { escapeHtml } from './escape.js';
/**
 * Renders a prose segment to HTML via `marked`.
 *
 * Hardened for untrusted input (the renderer's output is shown in hosted
 * previews and the browser-side studio, which render documents from strangers):
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
    heading(token: Tokens.Heading): string {
      // Heading markers (`{split}`, `{top}`, `{source: …}`) address the slide,
      // not the text — a page strips them. The source is the exception: the
      // author wrote provenance, so the page prints it under the heading, the
      // way the deck prints it in the slide footer.
      const raw = this.parser.parseInline(token.tokens);
      if (token.depth > 2) return `<h${token.depth}>${raw}</h${token.depth}>\n`;
      const text = stripHeadingMarkers(raw);
      const src = readSourceMarker(raw);
      const note =
        src !== undefined ? `<p class="src-note">Source: ${escapeHtml(src)}</p>\n` : '';
      return `<h${token.depth}>${text}</h${token.depth}>\n${note}`;
    },
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

/**
 * Renders a text-first field (callout body, pullquote text) as INLINE
 * Markdown — bold/italic/`code`/links work, block constructs don't. Blank
 * lines become paragraph breaks. Same hardened pipeline as {@link renderProse}
 * (raw HTML declined, hrefs sanitized).
 */
export function renderInlineMd(text: string): string {
  const paras = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p !== '');
  const inline = (p: string): string => marked.parseInline(p, { async: false });
  if (paras.length <= 1) return inline(paras[0] ?? '');
  return paras.map((p) => `<p>${inline(p)}</p>`).join('');
}
