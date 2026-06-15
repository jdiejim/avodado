/**
 * Renders a pyramid diagram (top → bottom widening trapezoids).
 *
 * Ported from doc-studio.jsx `Pyramid`. Uses the shared CHART_COLORS palette.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';

const CHART_COLORS = ['#0e54a1', '#1a6dbe', '#0f766e', '#1f9747', '#6b21a8', '#f7952c'];

export function renderPyramid(data: BlockDataMap['pyramid']): string {
  const levels = data.levels ?? [];
  const n = Math.max(levels.length, 1);
  const W = 520;
  const top = 16;
  const rowH = Math.min(72, Math.floor(280 / n));
  const gap = 4;
  const apex = W / 2;
  const pad = 16;
  const maxW = 430;
  const H = top + n * (rowH + gap) + pad;

  const polygons = levels
    .map((L, i) => {
      const y = top + i * (rowH + gap);
      const wTop = maxW * (i / n);
      const wBot = maxW * ((i + 1) / n);
      const fill = CHART_COLORS[i % CHART_COLORS.length] ?? '#0e54a1';
      const desc =
        L.desc !== undefined
          ? `<text x="${apex}" y="${y + rowH / 2 + 14}" class="pyr-desc">${escapeHtml(L.desc)}</text>`
          : '';
      return (
        `<g>` +
        `<polygon points="${apex - wTop / 2},${y} ${apex + wTop / 2},${y} ${apex + wBot / 2},${y + rowH} ${apex - wBot / 2},${y + rowH}" fill="${fill}"/>` +
        `<text x="${apex}" y="${y + rowH / 2 - 1}" class="pyr-label">${escapeHtml(L.label)}</text>` +
        desc +
        `</g>`
      );
    })
    .join('');

  return `<svg viewBox="0 0 ${W} ${H}" role="img"><title>Pyramid</title>${polygons}</svg>`;
}
