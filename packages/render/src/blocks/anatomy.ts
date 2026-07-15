/**
 * Renders an `anatomy` block — the anatomy of a structured string (e.g. a
 * permission `app:feature:action`). The full string is shown with each segment
 * coloured, and below it a labelled card per segment explains each part.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';

type AnatomyData = BlockDataMap['anatomy'];

export function renderAnatomy(data: AnatomyData): string {
  const sep = data.separator ?? ':';
  const segs = data.parts
    .map((p, i) => {
      const tone = `a-seg-${(i % 4) + 1}`;
      const joiner = i > 0 ? `<span class="a-sep"${bp('separator')}>${escapeHtml(sep)}</span>` : '';
      return `${joiner}<span class="a-seg ${tone}"${bp(`parts.${i}.value`)}>${escapeHtml(p.value)}</span>`;
    })
    .join('');
  const cards = data.parts
    .map((p, i) => {
      const tone = `a-seg-${(i % 4) + 1}`;
      const note = p.note !== undefined ? `<div class="a-note"${bp(`parts.${i}.note`)}>${escapeHtml(p.note)}</div>` : '';
      return (
        `<div class="a-card"${bp(`parts.${i}`)}>` +
        `<div class="a-label ${tone}"${bp(`parts.${i}.label`)}>${escapeHtml(p.label)}</div>` +
        `<div class="a-value"${bp(`parts.${i}.value`)}>${escapeHtml(p.value)}</div>${note}</div>`
      );
    })
    .join(`<span class="a-card-sep"${bp('separator')}>` + escapeHtml(sep) + '</span>');
  const caption =
    data.title !== undefined ? `<div class="a-title">${escapeHtml(data.title)}</div>` : '';
  const desc =
    data.description !== undefined ? `<p class="a-desc">${escapeHtml(data.description)}</p>` : '';
  return `<div class="anatomy">${caption}${desc}<div class="a-string">${segs}</div><div class="a-cards"${bl('parts')}>${cards}</div></div>`;
}
