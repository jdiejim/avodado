/**
 * Renders one or more code blocks, each with a header (filename / language)
 * and a syntax-highlighted body.
 *
 * Ported from doc-studio.jsx `CodeBlock` (iterated for multiple snippets).
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { highlightCode } from '../highlight.js';

export function renderCode(data: BlockDataMap['code']): string {
  const blocks = data.blocks ?? [];
  return blocks
    .map(
      (b) =>
        `<div class="code-block">` +
        `<div class="code-header">` +
        `<span>${escapeHtml(b.title ?? '')}</span>` +
        `<span>${escapeHtml(b.lang ?? '')}</span>` +
        `</div>` +
        `<pre>${highlightCode(b.code)}</pre>` +
        `</div>`,
    )
    .join('');
}
