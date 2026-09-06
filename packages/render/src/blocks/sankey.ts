/**
 * Renders a `sankey` block — how much of something moves between stages.
 *
 * Every other flow block in the library answers "does this path exist";
 * this one answers "how heavy is it". Node height and ribbon thickness are
 * both the value, on one scale, so the picture is quantitative: the widest
 * ribbon leaving a stage IS where the volume goes.
 *
 * Layout, in one pass each:
 *   1. Columns — a node's column is the longest chain of links reaching it,
 *      so a stage always sits to the right of everything feeding it (an
 *      explicit `col` overrides). Cycles can't extend a chain past the node
 *      count, which is what stops the walk.
 *   2. Height — a node is as tall as the larger of what flows in and out,
 *      scaled so the busiest column fills the canvas.
 *   3. Slots — links leave and arrive stacked in the order they were written,
 *      biggest column first, so ribbons cross as little as the data allows.
 *
 * Ribbons are filled cubic curves (two horizontal-tangent beziers and two
 * straight edges). Skin (`DESIGN.md`): stages are ink bars, ribbons are paper
 * pipes with a `rule-solid` edge, and the accent goes to the flows out of a
 * node the author marked with an accent — or, when none is, to the single
 * heaviest ribbon, which is the answer the chart exists to give. `accent:
 * red` is `negative`.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { marksOf, type Mark } from '../svg/dsTone.js';
import { diagramFrame } from './frame.js';

type SankeyData = BlockDataMap['sankey'];
type Link = SankeyData['links'][number];

type Tone = 'plain' | 'accent' | 'negative';

/** A node's tone from its mark: `negative`, `focal` → accent, else plain. */
function toneOf(mark: Mark): Tone {
  if (mark === 'negative') return 'negative';
  if (mark === 'focal') return 'accent';
  return 'plain';
}

const NODE_FILL: Record<Tone, string> = {
  plain: 'var(--ink)',
  accent: 'var(--accent)',
  negative: 'var(--negative)',
};
const RIBBON_ATTRS: Record<Tone, string> = {
  plain: 'fill="var(--paper)" stroke="var(--rule-solid)" stroke-width="1"',
  accent: 'fill="var(--accent-tint)" stroke="var(--accent)" stroke-width="1"',
  negative: 'fill="var(--negative-tint)" stroke="var(--negative)" stroke-width="1"',
};

const W = 900;
const NODE_W = 13;
const PAD_X = 8;
const PAD_TOP = 16;
const PAD_BOT = 14;
const GAP = 16; // vertical breathing room between nodes in a column
const MIN_H = 3; // a tiny flow still has to be visible

interface Placed {
  readonly id: string;
  readonly label: string;
  readonly tone: Tone;
  col: number;
  value: number;
  x: number;
  y: number;
  h: number;
  /** Running offsets as ribbons are attached. */
  outAt: number;
  inAt: number;
  /** Data path of the authoring node, when one was declared. */
  path: string | undefined;
}

