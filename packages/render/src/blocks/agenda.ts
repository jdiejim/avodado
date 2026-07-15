/**
 * Renders a meeting / event agenda — rows of `(time + duration)` paired with
 * `(title + owner + desc)`.
 *
 * Ported from doc-studio.jsx `Agenda`.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';

export function renderAgenda(data: BlockDataMap['agenda']): string {
  const items = data.items ?? [];
  const rows = items
    .map((it, i) => {
      const dur =
        it.duration !== undefined
          ? `<div class="agenda-dur"${bp(`items.${i}.duration`)}>${escapeHtml(it.duration)}</div>`
          : '';
      const owner =
        it.owner !== undefined
          ? `<span class="agenda-owner"${bp(`items.${i}.owner`)}>${escapeHtml(it.owner)}</span>`
          : '';
      const desc =
        it.desc !== undefined
          ? `<div class="agenda-desc"${bp(`items.${i}.desc`)}>${escapeHtml(it.desc)}</div>`
          : '';
      const time =
        it.time !== undefined
          ? `<div class="agenda-time"${bp(`items.${i}.time`)}>${escapeHtml(it.time)}</div>`
          : '';
      // The title shares its line with the owner chip, so the title text gets
      // an inert span of its own to carry the path.
      return (
        `<div class="agenda-row"${bp(`items.${i}`)}>` +
        `<div>${time}${dur}</div>` +
        `<div>` +
        `<div class="agenda-title"><span${bp(`items.${i}.title`)}>${escapeHtml(it.title)}</span>${owner}</div>` +
        desc +
        `</div>` +
        `</div>`
      );
    })
    .join('');
  return `<div class="agenda"${bl('items')}>${rows}</div>`;
}
