/**
 * Renders a row of KPI / stat cards with optional delta + trend arrow.
 *
 * Ported from doc-studio.jsx `StatCards`.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { safeColor } from '../sanitize.js';

const TREND_GLYPH = { up: '▲', down: '▼', flat: '—' } as const;

export function renderStats(data: BlockDataMap['stats']): string {
  const stats = data.stats ?? [];
  const cards = stats
    .map((s) => {
      const accent =
        s.accent !== undefined
          ? ` style="border-top-color:${safeColor(s.accent, '#0e54a1')}"`
          : '';
      const delta =
        s.delta !== undefined
          ? `<div class="stat-delta ${s.trend ?? 'flat'}">${TREND_GLYPH[s.trend ?? 'flat']} ${escapeHtml(s.delta)}</div>`
          : '';
      return (
        `<div class="stat-card"${accent}>` +
        `<div class="stat-value">${escapeHtml(s.value)}</div>` +
        `<div class="stat-label">${escapeHtml(s.label)}</div>` +
        delta +
        `</div>`
      );
    })
    .join('');
  return `<div class="stat-row">${cards}</div>`;
}
