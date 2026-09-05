/**
 * The legend strip under a figure — one item per encoding the diagram
 * actually used (node kinds present, arrow styles present, the accent's
 * meaning). Renderers build the list from their data; the strip is omitted
 * when fewer than two encodings are in play, because a legend with one entry
 * explains nothing.
 *
 * Every swatch is a tiny inline SVG drawn from the skin tokens (see
 * `DESIGN.md`), so a legend item always matches the stroke it stands for.
 */

import { escapeHtml } from '../escape.js';

/** The swatch vocabulary — the encodings the skin can tell apart. */
export type LegendSwatch =
  | 'node'
  | 'node-accent'
  | 'node-dashed'
  | 'node-fill2'
  | 'edge'
  | 'edge-dashed'
  | 'edge-async'
  | 'edge-error'
  | 'edge-accent'
  | 'chip';

/** One legend entry: a swatch (or a text chip) and the label beside it. */
export interface LegendItem {
  readonly swatch: LegendSwatch;
  readonly label: string;
  /** The chip text, when `swatch` is `chip` (e.g. `EXT`, `#`, `1 / N`). */
  readonly chip?: string;
}

const SW_W = 30;
const SW_H = 14;

/** A small filled arrowhead ending at (x, y), pointing right. */
function head(x: number, y: number, stroke: string, filled: boolean): string {
  return filled
    ? `<path d="M${x - 6},${y - 3} L${x},${y} L${x - 6},${y + 3} z" fill="${stroke}"/>`
    : `<path d="M${x - 6},${y - 3} L${x},${y} L${x - 6},${y + 3}" fill="none" stroke="${stroke}" stroke-width="1.2"/>`;
}

function edgeSwatch(stroke: string, sw: number, dash: string, filled: boolean): string {
  const y = SW_H / 2;
  const dashAttr = dash.length > 0 ? ` stroke-dasharray="${dash}"` : '';
  return (
    `<line x1="1" y1="${y}" x2="${SW_W - 7}" y2="${y}" stroke="${stroke}" stroke-width="${sw}"${dashAttr}/>` +
    head(SW_W - 1, y, stroke, filled)
  );
}

function nodeSwatch(stroke: string, sw: number, fill: string, dash: string): string {
  const dashAttr = dash.length > 0 ? ` stroke-dasharray="${dash}"` : '';
  return `<rect x="1" y="1" width="${SW_W - 2}" height="${SW_H - 2}" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dashAttr}/>`;
}

function swatchSvg(kind: LegendSwatch): string {
  let inner: string;
  switch (kind) {
    case 'node':
      inner = nodeSwatch('var(--ink)', 1.5, 'var(--paper)', '');
      break;
    case 'node-accent':
      inner = nodeSwatch('var(--accent)', 1.5, 'var(--accent-tint)', '');
      break;
    case 'node-dashed':
      inner = nodeSwatch('var(--ink)', 1.25, 'var(--paper)', '4 3');
      break;
    case 'node-fill2':
      inner = nodeSwatch('var(--rule-solid)', 1, 'var(--paper-2)', '');
      break;
    case 'edge':
      inner = edgeSwatch('var(--muted)', 1.5, '', true);
      break;
    case 'edge-dashed':
      inner = edgeSwatch('var(--muted)', 1.5, '5 4', false);
      break;
    case 'edge-async':
      inner = edgeSwatch('var(--muted)', 1.25, '2 3', false);
      break;
    case 'edge-error':
      inner = edgeSwatch('var(--negative)', 1.5, '', true);
      break;
    case 'edge-accent':
      inner = edgeSwatch('var(--accent)', 1.75, '', true);
      break;
    case 'chip':
      return '';
  }
  return `<svg class="lg-sw" viewBox="0 0 ${SW_W} ${SW_H}" width="${SW_W}" height="${SW_H}" aria-hidden="true">${inner}</svg>`;
}

/**
 * Renders the legend strip. Returns `''` when `items` has fewer than two
 * entries — a single encoding needs no key.
 */
export function renderLegend(items: readonly LegendItem[]): string {
  if (items.length < 2) return '';
  const parts = items
    .map((it) => {
      const sw =
        it.swatch === 'chip'
          ? `<span class="lg-chip t-eyebrow">${escapeHtml(it.chip ?? '')}</span>`
          : swatchSvg(it.swatch);
      return `<span class="lg-item">${sw}<span class="lg-label">${escapeHtml(it.label)}</span></span>`;
    })
    .join('');
  return `<div class="diagram-legend"><span class="lg-title t-eyebrow">Legend</span>${parts}</div>`;
}
