/**
 * Renders a pros-vs-cons block — two columns of bullet items with
 * positive / negative styling.
 *
 * Ported from doc-studio.jsx `ProsCons`.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';

export function renderProsCons(data: BlockDataMap['proscons']): string {
  const prosLabel = data.prosLabel ?? 'Pros';
  const consLabel = data.consLabel ?? 'Cons';
  const pros = (data.pros ?? []).map((p) => `<div class="pc-item">${escapeHtml(p)}</div>`).join('');
  const cons = (data.cons ?? []).map((c) => `<div class="pc-item">${escapeHtml(c)}</div>`).join('');
  return (
    `<div class="pc">` +
    `<div class="pc-col pro">` +
    `<div class="pc-head">${escapeHtml(prosLabel)}</div>` +
    pros +
    `</div>` +
    `<div class="pc-col con">` +
    `<div class="pc-head">${escapeHtml(consLabel)}</div>` +
    cons +
    `</div>` +
    `</div>`
  );
}