/** Value formatter — trims a trailing `.0` and appends the unit. */
function fmt(v: number, unit: string | undefined): string {
  const rounded = Math.round(v * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return unit !== undefined ? `${text}${unit}` : text;
}

/**
 * Assigns every node a column: the longest link chain that reaches it. Relaxing
 * over all links `n` times settles any acyclic graph and can't loop forever on
 * a cyclic one.
 */
function columnsOf(ids: readonly string[], links: readonly Link[]): Map<string, number> {
  const col = new Map(ids.map((id) => [id, 0]));
  for (let pass = 0; pass < ids.length; pass++) {
    let moved = false;
    for (const l of links) {
      const from = col.get(l.from);
      const to = col.get(l.to);
      if (from === undefined || to === undefined) continue;
      if (to < from + 1) {
        col.set(l.to, from + 1);
        moved = true;
      }
    }
    if (!moved) break;
  }
  return col;
}

export function renderSankey(data: SankeyData): string {
  const links = data.links.filter((l) => l.from !== l.to && l.value > 0);
  const declared = data.nodes ?? [];
  const declaredAt = new Map(declared.map((n, i) => [n.id, i]));

  // Nodes come from the links, in first-seen order, so a bare link list works.
  const order: string[] = [];
  for (const n of declared) if (!order.includes(n.id)) order.push(n.id);
  for (const l of links) {
    if (!order.includes(l.from)) order.push(l.from);
    if (!order.includes(l.to)) order.push(l.to);
  }
  if (order.length === 0 || links.length === 0) {
    return frame(data, '<svg viewBox="0 0 900 60" role="img"><title>Sankey</title></svg>', '');
  }

  const derived = columnsOf(order, links);
  const nodes = new Map<string, Placed>();
  const marks = marksOf(declared.map((n) => n.accent));
  order.forEach((id) => {
    const di = declaredAt.get(id);
    const decl = declared[di ?? -1];
    const inflow = links.filter((l) => l.to === id).reduce((a, l) => a + l.value, 0);
    const outflow = links.filter((l) => l.from === id).reduce((a, l) => a + l.value, 0);
    nodes.set(id, {
      id,
      label: decl?.label ?? id,
      tone: toneOf(di !== undefined ? marks[di] : undefined),
      col: decl?.col !== undefined ? Math.max(0, decl.col - 1) : (derived.get(id) ?? 0),
      value: Math.max(inflow, outflow),
      x: 0,
      y: 0,
      h: 0,
      outAt: 0,
      inAt: 0,
      path: declaredAt.has(id) ? `nodes.${declaredAt.get(id) ?? 0}` : undefined,
    });
  });

  const cols = Math.max(...[...nodes.values()].map((n) => n.col)) + 1;
  const byCol: Placed[][] = Array.from({ length: cols }, () => []);
  for (const id of order) {
    const n = nodes.get(id);
    if (n !== undefined) byCol[n.col]?.push(n);
  }

  // The busiest column decides the scale: its flows plus its gaps fill the
  // canvas, and every other column is drawn on that same scale.
  const height = Math.max(220, Math.min(420, 60 + order.length * 34));
  const usable = height - PAD_TOP - PAD_BOT;
  const scale = Math.min(
    ...byCol
      .filter((c) => c.length > 0)
      .map((c) => {
        const total = c.reduce((a, n) => a + n.value, 0);
        const room = usable - GAP * (c.length - 1);
        return total > 0 ? Math.max(room, 40) / total : Infinity;
      }),
  );

  const colX = (c: number): number =>
    cols === 1 ? PAD_X : PAD_X + ((W - PAD_X * 2 - NODE_W) * c) / (cols - 1);

  byCol.forEach((column, c) => {
    const stack = column.reduce((a, n) => a + n.value * scale, 0) + GAP * (column.length - 1);
    let y = PAD_TOP + Math.max(0, (usable - stack) / 2);
    for (const n of column) {
      n.h = Math.max(MIN_H, n.value * scale);
      n.x = colX(c);
      n.y = y;
      n.outAt = y;
      n.inAt = y;
      y += n.h + GAP;
    }
  });

  // The accent: flows out of a flagged node; else the single heaviest ribbon.
  const flagged = [...nodes.values()].some((n) => n.tone !== 'plain');
  let heaviest = -1;
  if (!flagged) {
    let best = 0;
    data.links.forEach((l, li) => {
      if (l.from === l.to || !nodes.has(l.from) || !nodes.has(l.to)) return;
      if (l.value > best) {
        best = l.value;
        heaviest = li;
      }
    });
  }

  let s = `<svg viewBox="0 0 ${W} ${height}" role="img"><title>${escapeHtml(data.title ?? 'Flow volumes')}</title>`;

  // Ribbons first, so the node bars and their labels sit on top.
  const used = new Set<Tone>();
  s += `<g${bl('links')}>`;
  data.links.forEach((l, li) => {
    const a = nodes.get(l.from);
    const b = nodes.get(l.to);
    if (a === undefined || b === undefined || l.value <= 0 || l.from === l.to) return;
    const t = Math.max(1, l.value * scale);
    const x0 = a.x + NODE_W;
    const x1 = b.x;
    const y0 = a.outAt;
    const y1 = b.inAt;
    a.outAt += t;
    b.inAt += t;
    const mid = (x0 + x1) / 2;
    const d =
      `M ${r(x0)} ${r(y0)} C ${r(mid)} ${r(y0)}, ${r(mid)} ${r(y1)}, ${r(x1)} ${r(y1)} ` +
      `L ${r(x1)} ${r(y1 + t)} C ${r(mid)} ${r(y1 + t)}, ${r(mid)} ${r(y0 + t)}, ${r(x0)} ${r(y0 + t)} Z`;
    const tone: Tone = a.tone !== 'plain' ? a.tone : li === heaviest ? 'accent' : 'plain';
    used.add(tone);
    s += `<path d="${d}" ${RIBBON_ATTRS[tone]}${bp(`links.${li}`)}><title>${escapeHtml(`${a.label} → ${b.label}: ${fmt(l.value, data.unit)}`)}</title></path>`;
    // The value rides the ribbon where it is thick enough to hold it.
    if (t >= 13) {
      const label = l.label ?? fmt(l.value, data.unit);
      const cls = tone === 'accent' ? 't-arrow c-accent' : tone === 'negative' ? 't-arrow c-negative' : 't-arrow';
      s += `<text x="${r(mid)}" y="${r((y0 + y1) / 2 + t / 2 + 3)}" class="${cls}" text-anchor="middle">${escapeHtml(label)}</text>`;
    }
  });
  s += `</g>`;

  s += `<g${bl('nodes')}>`;
  for (const n of nodes.values()) {
    const attrs = n.path !== undefined ? bp(n.path) : '';
    s += `<g${attrs}>`;
    s += `<rect x="${r(n.x)}" y="${r(n.y)}" width="${NODE_W}" height="${r(n.h)}" fill="${NODE_FILL[n.tone]}"/>`;
    // Labels sit outside the bar, flipping side on the last column so they
    // never run off the canvas.
    const last = n.col === cols - 1;
    const tx = last ? n.x - 8 : n.x + NODE_W + 8;
    const ty = n.y + n.h / 2;
    const anchor = last ? 'end' : 'start';
    const nameCls = n.tone === 'accent' ? 't-name c-accent' : n.tone === 'negative' ? 't-name c-negative' : 't-name';
    // A paper mask under both lines keeps the label off the ribbon edges
    // that leave and arrive around the bar.
    const valueText = fmt(n.value, data.unit);
    const mw = Math.max(n.label.length * 7.2, valueText.length * 6.2) + 8;
    s += `<rect x="${r(last ? tx - mw + 4 : tx - 4)}" y="${r(ty - 9)}" width="${r(mw)}" height="28" rx="2" fill="var(--paper)"/>`;
    s += `<text x="${r(tx)}" y="${r(ty + 3)}" class="${nameCls}" text-anchor="${anchor}">${escapeHtml(n.label)}</text>`;
    s += `<text x="${r(tx)}" y="${r(ty + 15)}" class="t-sub c-muted" text-anchor="${anchor}">${escapeHtml(valueText)}</text>`;
    s += `</g>`;
  }
  s += `</g></svg>`;

  const items: LegendItem[] = [{ swatch: 'fill', fill: 'var(--ink)', label: 'stage (height = volume)' }];
  if (used.has('plain')) items.push({ swatch: 'fill', fill: 'var(--paper)', label: 'flow (width = volume)' });
  if (used.has('accent')) items.push({ swatch: 'node-accent', label: flagged ? 'focal flow' : 'heaviest flow' });
  if (used.has('negative')) items.push({ swatch: 'fill', fill: 'var(--negative-tint)', label: 'negative flow' });
  return frame(data, s, renderLegend(items));
}

/** Rounds to one decimal — SVG paths don't need more, and diffs stay small. */
function r(v: number): number {
  return Math.round(v * 10) / 10;
}

function frame(data: SankeyData, inner: string, legendHtml: string): string {
  return diagramFrame(
    {
      tag: 'SANKEY',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legendHtml.length > 0 ? { legendHtml } : {}),
    },
    inner,
  );
}
