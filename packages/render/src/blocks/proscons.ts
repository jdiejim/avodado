/**
 * Renders a pros-vs-cons block — two columns of bullet items with
 * positive / negative styling.
 *
 * Ported from doc-studio.jsx `ProsCons`.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';

export function renderProsCons(data: BlockDataMap['proscons']): string {
  const prosLabel = data.prosLabel ?? 'Pros';
  const consLabel = data.consLabel ?? 'Cons';
  const pros = (data.pros ?? [])
    .map((p, i) => `<div class="pc-item"${bp(`pros.${i}`)}>${escapeHtml(p)}</div>`)
    .join('');
  const cons = (data.cons ?? [])
    .map((c, i) => `<div class="pc-item"${bp(`cons.${i}`)}>${escapeHtml(c)}</div>`)
    .join('');
  return (
    `<div class="pc">` +
    `<div class="pc-col pro"${bl('pros')}>` +
    `<div class="pc-head"${bp('prosLabel')}>${escapeHtml(prosLabel)}</div>` +
    pros +
    `</div>` +
    `<div class="pc-col con"${bl('cons')}>` +
    `<div class="pc-head"${bp('consLabel')}>${escapeHtml(consLabel)}</div>` +
    cons +
    `</div>` +
    `</div>`
  );
}
