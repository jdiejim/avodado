/**
 * Renders a timeline block. Doc-studio variant uses `label` (not `title`),
 * `date` (not `when`), `desc` (not `detail`), and status enum
 * `done | current | next | future` (where `current` is the in-flight item).
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { renderLegend, type LegendItem, type LegendSwatch } from '../svg/legend.js';
import { revealAttr } from '../svg/reveal.js';

/** The dot encoding per status, mirrored by the legend swatch (DESIGN.md chips). */
const STATUS_SWATCH: Record<string, LegendSwatch> = {
  done: 'node-fill2',
  current: 'node-accent',
  next: 'node-dashed',
  future: 'node-dashed',
};

export function renderTimeline(data: BlockDataMap['timeline']): string {
  const items = data.items ?? [];
  const present: string[] = [];
  let h = `<div class="tl"${bl('items')}>`;
  items.forEach((it, i) => {
    const st = it.status ?? 'future';
    if (!present.includes(st)) present.push(st);
    const date =
      it.date !== undefined ? `<div class="tl-date"${bp(`items.${i}.date`)}>${escapeHtml(it.date)}</div>` : '';
    const desc =
      it.desc !== undefined ? `<div class="tl-desc"${bp(`items.${i}.desc`)}>${escapeHtml(it.desc)}</div>` : '';
    // The status as a word chip beside the dot, so meaning is never colour alone.
    const chip = `<span class="tl-status tl-s-${st}"${it.status !== undefined ? bp(`items.${i}.status`) : ''}>${escapeHtml(st)}</span>`;
    h +=
      `<div class="tl-item"${bp(`items.${i}`)}${revealAttr(i)}>` +
      `<span class="tl-dot ${st}"></span>` +
      `<div class="tl-head">${date}${chip}</div>` +
      `<div class="tl-label"${bp(`items.${i}.label`)}>${escapeHtml(it.label)}</div>` +
      desc +
      `</div>`;
  });
  const legendItems: LegendItem[] = present.map((st) => ({
    swatch: STATUS_SWATCH[st] ?? 'node-dashed',
    label: st,
  }));
  return h + `</div>` + renderLegend(legendItems);
}
