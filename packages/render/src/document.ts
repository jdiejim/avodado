/**
 * Renders a parsed {@link Document} to a standalone HTML string.
 *
 * - Inlines the house CSS in `<style>` so the output is self-contained.
 * - Wraps the body in `<div class="docskin">` so the CSS rules apply.
 * - Applies an optional theme by setting CSS variables on `:root`.
 *
 * The actual rendering is done by {@link renderDocumentParts} (in `parts.ts`);
 * this function just wraps those parts into a full HTML page. Embedding
 * consumers (e.g. a React app) should use `renderDocumentParts` directly.
 *
 * @example
 * ```ts
 * import { parseDocument } from '@avodado/core';
 * import { renderDocument } from '@avodado/render';
 *
 * const html = renderDocument(parseDocument(md, 'orders'), { theme: 'teal' });
 * ```
 */

import type { Document } from '@avodado/core';
import { escapeHtml } from './escape.js';
import { renderDocumentParts, type RenderPartsOptions } from './parts.js';

/** Options for {@link renderDocument}. */
export type RenderOptions = RenderPartsOptions;

/**
 * Renders a document to a standalone HTML page.
 *
 * @param doc - The parsed Avodado document.
 * @param opts - Optional render options (theme).
 * @returns A complete HTML string (`<!doctype html>…</html>`).
 */
export function renderDocument(doc: Document, opts: RenderOptions = {}): string {
  const parts = renderDocumentParts(doc, opts);
  const themeBlock =
    parts.themeVars.length > 0 ? `\n<style>:root{${parts.themeVars}}</style>` : '';
  return (
    `<!doctype html>\n` +
    `<html lang="en">\n` +
    `<head>\n` +
    `<meta charset="utf-8">\n` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">\n` +
    `<title>${escapeHtml(parts.title)}</title>\n` +
    `<style>${parts.css}</style>` +
    themeBlock +
    `\n</head>\n` +
    `<body>\n` +
    `<div class="docskin">\n` +
    parts.body +
    `</div>\n` +
    `</body>\n` +
    `</html>\n`
  );
}
