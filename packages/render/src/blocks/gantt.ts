/**
 * Renders a Gantt chart — period columns across the top, task rows with
 * horizontal bars colored by kind (done / active / milestone / default).
 *
 * Ported from doc-studio.jsx `Gantt` + `ganttColor`.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';

function ganttColor(kind: string | undefined): string {
  switch ((kind ?? '').toLowerCase()) {
    case 'done':
      return '#1f9747';
    case 'active':
    case 'current':
      return '#f7952c';
    case 'milestone':
      return '#6b21a8';
    default:
      return '#0e54a1';
  }
}

export function renderGantt(data: BlockDataMap['gantt']): string {
  const periods = data.periods ?? [];
  const tasks = data.tasks ?? [];
  const P = Math.max(periods.length, 1);
  const labelW = 156;
  const padX = 20;
  const padTop = 34;
  const rowH = 30;
  const barH = 18;
  const colW = 64;
  const padBot = 14;
  const width = labelW + padX * 2 + P * colW;
  const height = padTop + tasks.length * rowH + padBot;
  const xCol = (i: number): number => labelW + padX + i * colW;

  let s = `<svg viewBox="0 0 ${width} ${height}" role="img"><title>Schedule</title>`;
  for (let i = 0; i < periods.length; i++) {
    s +=
      `<g>` +
      `<line x1="${xCol(i)}" y1="${padTop - 6}" x2="${xCol(i)}" y2="${height - padBot}" stroke="#eef0f3" stroke-width="1"/>` +
      `<text x="${xCol(i) + colW / 2}" y="${padTop - 12}" class="gantt-head">${escapeHtml(periods[i] ?? '')}</text>` +
      `</g>`;
  }
  s += `<line x1="${xCol(P)}" y1="${padTop - 6}" x2="${xCol(P)}" y2="${height - padBot}" stroke="#eef0f3" stroke-width="1"/>`;
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    if (t === undefined) continue;
    const y = padTop + i * rowH;
    const bx = xCol(t.start ?? 0);
    const span = Math.max(1, t.span ?? 1);
    const bw = span * colW - 8;
    s +=
      `<g>` +
      `<text x="${padX}" y="${y + rowH / 2 + 4}" class="gantt-label">${escapeHtml(t.label)}</text>` +
      `<rect x="${bx + 4}" y="${y + (rowH - barH) / 2}" width="${bw}" height="${barH}" rx="4" fill="${ganttColor(t.kind)}" filter="url(#gshadow)"/>` +
      `</g>`;
  }
  s += `</svg>`;
  return s;
}
