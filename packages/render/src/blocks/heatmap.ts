/**
 * Renders a `heatmap` block — a numeric grid with an intensity ramp, in pure
 * HTML (a CSS grid). Row labels sit left (right-aligned), column labels on
 * top; each cell is a tile on a five-step single-hue ramp from `paper-2`
 * (low) to `ink` (high) by normalized value, with the value centered in mono.
 * The ramp is the skin's own neutral scale (`paper-2` → `rule-solid` → `soft`
 * → `muted` → `ink`), so it retints with the theme; cell text switches to
 * `paper` from the third step up, decided by the step index rather than by
 * measuring the colour. Short rows pad missing cells as blank tiles. The
 * legend under the grid names the value range each step covers.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';

type HeatmapData = BlockDataMap['heatmap'];

/** The ramp, low → high, and the step from which text on the tile is `paper`. */
const RAMP = ['var(--paper-2)', 'var(--rule-solid)', 'var(--soft)', 'var(--muted)', 'var(--ink)'] as const;
const DARK_FROM = 2;

/** The ramp step (0..4) for a normalized value. */
function stepAt(t: number): number {
  return Math.min(RAMP.length - 1, Math.max(0, Math.floor(t * RAMP.length)));
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

  const used = new Set<number>();
  let grid = `<div class="hm-corner"></div>`;
  grid += cols.map((c, i) => `<div class="hm-col t-eyebrow"${bp(`xLabels.${i}`)}>${escapeHtml(c)}</div>`).join('');
  rows.forEach((row, ri) => {
    grid += `<div class="hm-rowlabel t-name"${bp(`rows.${ri}.label`)}>${escapeHtml(row.label)}</div>`;
    for (let i = 0; i < cols.length; i++) {
      const v = row.values[i];
      if (v === undefined || !Number.isFinite(v)) {
        grid += `<div class="hm-cell hm-blank" style="background:var(--paper)"></div>`;
        continue;
      }
      const step = stepAt(norm(v));
      used.add(step);
      const text = step >= DARK_FROM ? 'var(--paper)' : 'var(--ink)';
      const title = data.unit !== undefined ? ` title="${escapeHtml(`${fmt(v)} ${data.unit}`)}"` : '';
      grid += `<div class="hm-cell" style="background:${RAMP[step]};color:${text}"${title}${bp(`rows.${ri}.values.${i}`)}>${escapeHtml(fmt(v))}</div>`;
    }
  });

  // The legend names the value range of every step the grid actually used.
  const unitSuffix = data.unit !== undefined ? ` ${data.unit}` : '';
  const items: LegendItem[] = [...used]
    .sort((a, b) => a - b)
    .map((step) => {
      const lo = min + (range * step) / RAMP.length;
      const hi = step === RAMP.length - 1 ? max : min + (range * (step + 1)) / RAMP.length;
      const label = range <= 0 ? `${fmt(min)}${unitSuffix}` : `${fmt(lo)}–${fmt(hi)}${unitSuffix}`;
      return { swatch: 'fill', fill: RAMP[step] ?? RAMP[0], label };
    });
  const legend = renderLegend(items);

  return (
    `<div class="heatmap">${head}${desc}` +
    `<div class="hm-scroll">` +
    `<div class="hm-grid" style="grid-template-columns:auto repeat(${cols.length},minmax(44px,1fr))"${bl('rows')}>${grid}</div>` +
    legend +
    `</div>` +
    `</div>`
  );
}
