/**
 * Renders a structured `prose` block — a sequence of typed sub-blocks
 * (heading, paragraph, ul, ol, quote). Useful when the author wants explicit
 * structure instead of raw markdown.
 *
 * Ported from doc-studio.jsx `Prose`.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';

export function renderProseBlock(data: BlockDataMap['prose']): string {
  const blocks = data.blocks ?? [];
  const html = blocks
    .map((b) => {
      const t = (b.type ?? 'p').toLowerCase();
      const text = b.text ?? '';
      if (t === 'h') return `<h3>${escapeHtml(text)}</h3>`;
      if (t === 'quote') return `<blockquote>${escapeHtml(text)}</blockquote>`;
      if (t === 'ul') {
        const items = (b.items ?? []).map((x) => `<li>${escapeHtml(x)}</li>`).join('');
        return `<ul>${items}</ul>`;
      }
      if (t === 'ol') {
        const items = (b.items ?? []).map((x) => `<li>${escapeHtml(x)}</li>`).join('');
        return `<ol>${items}</ol>`;
      }
      return `<p>${escapeHtml(text)}</p>`;
    })
    .join('');
  return `<div class="prose">${html}</div>`;
}
