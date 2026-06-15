/**
 * Renders a pyramid diagram (top → bottom widening bands). The apex is a flat
 * trapezoid (not a zero-width point) so even the top band fits its label;
 * labels wrap to the band width and colors follow the active theme.
 *
 * Ported from doc-studio.jsx `Pyramid`.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { wrapText } from '../svg/wrapText.js';

const PALETTE = [
  'var(--navy)',
  'var(--blue)',
  'var(--teal)',
  'var(--positive)',
  'var(--purple)',
  'var(--highlight)',
];

export function renderPyramid(data: BlockDataMap['pyramid']): string {
  const levels = data.levels ?? [];
  const n = Math.max(levels.length, 1);
  const W = 560;
  const top = 16;
  const rowH = Math.min(78, Math.floor(300 / n));
  const gap = 4;
  const apex = W / 2;
  const pad = 16;
  const maxW = 470;
  const minTop = 120; // flat apex width, so the top band has room for text
  const H = top + n * (rowH + gap) + pad;

  const wAt = (k: number): number => minTop + (maxW - minTop) * (k / n);

  const polygons = levels
    .map((L, i) => {
      const y = top + i * (rowH + gap);
      const wTop = wAt(i);
      const wBot = wAt(i + 1);
      const fill = PALETTE[i % PALETTE.length] ?? 'var(--navy)';
      const hasDesc = L.desc !== undefined;
      const maxChars = Math.max(8, Math.floor((Math.min(wTop, wBot) - 18) / 6.6));
      const lines = wrapText(L.label, maxChars, hasDesc ? 1 : 2);
      const labelY = y + rowH / 2 - (lines.length - 1) * 7 + (hasDesc ? -4 : 0);
      const labelEls = lines
        .map(
          (ln, j) =>
            `<text x="${apex}" y="${labelY + j * 14}" class="pyr-label">${escapeHtml(ln)}</text>`,
        )
        .join('');
      const desc = hasDesc
        ? `<text x="${apex}" y="${y + rowH / 2 + 14}" class="pyr-desc">${escapeHtml(L.desc ?? '')}</text>`
        : '';
      return (
        `<g>` +
        `<polygon points="${apex - wTop / 2},${y} ${apex + wTop / 2},${y} ${apex + wBot / 2},${y + rowH} ${apex - wBot / 2},${y + rowH}" fill="${fill}"/>` +
        labelEls +
        desc +
        `</g>`
      );
    })
    .join('');

  return `<svg viewBox="0 0 ${W} ${H}" role="img"><title>Pyramid</title>${polygons}</svg>`;
}
