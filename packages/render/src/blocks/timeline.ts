/**
 * Renders a timeline block. Doc-studio variant uses `label` (not `title`),
 * `date` (not `when`), `desc` (not `detail`), and status enum
 * `done | current | next | future` (where `current` is the in-flight item).
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';

export function renderTimeline(data: BlockDataMap['timeline']): string {
  const items = data.items ?? [];
  let h = `<div class="tl">`;
  for (const it of items) {
    const st = it.status ?? 'future';
    const date =
      it.date !== undefined ? `<div class="tl-date">${escapeHtml(it.date)}</div>` : '';
    const desc =
      it.desc !== undefined ? `<div class="tl-desc">${escapeHtml(it.desc)}</div>` : '';
    h +=
      `<div class="tl-item">` +
      `<span class="tl-dot ${st}"></span>` +
      date +
      `<div class="tl-label">${escapeHtml(it.label)}</div>` +
      desc +
      `</div>`;
  }
  return h + `</div>`;
}
