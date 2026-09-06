/**
 * Renders a `heatmap` block — a numeric grid with an intensity ramp, in pure
 * HTML (a CSS grid). Row labels sit left (right-aligned), column labels on
 * top; each cell is a tile on the skin's one-hue ink ramp (`paper-2` →
 * `ink-3` → `ink-2` → `ink`) by normalized value, a literal zero on plain
 * `paper`, with the value centered in mono. Cell text switches to `paper`
 * from the third step up, decided by the step index rather than by measuring
 * the colour. Short rows pad missing cells as blank tiles. Renders inside the
 * diagram frame (tag HEATMAP); the legend names the value range each step
 * covers.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { diagramFrame } from './frame.js';

type HeatmapData = BlockDataMap['heatmap'];

/** The one-hue ramp, low → high (the ink-tone tokens), and the step from which text on the tile is `paper`. */
const RAMP = ['var(--paper-2)', 'var(--ink-3)', 'var(--ink-2)', 'var(--ink)'] as const;
const DARK_FROM = 2;
/** A hairline edge on every tile — the lowest step is the frame's own ground. */
const EDGE = 'box-shadow:inset 0 0 0 1px var(--rule-solid)';

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

  const used = new Set<number>();
  let zero = false;
  let grid = `<div class="hm-corner"></div>`;
  grid += cols.map((c, i) => `<div class="hm-col t-eyebrow"${bp(`xLabels.${i}`)}>${escapeHtml(c)}</div>`).join('');
  rows.forEach((row, ri) => {
    grid += `<div class="hm-rowlabel t-name"${bp(`rows.${ri}.label`)}>${escapeHtml(row.label)}</div>`;
    for (let i = 0; i < cols.length; i++) {
      const v = row.values[i];
      if (v === undefined || !Number.isFinite(v)) {
        grid += `<div class="hm-cell hm-blank" style="background:var(--paper);${EDGE}"></div>`;
        continue;
      }
      const title = data.unit !== undefined ? ` title="${escapeHtml(`${fmt(v)} ${data.unit}`)}"` : '';
      if (v === 0) {
        zero = true;
        grid += `<div class="hm-cell" style="background:var(--paper);color:var(--ink);${EDGE}"${title}${bp(`rows.${ri}.values.${i}`)}>0</div>`;
        continue;
      }
      const step = stepAt(norm(v));
      used.add(step);
      const text = step >= DARK_FROM ? 'var(--paper)' : 'var(--ink)';
      grid += `<div class="hm-cell" style="background:${RAMP[step]};color:${text};${EDGE}"${title}${bp(`rows.${ri}.values.${i}`)}>${escapeHtml(fmt(v))}</div>`;
    }
  });

  // The legend names the value range of every step the grid actually used.
  const unitSuffix = data.unit !== undefined ? ` ${data.unit}` : '';
  const items: LegendItem[] = [...used]
    .sort((a, b) => a - b)
    .map((step) => {
      const lo = min + (range * step) / RAMP.length;
      const hi = step === RAMP.length - 1 ? max : min + (range * (step + 1)) / RAMP.length;
      // Step bounds are bins, not data: whole numbers once the range allows.
      const bound = (v: number): string => (range >= 20 ? String(Math.round(v)) : fmt(v));
      const label = range <= 0 ? `${fmt(min)}${unitSuffix}` : `${bound(lo)}–${bound(hi)}${unitSuffix}`;
      return { swatch: 'fill', fill: RAMP[step] ?? RAMP[0], label };
    });
  if (zero) items.unshift({ swatch: 'fill', fill: 'var(--paper)', label: `0${unitSuffix}` });
  const legendHtml = renderLegend(items);

  const inner =
    `<div class="heatmap" style="overflow-x:auto">` +
    `<div class="hm-grid" style="grid-template-columns:auto repeat(${cols.length},minmax(44px,1fr))"${bl('rows')}>${grid}</div>` +
    `</div>`;
  return diagramFrame(
    {
      tag: 'HEATMAP',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legendHtml.length > 0 ? { legendHtml } : {}),
    },
    inner,
  );
}
