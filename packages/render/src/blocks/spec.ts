/**
 * Renders a `spec` block — a labelled spec sheet: a left-accented card whose
 * rows are `label → value`, where the value is text or an inline step-flow
 * (rendered as arrow-joined pills). Good for "GROUPS / ROLES / RESOLUTION /
 * COST" style summaries of an approach.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';

type SpecRow = NonNullable<BlockDataMap['spec']['rows']>[number];

function renderRow(row: SpecRow): string {
  let value: string;
  if (row.steps !== undefined && row.steps.length > 0) {
    const pills = row.steps
      .map((s) => `<span class="sp-step">${escapeHtml(s)}</span>`)
      .join('<span class="sp-arrow">&rarr;</span>');
    value = `<div class="sp-flow">${pills}</div>`;
  } else {
    value = escapeHtml(row.value ?? '');
  }
  return `<div class="sp-label">${escapeHtml(row.label)}</div><div class="sp-val">${value}</div>`;
}

export function renderSpec(data: BlockDataMap['spec']): string {
  const rows = data.rows ?? [];
  const accent = data.accent !== undefined ? ` sp-${data.accent}` : '';
  const caption = data.title !== undefined ? `<div class="sp-head">${escapeHtml(data.title)}</div>` : '';
  const desc = data.description !== undefined ? `<p class="sp-desc">${escapeHtml(data.description)}</p>` : '';
  return `<div class="spec">${caption}${desc}<div class="sp-grid${accent}">${rows.map(renderRow).join('')}</div></div>`;
}
