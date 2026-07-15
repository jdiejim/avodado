/**
 * Renders a timeline block. Doc-studio variant uses `label` (not `title`),
 * `date` (not `when`), `desc` (not `detail`), and status enum
 * `done | current | next | future` (where `current` is the in-flight item).
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';

export function renderTimeline(data: BlockDataMap['timeline']): string {
  const items = data.items ?? [];
  let h = `<div class="tl"${bl('items')}>`;
  items.forEach((it, i) => {
    const st = it.status ?? 'future';
    const date =
      it.date !== undefined ? `<div class="tl-date"${bp(`items.${i}.date`)}>${escapeHtml(it.date)}</div>` : '';
    const desc =
      it.desc !== undefined ? `<div class="tl-desc"${bp(`items.${i}.desc`)}>${escapeHtml(it.desc)}</div>` : '';
    h +=
      `<div class="tl-item"${bp(`items.${i}`)}>` +
      `<span class="tl-dot ${st}"></span>` +
      date +
      `<div class="tl-label"${bp(`items.${i}.label`)}>${escapeHtml(it.label)}</div>` +
      desc +
      `</div>`;
  });
  return h + `</div>`;
}
