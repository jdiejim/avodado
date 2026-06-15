/**
 * Renders an entity-relationship diagram as inline SVG.
 *
 * Two-stage layout, computed at render time (pure JS, no DOM, static SVG out):
 *  1. dagre places the entity boxes (layered, no overlap, edges drawn around).
 *  2. each relation is routed at the FIELD level — from the foreign-key row in
 *     the source entity to the primary-key row in the target entity — with a
 *     clean orthogonal path through the gap between the boxes and an arrowhead
 *     into the PK row (FK → PK).
 *
 * Entities longer than `MAX_ROWS` are truncated with a "… +N more" row.
 */

import dagre from '@dagrejs/dagre';
import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { diagramFrame } from './frame.js';

type ErdData = BlockDataMap['erd'];
type ErdEntity = NonNullable<ErdData['entities']>[number];
type ErdColumn = NonNullable<ErdEntity['columns']>[number];

/** Rows shown before an entity is truncated with a "… +N more" row. */
const MAX_ROWS = 10;

const COL_W = 216;
const ROW_H = 24;
const HEAD_H = 32;
const BOT_PAD = 8;

interface Box {
  readonly name: string;
  readonly cols: readonly ErdColumn[]; // full column list (for FK/PK lookup)
  readonly rows: readonly ErdColumn[]; // visible rows (after truncation)
  readonly hidden: number;
  readonly pkIdx: number; // index of the primary-key column, or -1
  readonly w: number;
  readonly h: number;
}

interface Pt {
  readonly x: number;
  readonly y: number;
}

