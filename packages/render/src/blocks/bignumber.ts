/**
 * Renders a `bignumber` block — one hero metric at presentation scale: the
 * value in display type (accent-colored), an optional delta with a neutral
 * trend arrow beside it, a bold one-line claim, and an optional context line.
 *
 * The trend arrow is deliberately gray: for a bignumber "down" is often good
 * (latency, cost), so the arrow only shows direction — the delta text takes
 * the accent color instead.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';

const TREND_GLYPH = { up: '▲', down: '▼', flat: '—' } as const;

export function renderBignumber(data: BlockDataMap['bignumber']): string {
  const accentCls = data.accent !== undefined ? ` bn-${data.accent}` : '';
  const arrow =
    data.trend !== undefined
      ? `<span class="bn-arrow" aria-hidden="true">${TREND_GLYPH[data.trend]}</span>`
      : '';
  const delta =
    data.delta !== undefined
      ? `<span class="bn-delta">${arrow}${escapeHtml(data.delta)}</span>`
      : '';
  const context =
    data.context !== undefined
      ? `<p class="bn-context">${escapeHtml(data.context)}</p>`
      : '';
  return (
    `<div class="bn${accentCls}">` +
    `<div class="bn-value-row"><span class="bn-value">${escapeHtml(data.value)}</span>${delta}</div>` +
    `<div class="bn-label">${escapeHtml(data.label)}</div>` +
    context +
    `</div>`
  );
}
