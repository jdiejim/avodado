/**
 * Renders a `heatmap` block — a numeric grid with an intensity ramp, in pure
 * HTML (a CSS grid). Row labels sit left (right-aligned), column labels on
 * top (mono gray); each cell is a rounded tile tinted on a single-hue ramp
 * from #eef3f9 (low) to #0e54a1 (high) by normalized value, with the value
 * centered in mono — switching to white when the tile is dark. Short rows pad
 * missing cells as blank tiles. A slim legend row beneath shows min → max.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';

type HeatmapData = BlockDataMap['heatmap'];

/** Ramp endpoints: low → high (single blue hue). */
const LOW: readonly [number, number, number] = [0xee, 0xf3, 0xf9];
const HIGH: readonly [number, number, number] = [0x0e, 0x54, 0xa1];

/** Linear-interpolates the ramp at t (0..1) to a hex colour. */
function rampAt(t: number): string {
  const hex = (i: number): string => {
    const lo = LOW[i] ?? 0;
    const hi = HIGH[i] ?? 0;
    return Math.round(lo + (hi - lo) * t)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${hex(0)}${hex(1)}${hex(2)}`;
}

/** Formats a value trimming float noise. */
function fmt(v: number): string {
  return String(Math.round(v * 100) / 100);
}

export function renderHeatmap(data: HeatmapData): string {
  const cols = data.xLabels;
  const rows = data.rows;
  const values = rows.flatMap((r) => r.values.slice(0, cols.length)).filter((v) => Number.isFinite(v));
  const dataMin = values.length > 0 ? Math.min(...values) : 0;
  const dataMax = values.length > 0 ? Math.max(...values) : 1;
  const min = data.min ?? dataMin;
  const max = data.max ?? dataMax;
  const range = max - min;
  const norm = (v: number): number => {
    if (range <= 0) return 0.5;
    return Math.min(1, Math.max(0, (v - min) / range));
  };

  const head =
    data.title !== undefined ? `<div class="hm-head">${escapeHtml(data.title)}</div>` : '';
  const desc =
    data.description !== undefined
      ? `<p class="hm-desc">${escapeHtml(data.description)}</p>`
      : '';

  let grid = `<div class="hm-corner"></div>`;
  grid += cols.map((c) => `<div class="hm-col">${escapeHtml(c)}</div>`).join('');
  for (const row of rows) {
    grid += `<div class="hm-rowlabel">${escapeHtml(row.label)}</div>`;
    for (let i = 0; i < cols.length; i++) {
      const v = row.values[i];
      if (v === undefined || !Number.isFinite(v)) {
        grid += `<div class="hm-cell hm-blank"></div>`;
        continue;
      }
      const t = norm(v);
      const dark = t > 0.55 ? ' hm-dark' : '';
      const title = data.unit !== undefined ? ` title="${escapeHtml(`${fmt(v)} ${data.unit}`)}"` : '';
      grid += `<div class="hm-cell${dark}" style="background:${rampAt(t)}"${title}>${escapeHtml(fmt(v))}</div>`;
    }
  }

  const unitSuffix = data.unit !== undefined ? ` ${data.unit}` : '';
  const legend =
    `<div class="hm-legend">` +
    `<span class="hm-bound">${escapeHtml(fmt(min) + unitSuffix)}</span>` +
    `<span class="hm-ramp"></span>` +
    `<span class="hm-bound">${escapeHtml(fmt(max) + unitSuffix)}</span>` +
    `</div>`;

  return (
    `<div class="heatmap">${head}${desc}` +
    `<div class="hm-scroll">` +
    `<div class="hm-grid" style="grid-template-columns:auto repeat(${cols.length},minmax(44px,1fr))">${grid}</div>` +
    legend +
    `</div>` +
    `</div>`
  );
}
