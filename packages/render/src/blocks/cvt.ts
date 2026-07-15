/**
 * Renders a current-vs-target block — two side-by-side panels separated by an
 * arrow, optionally captioned.
 *
 * Ported from doc-studio.jsx `CurrentTarget`.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';

export function renderCvt(data: BlockDataMap['cvt']): string {
  const cur = data.current ?? {};
  const tgt = data.target ?? {};
  const curItems = (cur.items ?? [])
    .map((x, i) => `<div class="ct-item"${bp(`current.items.${i}`)}>${escapeHtml(x)}</div>`)
    .join('');
  const tgtItems = (tgt.items ?? [])
    .map((x, i) => `<div class="ct-item"${bp(`target.items.${i}`)}>${escapeHtml(x)}</div>`)
    .join('');
  const curLabel = cur.label ?? 'Current';
  const tgtLabel = tgt.label ?? 'Target';
  const note =
    data.note !== undefined ? `<div class="tbl-note"${bp('note')}>${escapeHtml(data.note)}</div>` : '';
  // Each panel is both its object's element and its items' list container.
  return (
    `<div>` +
    `<div class="ct">` +
    `<div class="ct-panel cur"${bp('current')}${bl('current.items')}>` +
    `<div class="ct-label"${bp('current.label')}>${escapeHtml(curLabel)}</div>` +
    curItems +
    `</div>` +
    `<div class="ct-arrow">&rarr;</div>` +
    `<div class="ct-panel tgt"${bp('target')}${bl('target.items')}>` +
    `<div class="ct-label"${bp('target.label')}>${escapeHtml(tgtLabel)}</div>` +
    tgtItems +
    `</div>` +
    `</div>` +
    note +
    `</div>`
  );
}
