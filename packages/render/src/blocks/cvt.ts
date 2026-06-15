/**
 * Renders a current-vs-target block — two side-by-side panels separated by an
 * arrow, optionally captioned.
 *
 * Ported from doc-studio.jsx `CurrentTarget`.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';

export function renderCvt(data: BlockDataMap['cvt']): string {
  const cur = data.current ?? {};
  const tgt = data.target ?? {};
  const curItems = (cur.items ?? [])
    .map((x) => `<div class="ct-item">${escapeHtml(x)}</div>`)
    .join('');
  const tgtItems = (tgt.items ?? [])
    .map((x) => `<div class="ct-item">${escapeHtml(x)}</div>`)
    .join('');
  const curLabel = cur.label ?? 'Current';
  const tgtLabel = tgt.label ?? 'Target';
  const note =
    data.note !== undefined ? `<div class="tbl-note">${escapeHtml(data.note)}</div>` : '';
  return (
    `<div>` +
    `<div class="ct">` +
    `<div class="ct-panel cur">` +
    `<div class="ct-label">${escapeHtml(curLabel)}</div>` +
    curItems +
    `</div>` +
    `<div class="ct-arrow">&rarr;</div>` +
    `<div class="ct-panel tgt">` +
    `<div class="ct-label">${escapeHtml(tgtLabel)}</div>` +
    tgtItems +
    `</div>` +
    `</div>` +
    note +
    `</div>`
  );
}
