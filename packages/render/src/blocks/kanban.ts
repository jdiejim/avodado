/**
 * Renders a kanban block. Doc-studio variant uses `columns: [{label, cards:
 * [{title, tag?}]}]` — flexible number of columns with structured cards.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';

export function renderKanban(data: BlockDataMap['kanban']): string {
  const cols = data.columns ?? [];
  let h = `<div class="kanban"${bl('columns')}>`;
  cols.forEach((col, ci) => {
    const cards = (col.cards ?? [])
      .map((c, k) => {
        const tag =
          c.tag !== undefined
            ? `<div class="kan-card-tag">${escapeHtml(c.tag)}</div>`
            : '';
        return (
          `<div class="kan-card"${bp(`columns.${ci}.cards.${k}`)}>` +
          `<div class="kan-card-title">${escapeHtml(c.title)}</div>` +
          tag +
          `</div>`
        );
      })
      .join('');
    // The column carries both its own item path AND the container path of its
    // cards list — one element, two roles (`data-bp` + `data-bl` may coexist).
    h +=
      `<div class="kan-col"${bp(`columns.${ci}`)}${bl(`columns.${ci}.cards`)}>` +
      `<div class="kan-head"${bp(`columns.${ci}.label`)}>${escapeHtml(col.label)}</div>` +
      cards +
      `</div>`;
  });
  return h + `</div>`;
}
