/**
 * Renders a `typescale` block — a live type specimen. One hairline-separated
 * row per item: a fixed meta column (name, `NNpx / weight NNN` in mono, an
 * optional note) and the sample text rendered LIVE at the item's size, weight,
 * line-height, and font family. The rendered size clamps to 10-64px so giant
 * display sizes stay in the row (the label keeps the true size); rows are
 * overflow-hidden with an ellipsis so nothing wraps ugly.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';

type TypescaleData = BlockDataMap['typescale'];
type TypescaleItem = TypescaleData['items'][number];

/** Default specimen text when the block gives none. */
const DEFAULT_SAMPLE = 'The quick brown fox jumps over the lazy dog';

/** Font-family class per `font` value (default body). */
const FONT_CLASS: Record<'display' | 'body' | 'mono', string> = {
  display: 'ts-f-display',
  body: 'ts-f-body',
  mono: 'ts-f-mono',
};

/** Formats a number for CSS / labels, trimming float noise. */
function fmt(v: number): string {
  return String(Math.round(v * 100) / 100);
}

function renderRow(item: TypescaleItem, sample: string): string {
  const weight = item.weight ?? 400;
  const lineHeight = item.lineHeight ?? 1.3;
  const rendered = Math.min(64, Math.max(10, item.size));
  const fontClass = FONT_CLASS[item.font ?? 'body'];
  const note = item.note !== undefined ? `<div class="ts-note">${escapeHtml(item.note)}</div>` : '';
  const style = `font-size:${fmt(rendered)}px;font-weight:${fmt(weight)};line-height:${fmt(lineHeight)}`;
  return (
    `<div class="ts-row">` +
    `<div class="ts-meta">` +
    `<div class="ts-name">${escapeHtml(item.name)}</div>` +
    `<div class="ts-spec">${escapeHtml(`${fmt(item.size)}px / weight ${fmt(weight)}`)}</div>` +
    note +
    `</div>` +
    `<div class="ts-sample ${fontClass}" style="${style}">${escapeHtml(sample)}</div>` +
    `</div>`
  );
}

export function renderTypescale(data: TypescaleData): string {
  const head =
    data.title !== undefined ? `<div class="ts-head">${escapeHtml(data.title)}</div>` : '';
  const desc =
    data.description !== undefined
      ? `<p class="ts-desc">${escapeHtml(data.description)}</p>`
      : '';
  const sample = data.sample ?? DEFAULT_SAMPLE;
  const rows = data.items.map((item) => renderRow(item, sample)).join('');
  return `<div class="typescale">${head}${desc}<div class="ts-rows">${rows}</div></div>`;
}
