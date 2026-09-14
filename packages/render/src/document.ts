/**
 * Renders a parsed {@link Document} to a standalone HTML string.
 *
 * - Inlines the house CSS in `<style>` so the output is self-contained.
 * - Wraps the body in `<div class="docskin">` so the CSS rules apply.
 * - Emits internal `themeVars` overrides (if any) as CSS variables on `:root`.
 * - Dark is the look. `colorScheme: 'light'` stamps `data-theme="light"` on
 *   `<html>`; `'system'` adds the media rule that lets the OS choose.
 *
 * The actual rendering is done by {@link renderDocumentParts} (in `parts.ts`);
 * this function just wraps those parts into a full HTML page. Embedding
 * consumers (e.g. a React app) should use `renderDocumentParts` directly.
 *
 * @example
 * ```ts
 * import { parseDocument } from 'chiltepin-core';
 * import { renderDocument } from 'chiltepin-render';
 *
 * const html = renderDocument(parseDocument(md, 'orders'));
 * ```
 */

import type { Document } from 'chiltepin-core';
import { FAVICON_LINK } from './brand.js';
import { escapeHtml } from './escape.js';
import { renderDocumentParts, type RenderPartsOptions } from './parts.js';
import { systemSchemeCss } from './css.js';

/** The `<html>` attribute and extra `<style>` a colour scheme needs. */
export function schemeMarkup(scheme: RenderPartsOptions['colorScheme']): { stamp: string; style: string } {
  if (scheme === 'light') return { stamp: ' data-theme="light"', style: '' };
  if (scheme === 'system') return { stamp: '', style: `<style>${systemSchemeCss}</style>` };
  return { stamp: '', style: '' };
}

/** Options for {@link renderDocument}. */
export type RenderOptions = RenderPartsOptions;

/**
 * Renders a document to a standalone HTML page.
 *
 * @param doc - The parsed Chiltepin document.
 * @param opts - Optional render options (internal variable overrides).
 * @returns A complete HTML string (`<!doctype html>…</html>`).
 */
export function renderDocument(doc: Document, opts: RenderOptions = {}): string {
  const parts = renderDocumentParts(doc, opts);
  const themeBlock =
    parts.themeVars.length > 0 ? `\n<style>:root{${parts.themeVars}}</style>` : '';
  const scheme = schemeMarkup(opts.colorScheme);
  return (
    `<!doctype html>\n` +
    `<html lang="en"${scheme.stamp}>\n` +
    `<head>\n` +
    `<meta charset="utf-8">\n` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">\n` +
    `<title>${escapeHtml(parts.title)}</title>\n` +
    `${FAVICON_LINK}\n` +
    `<style>${parts.css}</style>` +
    themeBlock +
    scheme.style +
    `\n</head>\n` +
    `<body>\n` +
    `<div class="docskin">\n` +
    parts.body +
    `</div>\n` +
    `</body>\n` +
    `</html>\n`
  );
}
