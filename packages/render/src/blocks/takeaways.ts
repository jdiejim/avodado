/**
 * Renders a `takeaways` block — the closing slide of a good deck: 2-6
 * numbered rows at presentation scale, each a circled number (accent border,
 * mono) beside a bold display one-liner with an optional detail line beneath.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';

export function renderTakeaways(data: BlockDataMap['takeaways']): string {
  const accentCls = data.accent !== undefined ? ` tk-${data.accent}` : '';
  const title = escapeHtml(data.title ?? 'Takeaways');
  const rows = data.items
    .map((item, i) => {
      const detail =
        item.detail !== undefined
          ? `<p class="tk-detail">${escapeHtml(item.detail)}</p>`
          : '';
      return (
        `<li class="tk-item">` +
        `<span class="tk-num" aria-hidden="true">${i + 1}</span>` +
        `<div class="tk-body"><div class="tk-text">${escapeHtml(item.text)}</div>${detail}</div>` +
        `</li>`
      );
    })
    .join('');
  return `<div class="tk${accentCls}"><div class="tk-title">${title}</div><ol class="tk-list">${rows}</ol></div>`;
}
