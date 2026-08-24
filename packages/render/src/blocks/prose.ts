/**
 * Renders a structured `prose` block — a sequence of typed sub-blocks
 * (heading, paragraph, ul, ol, quote). Useful when the author wants explicit
 * structure instead of raw markdown. Text fields render as inline Markdown
 * (bold, `code`, links) through the hardened {@link renderInlineMd} pipeline,
 * matching callout/pullquote; block structure stays fixed.
 *
 * Ported from doc-studio.jsx `Prose`.
 */

import type { BlockDataMap } from '@avodado/core';
import { renderInlineMd } from '../markdown.js';
import { bl, bp } from '../paths.js';

export function renderProseBlock(data: BlockDataMap['prose']): string {
  const blocks = data.blocks ?? [];
  const html = blocks
    .map((b, i) => {
      const t = (b.type ?? 'p').toLowerCase();
      const text = b.text ?? '';
      if (t === 'h') return `<h3${bp(`blocks.${i}`)}>${renderInlineMd(text)}</h3>`;
      if (t === 'quote')
        return `<blockquote${bp(`blocks.${i}`)}>${renderInlineMd(text)}</blockquote>`;
      if (t === 'ul') {
        const items = (b.items ?? [])
          .map((x, j) => `<li${bp(`blocks.${i}.items.${j}`)}>${renderInlineMd(x)}</li>`)
          .join('');
        return `<ul${bp(`blocks.${i}`)}${bl(`blocks.${i}.items`)}>${items}</ul>`;
      }
      if (t === 'ol') {
        const items = (b.items ?? [])
          .map((x, j) => `<li${bp(`blocks.${i}.items.${j}`)}>${renderInlineMd(x)}</li>`)
          .join('');
        return `<ol${bp(`blocks.${i}`)}${bl(`blocks.${i}.items`)}>${items}</ol>`;
      }
      return `<p${bp(`blocks.${i}`)}>${renderInlineMd(text)}</p>`;
    })
    .join('');
  return `<div class="prose"${bl('blocks')}>${html}</div>`;
}
