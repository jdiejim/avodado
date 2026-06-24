/**
 * Renders a kanban block. Doc-studio variant uses `columns: [{label, cards:
 * [{title, tag?}]}]` — flexible number of columns with structured cards.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';

export function renderKanban(data: BlockDataMap['kanban']): string {
  const cols = data.columns ?? [];
  let h = `<div class="kanban">`;
  for (const col of cols) {
    const cards = (col.cards ?? [])
      .map((c) => {
        const tag =
          c.tag !== undefined
            ? `<div class="kan-card-tag">${escapeHtml(c.tag)}</div>`
            : '';
        return (
          `<div class="kan-card">` +
          `<div class="kan-card-title">${escapeHtml(c.title)}</div>` +
          tag +
          `</div>`
        );
      })
      .join('');
    h +=
      `<div class="kan-col">` +
      `<div class="kan-head">${escapeHtml(col.label)}</div>` +
      cards +
      `</div>`;
  }
  return h + `</div>`;
}