export function renderErd(data: BlockDataMap['erd']): string {
  const ents = data.entities ?? [];
  const rels = data.relations ?? [];

  const boxes: Box[] = ents.map((e) => {
    const cols = e.columns ?? [];
    let rows = cols;
    let hidden = 0;
    if (cols.length > MAX_ROWS) {
      rows = cols.slice(0, MAX_ROWS - 1);
      hidden = cols.length - rows.length;
    }
    const bodyRows = rows.length + (hidden > 0 ? 1 : 0);
    return {
      name: e.name,
      cols,
      rows,
      hidden,
      pkIdx: cols.findIndex((c) => c.pk === true),
      w: COL_W,
      h: HEAD_H + bodyRows * ROW_H + BOT_PAD,
    };
  });
  const byName = new Map(boxes.map((b) => [b.name, b]));
  const validRels = rels.filter((r) => byName.has(r.from) && byName.has(r.to));

  // Stage 1: dagre places boxes (edges inform placement, but we route our own).
  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setGraph({ rankdir: 'LR', nodesep: 38, ranksep: 96, marginx: 18, marginy: 18 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const b of boxes) g.setNode(b.name, { width: b.w, height: b.h });
  validRels.forEach((r, i) => g.setEdge(r.from, r.to, {}, `e${i}`));
  dagre.layout(g);

  const graph = g.graph();
  const W = Math.ceil(graph.width ?? 0);
  const H = Math.ceil(graph.height ?? 0);

  const at = new Map<string, Pt>(); // top-left of each box
  for (const b of boxes) {
    const n = g.node(b.name) as { x: number; y: number };
    at.set(b.name, { x: n.x - b.w / 2, y: n.y - b.h / 2 });
  }

  let s = `<svg viewBox="0 0 ${W} ${H}" role="img">` + `<title>Entity-relationship diagram</title>`;

  // Stage 2: field-level edge routing (drawn first, so boxes sit on top).
  validRels.forEach((r) => {
    const src = byName.get(r.from);
    const tgt = byName.get(r.to);
    const sp = at.get(r.from);
    const tp = at.get(r.to);
    if (!src || !tgt || !sp || !tp) return;

    const fkY = rowAnchorY(src, sp.y, pickFkIndex(src.cols, tgt.name));
    const pkY = rowAnchorY(tgt, tp.y, tgt.pkIdx);

    const rightward = tp.x + tgt.w / 2 >= sp.x + src.w / 2;
    const sx = rightward ? sp.x + src.w : sp.x; // exit side of source
    const tx = rightward ? tp.x : tp.x + tgt.w; // enter side of target

    const lo = Math.min(sx, tx) + 10;
    const hi = Math.max(sx, tx) - 10;
    const midX = hi > lo ? clamp((sx + tx) / 2, lo, hi) : (sx + tx) / 2;

    s +=
      `<path d="M${round(sx)},${round(fkY)} H${round(midX)} V${round(pkY)} H${round(tx)}" fill="none" stroke="var(--gray)" stroke-width="1.5"/>` +
      `<circle cx="${round(sx)}" cy="${round(fkY)}" r="2.6" fill="var(--gray)"/>` +
      arrowHeadH(tx, pkY, rightward);

    if (r.card !== undefined) {
      const w = 30;
      const cy = (fkY + pkY) / 2;
      s +=
        `<rect x="${round(midX - w / 2)}" y="${round(cy - 9)}" width="${w}" height="18" rx="9" fill="var(--white)" stroke="var(--rule)"/>` +
        `<text x="${round(midX)}" y="${round(cy + 3)}" class="edge-label">${escapeHtml(r.card)}</text>`;
    }
  });

  // Entity boxes.
  for (const b of boxes) {
    const p = at.get(b.name);
    if (!p) continue;
    const { x, y } = p;
    s +=
      `<rect x="${round(x)}" y="${round(y)}" width="${b.w}" height="${b.h}" rx="5" fill="var(--white)" stroke="var(--navy)"/>` +
      `<path d="M${round(x)},${round(y + HEAD_H)} v${-(HEAD_H - 5)} a5,5 0 0 1 5,-5 h${b.w - 10} a5,5 0 0 1 5,5 v${HEAD_H - 5} z" fill="var(--navy)"/>` +
      `<text x="${round(x + b.w / 2)}" y="${round(y + 21)}" class="er-head-text">${escapeHtml(b.name)}</text>`;

    b.rows.forEach((f, j) => {
      const rowTop = y + HEAD_H + j * ROW_H;
      const ty = rowTop + 16;
      if (j > 0) {
        s += `<line x1="${round(x)}" y1="${round(rowTop)}" x2="${round(x + b.w)}" y2="${round(rowTop)}" class="er-rowline"/>`;
      }
      const nameX = f.pk === true || f.fk === true ? x + 40 : x + 13;
      if (f.pk === true) {
        s += `<text x="${round(x + 13)}" y="${round(ty)}" class="er-key">PK</text>`;
      } else if (f.fk === true) {
        s += `<text x="${round(x + 13)}" y="${round(ty)}" class="er-key fk">FK</text>`;
      }
      s +=
        `<text x="${round(nameX)}" y="${round(ty)}" class="er-col">${escapeHtml(f.name)}</text>` +
        `<text x="${round(x + b.w - 13)}" y="${round(ty)}" class="er-col dim" text-anchor="end">${escapeHtml(f.type ?? '')}</text>`;
    });

    if (b.hidden > 0) {
      const rowTop = y + HEAD_H + b.rows.length * ROW_H;
      s +=
        `<line x1="${round(x)}" y1="${round(rowTop)}" x2="${round(x + b.w)}" y2="${round(rowTop)}" class="er-rowline"/>` +
        `<text x="${round(x + b.w / 2)}" y="${round(rowTop + 16)}" class="er-col dim" text-anchor="middle">… +${b.hidden} more</text>`;
    }
  }

  s += `</svg>`;

  const opts: Parameters<typeof diagramFrame>[0] = {
    tag: 'ER',
    tagBg: '#6b21a8',
    ...(data.title !== undefined ? { title: data.title } : {}),
    ...(data.description !== undefined ? { desc: data.description } : {}),
  };
  return diagramFrame(opts, s);
}

/** Vertical centre of column `idx` in a box; falls back to the box centre. */
function rowAnchorY(box: Box, topY: number, idx: number): number {
  if (idx >= 0 && idx < box.rows.length) return topY + HEAD_H + idx * ROW_H + ROW_H / 2;
  return topY + box.h / 2;
}

/**
 * Picks which foreign-key column references `toName`. Prefers an FK whose name
 * mentions the target entity (e.g. `user_id` → `users`); else the first FK; -1.
 */
function pickFkIndex(columns: readonly ErdColumn[], toName: string): number {
  const fks = columns.map((c, i) => ({ c, i })).filter((x) => x.c.fk === true);
  const first = fks[0];
  if (first === undefined) return -1;
  const t = toName.toLowerCase();
  const singular = t.replace(/s$/, '');
  const match = fks.find((x) => {
    const n = x.c.name.toLowerCase();
    return n.includes(t) || n.includes(singular);
  });
  return (match ?? first).i;
}

/** A 10px horizontal arrowhead with its tip at (x, y), pointing right or left. */
function arrowHeadH(x: number, y: number, pointRight: boolean): string {
  const dx = pointRight ? -10 : 10;
  return `<path d="M${round(x + dx)},${round(y - 5)} L${round(x)},${round(y)} L${round(x + dx)},${round(y + 5)}" fill="none" stroke="var(--navy)" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>`;
}

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));
const round = (n: number): number => Math.round(n * 10) / 10;
