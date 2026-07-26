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
 * straight edges), tinted by the source node so a flow keeps its colour all
 * the way across.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';

type SankeyData = BlockDataMap['sankey'];
type Link = SankeyData['links'][number];

/** Accent name → the palette variable the rest of the library uses. */
const ACCENT: Readonly<Record<string, string>> = {
  navy: 'var(--navy)',
  blue: 'var(--blue)',
  teal: 'var(--teal)',
  green: 'var(--positive)',
  amber: 'var(--highlight)',
  purple: 'var(--purple)',
  red: 'var(--negative)',
  gray: 'var(--gray)',
};
/** Colour cycle for nodes that name no accent. */
const CYCLE = ['var(--navy)', 'var(--teal)', 'var(--blue)', 'var(--purple)', 'var(--highlight)'];

/** A node's colour: its declared accent, else the next colour in the cycle. */
function accentColor(accent: string | undefined, i: number): string {
  if (accent !== undefined) return ACCENT[accent] ?? CYCLE[0] ?? 'var(--navy)';
  return CYCLE[i % CYCLE.length] ?? 'var(--navy)';
}

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
  readonly color: string;
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
    return frame(data, '<svg viewBox="0 0 900 60" role="img"><title>Sankey</title></svg>');
  }

  const derived = columnsOf(order, links);
  const nodes = new Map<string, Placed>();
  order.forEach((id, i) => {
    const decl = declared[declaredAt.get(id) ?? -1];
    const inflow = links.filter((l) => l.to === id).reduce((a, l) => a + l.value, 0);
    const outflow = links.filter((l) => l.from === id).reduce((a, l) => a + l.value, 0);
    nodes.set(id, {
      id,
      label: decl?.label ?? id,
      color: accentColor(decl?.accent, i),
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

  let s = `<svg viewBox="0 0 ${W} ${height}" role="img"><title>${escapeHtml(data.title ?? 'Flow volumes')}</title>`;

  // Ribbons first, so the node bars and their labels sit on top.
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
    s += `<path d="${d}" fill="${a.color}" fill-opacity="0.28" stroke="${a.color}" stroke-opacity="0.35" stroke-width="0.5"${bp(`links.${li}`)}><title>${escapeHtml(`${a.label} → ${b.label}: ${fmt(l.value, data.unit)}`)}</title></path>`;
    // The value rides the ribbon where it is thick enough to hold it.
    if (t >= 13) {
      const label = l.label ?? fmt(l.value, data.unit);
      s += `<text x="${r(mid)}" y="${r((y0 + y1) / 2 + t / 2 + 3)}" class="sk-flow">${escapeHtml(label)}</text>`;
    }
  });
  s += `</g>`;

  s += `<g${bl('nodes')}>`;
  for (const n of nodes.values()) {
    const attrs = n.path !== undefined ? bp(n.path) : '';
    s += `<g${attrs}>`;
    s += `<rect x="${r(n.x)}" y="${r(n.y)}" width="${NODE_W}" height="${r(n.h)}" rx="2.5" fill="${n.color}"/>`;
    // Labels sit outside the bar, flipping side on the last column so they
    // never run off the canvas.
    const last = n.col === cols - 1;
    const tx = last ? n.x - 8 : n.x + NODE_W + 8;
    const ty = n.y + n.h / 2;
    s += `<text x="${r(tx)}" y="${r(ty - 1)}" class="sk-name" text-anchor="${last ? 'end' : 'start'}">${escapeHtml(n.label)}</text>`;
    s += `<text x="${r(tx)}" y="${r(ty + 11)}" class="sk-value" text-anchor="${last ? 'end' : 'start'}">${escapeHtml(fmt(n.value, data.unit))}</text>`;
    s += `</g>`;
  }
  s += `</g></svg>`;

  return frame(data, s);
}

/** Rounds to one decimal — SVG paths don't need more, and diffs stay small. */
function r(v: number): number {
  return Math.round(v * 10) / 10;
}

function frame(data: SankeyData, inner: string): string {
  return diagramFrame(
    {
      tag: 'SANKEY',
      tagBg: '#2f6f6a',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
    },
    inner,
  );
}
