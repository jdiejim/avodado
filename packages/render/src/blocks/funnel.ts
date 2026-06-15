/**
 * Renders a funnel chart — stacked trapezoids that narrow from top to bottom
 * with absolute values and computed conversion percentages. Labels wrap to fit
 * the band width; colors follow the active theme.
 *
 * Ported from doc-studio.jsx `Funnel`.
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

function toNum(v: string | number): number {
  if (typeof v === 'number') return v;
  const n = parseFloat(v.replace(/[, _]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function fmt(v: string | number): string {
  return typeof v === 'number' ? v.toLocaleString() : v;
}

export function renderFunnel(data: BlockDataMap['funnel']): string {
  const stages = (data.stages ?? []).filter(Boolean);
  const W = 600;
  const top = 14;
  const rowH = 70;
  const maxW = 460;
  const pad = 14;
  const cx = W / 2;
  const H = top + stages.length * rowH + pad;

  const vals = stages.map((s) => toNum(s.value));
  const first = vals[0] ?? 0;
  const max = Math.max(1, ...vals);
  const wOf = (v: number): number => Math.max(180, maxW * (v / max)); // wide enough for labels

  const groups = stages
    .map((s, i) => {
      const v = vals[i] ?? 0;
      const vNext = i < stages.length - 1 ? (vals[i + 1] ?? 0) : v * 0.82;
      const wTop = wOf(v);
      const wBot = wOf(vNext);
      const y = top + i * rowH;
      const fill = PALETTE[i % PALETTE.length] ?? 'var(--navy)';
      const pct = first > 0 ? Math.round((v / first) * 100) : 0;
      const sub = i > 0 && first > 0 ? `  ·  ${pct}%` : '';

      const maxChars = Math.max(8, Math.floor((Math.min(wTop, wBot) - 20) / 6.6));
      const lines = wrapText(s.label, maxChars, 2);
      const labelY = y + rowH / 2 - (lines.length - 1) * 7 - 3;
      const labelEls = lines
        .map(
          (ln, j) =>
            `<text x="${cx}" y="${labelY + j * 14}" class="funnel-label">${escapeHtml(ln)}</text>`,
        )
        .join('');
      const valY = y + rowH / 2 + (lines.length - 1) * 7 + 14;
      return (
        `<g>` +
        `<polygon points="${cx - wTop / 2},${y} ${cx + wTop / 2},${y} ${cx + wBot / 2},${y + rowH} ${cx - wBot / 2},${y + rowH}" fill="${fill}" stroke="var(--white)" stroke-width="2"/>` +
        labelEls +
        `<text x="${cx}" y="${valY}" class="funnel-val">${escapeHtml(fmt(s.value))}${sub}</text>` +
        `</g>`
      );
    })
    .join('');

  return `<svg viewBox="0 0 ${W} ${H}" role="img"><title>Funnel</title>${groups}</svg>`;
}
