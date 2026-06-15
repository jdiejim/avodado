/**
 * Renders a `composition` block — effective access as the intersection of
 * layered gates: gate₁ ∩ gate₂ ∩ … = result. Each gate is a card; the gates
 * are joined by ∩ and resolve to a single highlighted result card.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';

type CompositionData = BlockDataMap['composition'];

export function renderComposition(data: CompositionData): string {
  const gates = data.gates
    .map((g, i) => {
      const op = i > 0 ? `<span class="cp-op">∩</span>` : '';
      const desc = g.desc !== undefined ? `<div class="cp-desc">${escapeHtml(g.desc)}</div>` : '';
      return `${op}<div class="cp-gate"><div class="cp-gate-label">${escapeHtml(g.label)}</div>${desc}</div>`;
    })
    .join('');
  const result =
    data.result !== undefined
      ? `<span class="cp-eq">=</span><div class="cp-result"><div class="cp-result-kicker">Effective</div><div class="cp-result-label">${escapeHtml(data.result)}</div></div>`
      : '';
  const caption =
    data.title !== undefined ? `<div class="cp-title">${escapeHtml(data.title)}</div>` : '';
  const desc =
    data.description !== undefined ? `<p class="cp-desc-top">${escapeHtml(data.description)}</p>` : '';
  return `<div class="composition">${caption}${desc}<div class="cp-row">${gates}${result}</div></div>`;
}
