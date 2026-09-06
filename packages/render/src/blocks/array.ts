/**
 * Renders an `array` block — a row of array cells for algorithm walkthroughs
 * (binary search, two pointers, sliding windows), in pure SVG inside the
 * diagram frame (tag ARRAY).
 *
 * 44px square cells; indices above (when `showIndex`, default true); pointer
 * `label`s below their cell with a small ▲ tick; an optional `window` draws a
 * dashed ink outline around an inclusive 0-based index range (out-of-bounds
 * values clamp). Cell tones follow `svg/dsTone.ts`: paper cells with an ink
 * outline, `active` / `target` on the accent, `visited` on `paper-2`, `muted`
 * as a dashed ghost — and the legend names the tones in play.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { DS_TONE_LEGEND, dsTone, dsToneAttrs, type DsTone } from '../svg/dsTone.js';
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
    s += `<text x="${PAD_X}" y="${cellsY + 26}" class="t-sub c-soft">(empty)</text></svg>`;
    return frame(data, s, '');
  }

  const xOf = (i: number): number => PAD_X + i * CELL;

  // Cells (+ indices above).
  const tones = new Set<DsTone>();
  let plain = false;
  s += `<g${bl('items')}>`;
  items.forEach((it, i) => {
    const t = dsTone(it.tone);
    if (it.tone !== undefined) tones.add(it.tone);
    else plain = true;
    const x = xOf(i);
    s += `<g${bp(`items.${i}`)}>`;
    if (showIndex) {
      s += `<text x="${x + CELL / 2}" y="${cellsY - 5}" class="t-sub c-soft" text-anchor="middle">${i}</text>`;
    }
    s += `<rect x="${x}" y="${cellsY}" width="${CELL}" height="${CELL}"${dsToneAttrs(t)}/>`;
    s += `<text x="${x + CELL / 2}" y="${cellsY + CELL / 2 + 5}" class="ds-val" fill="${t.text}"${bp(`items.${i}.value`)}>${escapeHtml(fit(it.value))}</text>`;
    s += `</g>`;
  });
  s += `</g>`; // close the items list container

  // Pointer labels below their cell, with a small ▲ tick pointing at it.
  items.forEach((it, i) => {
    if (it.label === undefined || it.label.length === 0) return;
    const cx = xOf(i) + CELL / 2;
    const baseY = cellsY + CELL;
    s += `<g${bp(`items.${i}.label`)}>`;
    s += `<path d="M${cx - 4},${baseY + 9} L${cx},${baseY + 3} L${cx + 4},${baseY + 9} z" fill="var(--ink)"/>`;
    s += `<text x="${cx}" y="${baseY + 20}" class="t-badge c-ink" text-anchor="middle">${escapeHtml(it.label)}</text>`;
    s += `</g>`;
  });

  // Window outline (clamped to the index range) + its label above-right.
  if (window !== undefined) {
    const lo = Math.max(0, Math.min(n - 1, Math.min(window.from, window.to)));
    const hi = Math.max(0, Math.min(n - 1, Math.max(window.from, window.to)));
    const wx = xOf(lo) - 3;
    const ww = (hi - lo + 1) * CELL + 6;
    s += `<rect x="${wx}" y="${cellsY - 3}" width="${ww}" height="${CELL + 6}" rx="4" fill="none" stroke="var(--ink)" stroke-width="1.25" stroke-dasharray="4 3"${bp('window')}/>`;
    if (window.label !== undefined && window.label.length > 0) {
      s += `<text x="${wx + ww}" y="${cellsY - idxH - 6}" text-anchor="end" class="t-eyebrow"${bp('window.label')}>${escapeHtml(window.label)}</text>`;
    }
  }

  s += `</svg>`;
  return frame(data, s, dsLegend(plain, tones, window !== undefined));
}

/** The legend: the plain cell, every tone present, and the window outline. */
function dsLegend(plain: boolean, tones: ReadonlySet<DsTone>, hasWindow: boolean): string {
  const items: LegendItem[] = [];
  if (plain) items.push({ swatch: 'node', label: 'cell' });
  for (const tone of ['active', 'target', 'visited', 'muted'] as const) {
    if (tones.has(tone)) items.push(DS_TONE_LEGEND[tone]);
  }
  if (hasWindow) items.push({ swatch: 'chip', chip: '[ ]', label: 'window' });
  return renderLegend(items);
}

function frame(data: ArrayData, inner: string, legendHtml: string): string {
  return diagramFrame(
    {
      tag: 'ARRAY',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legendHtml.length > 0 ? { legendHtml } : {}),
    },
    inner,
  );
}
