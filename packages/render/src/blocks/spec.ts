/**
 * Renders a `spec` block — a labelled spec sheet: a left-accented card whose
 * rows are `label → value`, where the value is text or an inline step-flow
 * (rendered as arrow-joined pills). Good for "GROUPS / ROLES / RESOLUTION /
 * COST" style summaries of an approach.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';

type SpecRow = NonNullable<BlockDataMap['spec']['rows']>[number];

// A row renders as two sibling grid cells (label + val) with no per-row
// wrapper, so there is no element to carry a `rows.N` item path — the label
// and value cells carry the leaf paths instead.
function renderRow(row: SpecRow, i: number): string {
  let value: string;
  let valPath = bp(`rows.${i}.value`);
  if (row.steps !== undefined && row.steps.length > 0) {
    const pills = row.steps
      .map((s, j) => `<span class="sp-step"${bp(`rows.${i}.steps.${j}`)}>${escapeHtml(s)}</span>`)
      .join('<span class="sp-arrow">&rarr;</span>');
    value = `<div class="sp-flow"${bl(`rows.${i}.steps`)}>${pills}</div>`;
    valPath = '';
  } else {
    value = escapeHtml(row.value ?? '');
  }
  return `<div class="sp-label"${bp(`rows.${i}.label`)}>${escapeHtml(row.label)}</div><div class="sp-val"${valPath}>${value}</div>`;
}

export function renderSpec(data: BlockDataMap['spec']): string {
  const rows = data.rows ?? [];
  const accent = data.accent !== undefined ? ` sp-${data.accent}` : '';
  const caption = data.title !== undefined ? `<div class="sp-head">${escapeHtml(data.title)}</div>` : '';
  const desc = data.description !== undefined ? `<p class="sp-desc">${escapeHtml(data.description)}</p>` : '';
  return `<div class="spec">${caption}${desc}<div class="sp-grid${accent}"${bl('rows')}>${rows.map((row, i) => renderRow(row, i)).join('')}</div></div>`;
}
