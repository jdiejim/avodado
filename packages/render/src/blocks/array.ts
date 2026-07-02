/**
 * Renders an `array` block — a row of array cells for algorithm walkthroughs
 * (binary search, two pointers, sliding windows), in pure SVG inside the
 * diagram frame (tag ARRAY).
 *
 * 44px square cells with hairline borders; indices above (when `showIndex`,
 * default true); pointer `label`s below their cell with a small ▲ tick; an
 * optional `window` draws a rounded navy-dashed outline around an inclusive
 * 0-based index range (out-of-bounds values clamp).
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { dsTone } from '../svg/dsTone.js';
import { diagramFrame } from './frame.js';

type ArrayData = BlockDataMap['array'];

const CELL = 44;
const PAD_X = 8;

/** Truncates a cell value so it fits a 44px cell at 13px mono. */
function fit(v: string): string {
  return v.length > 5 ? `${v.slice(0, 4)}…` : v;
}

export function renderArray(data: ArrayData): string {
  const items = data.items ?? [];
  const showIndex = data.showIndex ?? true;
  const n = items.length;
  const hasLabels = items.some((it) => it.label !== undefined && it.label.length > 0);
  const window = n > 0 && data.window !== undefined ? data.window : undefined;

  // Vertical layout: [window label] [indices] [cells] [pointer ticks + labels].
  const winPad = window !== undefined ? 20 : 0;
  const idxH = showIndex ? 16 : 0;
  const cellsY = 6 + winPad + idxH;
  const labelH = hasLabels ? 26 : 0;
  const height = cellsY + CELL + labelH + 8;
  const width = PAD_X * 2 + Math.max(n, 1) * CELL;

  let s = `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img"><title>Array</title>`;

  if (n === 0) {
    s += `<text x="${PAD_X}" y="${cellsY + 26}" class="ds-empty">(empty)</text></svg>`;
    return frame(data, s);
  }

  const xOf = (i: number): number => PAD_X + i * CELL;

  // Cells (+ indices above).
  items.forEach((it, i) => {
    const t = dsTone(it.tone);
    const x = xOf(i);
    if (showIndex) {
      s += `<text x="${x + CELL / 2}" y="${cellsY - 5}" class="ds-idx">${i}</text>`;
    }
    s += `<rect x="${x}" y="${cellsY}" width="${CELL}" height="${CELL}" fill="${t.fill}" stroke="${t.stroke}" stroke-width="1"/>`;
    s += `<text x="${x + CELL / 2}" y="${cellsY + CELL / 2 + 5}" class="ds-val" fill="${t.text}">${escapeHtml(fit(it.value))}</text>`;
  });

  // Pointer labels below their cell, with a small ▲ tick pointing at it.
  items.forEach((it, i) => {
    if (it.label === undefined || it.label.length === 0) return;
    const cx = xOf(i) + CELL / 2;
    const baseY = cellsY + CELL;
    s += `<path d="M${cx - 4},${baseY + 9} L${cx},${baseY + 3} L${cx + 4},${baseY + 9} z" fill="var(--navy)"/>`;
    s += `<text x="${cx}" y="${baseY + 20}" class="ds-ptr">${escapeHtml(it.label)}</text>`;
  });

  // Window outline (clamped to the index range) + its label above-right.
  if (window !== undefined) {
    const lo = Math.max(0, Math.min(n - 1, Math.min(window.from, window.to)));
    const hi = Math.max(0, Math.min(n - 1, Math.max(window.from, window.to)));
    const wx = xOf(lo) - 3;
    const ww = (hi - lo + 1) * CELL + 6;
    s += `<rect x="${wx}" y="${cellsY - 3}" width="${ww}" height="${CELL + 6}" rx="6" class="ds-window"/>`;
    if (window.label !== undefined && window.label.length > 0) {
      s += `<text x="${wx + ww}" y="${cellsY - idxH - 6}" text-anchor="end" class="ds-window-label">${escapeHtml(window.label)}</text>`;
    }
  }

  s += `</svg>`;
  return frame(data, s);
}

function frame(data: ArrayData, inner: string): string {
  return diagramFrame(
    {
      tag: 'ARRAY',
      tagBg: '#374151',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
    },
    inner,
  );
}
