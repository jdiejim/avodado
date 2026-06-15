/**
 * Renders a funnel chart — stacked trapezoids that narrow from top to bottom
 * with absolute values and computed conversion percentages.
 *
 * Ported from doc-studio.jsx `Funnel`.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';

const CHART_COLORS = ['#0e54a1', '#1a6dbe', '#0f766e', '#1f9747', '#6b21a8', '#f7952c'];

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
  const W = 560;
  const top = 14;
  const rowH = 62;
  const maxW = 420;
  const pad = 14;
  const cx = W / 2;
  const H = top + stages.length * rowH + pad;

  const vals = stages.map((s) => toNum(s.value));
  const first = vals[0] ?? 0;
  const max = Math.max(1, ...vals);
  const wOf = (v: number): number => Math.max(78, maxW * (v / max));

  const groups = stages
    .map((s, i) => {
      const v = vals[i] ?? 0;
      const vNext = i < stages.length - 1 ? (vals[i + 1] ?? 0) : v * 0.82;
      const wTop = wOf(v);
      const wBot = wOf(vNext);
      const y = top + i * rowH;
      const fill = CHART_COLORS[i % CHART_COLORS.length] ?? '#0e54a1';
      const pct = first > 0 ? Math.round((v / first) * 100) : 0;
      const sub = i > 0 && first > 0 ? `  ·  ${pct}%` : '';
      return (
        `<g>` +
        `<polygon points="${cx - wTop / 2},${y} ${cx + wTop / 2},${y} ${cx + wBot / 2},${y + rowH} ${cx - wBot / 2},${y + rowH}" fill="${fill}" stroke="#fff" stroke-width="2"/>` +
        `<text x="${cx}" y="${y + rowH / 2 - 3}" class="funnel-label">${escapeHtml(s.label)}</text>` +
        `<text x="${cx}" y="${y + rowH / 2 + 15}" class="funnel-val">${escapeHtml(fmt(s.value))}${sub}</text>` +
        `</g>`
      );
    })
    .join('');

  return `<svg viewBox="0 0 ${W} ${H}" role="img"><title>Funnel</title>${groups}</svg>`;
}
