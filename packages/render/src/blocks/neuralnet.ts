/**
 * Renders a `neuralnet` block — a layered neural network, one column of
 * units per layer, left to right, dense-connected to the next column.
 *
 * A layer with more units than `maxUnits` (default 6) draws `maxUnits`
 * circles with a vertical ellipsis between the last two, and prints the real
 * `units` under its label, so a 784-unit input still reads as one column.
 * The mesh between two layers is every drawn unit to every drawn unit as a
 * hairline, so it reads as a texture rather than as edges; `connect: none`
 * on a layer skips the mesh into it.
 *
 * Skin (`DESIGN.md`): unit glyphs are told apart by shape and fill, never by
 * hue — input and output units hollow (paper, ink outline), hidden units
 * filled `muted`, a `conv` unit a square, `pool` a rounded square on the
 * inactive fill, `attention` a diamond, `norm` the inactive fill,
 * `dropout` a dashed outline. Zero accent: the network is one shape.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { countPhrase, svgName } from '../svg/svgTitle.js';
import { wrapText } from '../svg/wrapText.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';

type Layer = BlockDataMap['neuralnet']['layers'][number];
type Kind = NonNullable<Layer['kind']>;

const DEFAULT_MAX_UNITS = 6;
/** Units drawn for a layer that names no `units` and has no predecessor. */
const DEFAULT_DRAWN = 4;
const R = 8;
const STEP = 24;
/** Extra vertical room the ellipsis takes between the last two units. */
const ELLIPSIS_GAP = 18;
const COL_W = 124;
const PAD_X = 30;
const PAD_TOP = 22;
const LABEL_GAP = 26;
const LINE_H = 14;
const SUB_H = 13;

/** One unit glyph per kind: the shape and the fill/stroke it takes. */
function unitGlyph(kind: Kind, cx: number, cy: number): string {
  const hollow = 'fill="var(--paper)" stroke="var(--ink)" stroke-width="1.5"';
  const filled = 'fill="var(--muted)" stroke="var(--muted)" stroke-width="1"';
  const inactive = 'fill="var(--paper-2)" stroke="var(--rule-solid)" stroke-width="1"';
  switch (kind) {
    case 'input':
    case 'output':
      return `<circle cx="${cx}" cy="${cy}" r="${R}" ${hollow}/>`;
    case 'conv':
      return `<rect x="${cx - R + 1}" y="${cy - R + 1}" width="${2 * R - 2}" height="${2 * R - 2}" ${filled}/>`;
    case 'pool':
      return `<rect x="${cx - R + 1}" y="${cy - R + 1}" width="${2 * R - 2}" height="${2 * R - 2}" rx="4" ${inactive}/>`;
    case 'attention':
      return `<path d="M${cx} ${cy - R - 1} L${cx + R + 1} ${cy} L${cx} ${cy + R + 1} L${cx - R - 1} ${cy} z" ${filled}/>`;
    case 'norm':
      return `<circle cx="${cx}" cy="${cy}" r="${R}" ${inactive}/>`;
    case 'dropout':
      return `<circle cx="${cx}" cy="${cy}" r="${R}" fill="var(--paper)" stroke="var(--rule-solid)" stroke-width="1" stroke-dasharray="3 2"/>`;
    case 'recurrent':
      return `<circle cx="${cx}" cy="${cy}" r="${R}" ${filled}/><circle cx="${cx}" cy="${cy}" r="3" fill="var(--paper)"/>`;
    case 'embedding':
    case 'dense':
      return `<circle cx="${cx}" cy="${cy}" r="${R}" ${filled}/>`;
  }
}

const KIND_LEGEND: Record<Kind, LegendItem> = {
  input: { swatch: 'node-dot', label: 'input' },
  output: { swatch: 'node-dot', label: 'output' },
  dense: { swatch: 'node-dot', label: 'dense', fill: 'var(--muted)', stroke: 'var(--muted)' },
  embedding: { swatch: 'node-dot', label: 'embedding', fill: 'var(--muted)', stroke: 'var(--muted)' },
  recurrent: { swatch: 'node-dot', label: 'recurrent', fill: 'var(--muted)', stroke: 'var(--muted)' },
  conv: { swatch: 'fill', label: 'conv', fill: 'var(--muted)' },
  pool: { swatch: 'node-fill2', label: 'pool' },
  attention: { swatch: 'node-dot', label: 'attention', fill: 'var(--muted)', stroke: 'var(--muted)' },
  norm: { swatch: 'node-dot', label: 'norm', fill: 'var(--paper-2)', stroke: 'var(--rule-solid)' },
  dropout: { swatch: 'node-dot', label: 'dropout', stroke: 'var(--rule-solid)', dash: '3 2' },
};

/** Infers the kind of a layer that names none: first is input, last is output, the rest dense. */
function kindOf(l: Layer, i: number, n: number): Kind {
  if (l.kind !== undefined) return l.kind;
  if (i === 0) return 'input';
  if (i === n - 1) return 'output';
  return 'dense';
}

