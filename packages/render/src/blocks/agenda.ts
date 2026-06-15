/**
 * Renders a meeting / event agenda — rows of `(time + duration)` paired with
 * `(title + owner + desc)`.
 *
 * Ported from doc-studio.jsx `Agenda`.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';

export function renderAgenda(data: BlockDataMap['agenda']): string {
  const items = data.items ?? [];
  const rows = items
    .map((it) => {
      const dur =
        it.duration !== undefined
          ? `<div class="agenda-dur">${escapeHtml(it.duration)}</div>`
          : '';
      const owner =
        it.owner !== undefined
          ? `<span class="agenda-owner">${escapeHtml(it.owner)}</span>`
          : '';
      const desc =
        it.desc !== undefined ? `<div class="agenda-desc">${escapeHtml(it.desc)}</div>` : '';
      const time =
        it.time !== undefined ? `<div class="agenda-time">${escapeHtml(it.time)}</div>` : '';
      return (
        `<div class="agenda-row">` +
        `<div>${time}${dur}</div>` +
        `<div>` +
        `<div class="agenda-title">${escapeHtml(it.title)}${owner}</div>` +
        desc +
        `</div>` +
        `</div>`
      );
    })
    .join('');
  return `<div class="agenda">${rows}</div>`;
}