export function renderNeuralnet(data: BlockDataMap['neuralnet']): string {
  const layers = data.layers;
  const n = layers.length;
  const maxUnits = Math.max(1, Math.min(12, Math.round(data.maxUnits ?? DEFAULT_MAX_UNITS)));

  // Drawn units per layer: min(units, maxUnits); a layer without `units`
  // keeps the width of the layer before it (norm, dropout) or the default.
  const drawn: number[] = [];
  const truncated: boolean[] = [];
  layers.forEach((l, i) => {
    const prev = drawn[i - 1] ?? DEFAULT_DRAWN;
    const real = l.units !== undefined ? Math.max(1, Math.round(l.units)) : undefined;
    const d = real !== undefined ? Math.min(real, maxUnits) : Math.min(prev, maxUnits);
    drawn.push(d);
    truncated.push(real !== undefined && real > d);
  });

  const colH = (i: number): number => ((drawn[i] ?? 1) - 1) * STEP + (truncated[i] === true ? ELLIPSIS_GAP : 0) + 2 * R;
  const tallest = Math.max(...layers.map((_, i) => colH(i)));
  const midY = PAD_TOP + tallest / 2;
  const kinds = layers.map((l, i) => kindOf(l, i, n));
  const labelLines = layers.map((l) => wrapText(l.label, 16, 2));
  const maxLabel = Math.max(1, ...labelLines.map((ls) => ls.length));

  /** Centre y of unit `k` (0-based, top to bottom) in layer `i`. */
  const unitY = (i: number, k: number): number => {
    const d = drawn[i] ?? 1;
    const top = midY - colH(i) / 2 + R;
    const extra = truncated[i] === true && k === d - 1 ? ELLIPSIS_GAP : 0;
    return top + k * STEP + extra;
  };
  const colX = (i: number): number => PAD_X + COL_W / 2 + i * COL_W;

  const textTop = PAD_TOP + tallest + LABEL_GAP;
  const subRows = (l: Layer): number =>
    (l.units !== undefined ? 1 : 0) + (l.activation !== undefined ? 1 : 0) + (l.note !== undefined ? 1 : 0);
  const maxSub = Math.max(0, ...layers.map(subRows));
  const width = PAD_X * 2 + n * COL_W;
  const height = textTop + maxLabel * LINE_H + maxSub * SUB_H + 14;

  const a11y = svgName('Neural network', data.title, [countPhrase(n, 'layer')]);
  let s = `<svg viewBox="0 0 ${width} ${height}"${a11y.attrs}>${a11y.title}`;

  // The mesh, beneath the units: every drawn unit of layer i-1 to every drawn
  // unit of layer i, unless layer i opts out.
  s += `<g fill="none" stroke="var(--rule-solid)" stroke-width=".6" data-decorative="1">`;
  for (let i = 1; i < n; i++) {
    if (layers[i]?.connect === 'none') continue;
    const x0 = colX(i - 1) + R;
    const x1 = colX(i) - R;
    for (let a = 0; a < (drawn[i - 1] ?? 0); a++) {
      const y0 = unitY(i - 1, a);
      for (let b = 0; b < (drawn[i] ?? 0); b++) {
        s += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${unitY(i, b)}"/>`;
      }
    }
  }
  s += `</g>`;

  const kindsUsed = new Set<Kind>();
  s += `<g${bl('layers')}>`;
  layers.forEach((l, i) => {
    const kind = kinds[i] ?? 'dense';
    kindsUsed.add(kind);
    const cx = colX(i);
    const d = drawn[i] ?? 1;
    let g = `<g${bp(`layers.${i}`)}>`;
    for (let k = 0; k < d; k++) g += unitGlyph(kind, cx, unitY(i, k));
    if (truncated[i] === true && d >= 2) {
      // The vertical ellipsis sits in the widened gap before the last unit.
      const yA = unitY(i, d - 2) + R;
      const yB = unitY(i, d - 1) - R;
      const mid = (yA + yB) / 2;
      g += `<g fill="var(--muted)" data-decorative="1"><circle cx="${cx}" cy="${mid - 5}" r="1.2"/><circle cx="${cx}" cy="${mid}" r="1.2"/><circle cx="${cx}" cy="${mid + 5}" r="1.2"/></g>`;
    }
    const lines = labelLines[i] ?? [];
    let ty = textTop;
    g += `<g${bp(`layers.${i}.label`)}>`;
    lines.forEach((ln, li) => {
      g += `<text x="${cx}" y="${ty + li * LINE_H}" class="t-name" text-anchor="middle">${escapeHtml(ln)}</text>`;
    });
    g += `</g>`;
    ty += maxLabel * LINE_H;
    if (l.units !== undefined) {
      g += `<text x="${cx}" y="${ty}" class="t-sub c-ink" text-anchor="middle"${bp(`layers.${i}.units`)}>${escapeHtml(String(l.units))}</text>`;
      ty += SUB_H;
    }
    if (l.activation !== undefined) {
      g += `<text x="${cx}" y="${ty}" class="t-sub" text-anchor="middle"${bp(`layers.${i}.activation`)}>${escapeHtml(l.activation)}</text>`;
      ty += SUB_H;
    }
    if (l.note !== undefined) {
      const note = wrapText(l.note, 18, 1)[0] ?? '';
      const title = note !== l.note ? `<title>${escapeHtml(l.note)}</title>` : '';
      g += `<text x="${cx}" y="${ty}" class="t-sub c-soft" text-anchor="middle"${bp(`layers.${i}.note`)}>${title}${escapeHtml(note)}</text>`;
    }
    g += `</g>`;
    s += g;
  });
  s += `</g></svg>`;

  const items: LegendItem[] = [...kindsUsed].map((k) => KIND_LEGEND[k]);
  const legend = renderLegend(items);
  const desc =
    data.description !== undefined && data.lede !== undefined
      ? `${data.description} ${data.lede}`
      : (data.description ?? data.lede);
  const footer =
    data.params !== undefined
      ? `<div class="diagram-foot"><span${bp('params')}><strong>Params</strong> ${escapeHtml(data.params)}</span></div>`
      : '';

  return diagramFrame(
    {
      tag: 'NEURAL NET',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(desc !== undefined ? { desc } : {}),
      ...(legend.length > 0 ? { legendHtml: legend } : {}),
      ...(footer.length > 0 ? { footerHtml: footer } : {}),
    },
    s,
  );
}
