/**
 * Renders an entity-relationship diagram as inline SVG.
 *
 * Layout is computed at render time with dagre (a pure-JS layered graph layout —
 * no DOM), so entity boxes are placed without overlap and relations are routed
 * cleanly around them. Each relation points an arrowhead from the foreign-key
 * entity into the primary-key entity (FK → PK). Long entities are truncated to
 * `MAX_ROWS` with a "… +N more" row for readability.
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
  readonly rows: readonly ErdColumn[];
  readonly hidden: number;
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

  // Build boxes with row truncation.
  const boxes: Box[] = ents.map((e) => {
    const cols = e.columns ?? [];
    let rows = cols;
    let hidden = 0;
    if (cols.length > MAX_ROWS) {
      rows = cols.slice(0, MAX_ROWS - 1);
      hidden = cols.length - rows.length;
    }
    const bodyRows = rows.length + (hidden > 0 ? 1 : 0);
    const h = HEAD_H + bodyRows * ROW_H + BOT_PAD;
    return { name: e.name, rows, hidden, w: COL_W, h };
  });
  const byName = new Map(boxes.map((b) => [b.name, b]));
  const validRels = rels.filter((r) => byName.has(r.from) && byName.has(r.to));

  // Layout with dagre (FK entity → PK entity).
  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setGraph({ rankdir: 'LR', nodesep: 34, ranksep: 86, marginx: 18, marginy: 18 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const b of boxes) g.setNode(b.name, { width: b.w, height: b.h });
  validRels.forEach((r, i) => g.setEdge(r.from, r.to, {}, `e${i}`));
  dagre.layout(g);

  const graph = g.graph();
  const W = Math.ceil(graph.width ?? 0);
  const H = Math.ceil(graph.height ?? 0);

  // dagre node coords are centres; convert to top-left.
  const topLeft = new Map<string, Pt>();
  for (const b of boxes) {
    const n = g.node(b.name) as { x: number; y: number };
    topLeft.set(b.name, { x: n.x - b.w / 2, y: n.y - b.h / 2 });
  }

  let s = `<svg viewBox="0 0 ${W} ${H}" role="img">` + `<title>Entity-relationship diagram</title>`;

  // Relations first, so boxes sit on top.
  validRels.forEach((r, i) => {
    const e = g.edge(r.from, r.to, `e${i}`) as { points?: Pt[] } | undefined;
    const pts = e?.points;
    if (!pts || pts.length < 2) return;
    const first = pts[0];
    const last = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    if (first === undefined || last === undefined || prev === undefined) return;

    const line = pts.map((p) => `${round(p.x)},${round(p.y)}`).join(' ');
    s +=
      `<polyline points="${line}" fill="none" stroke="var(--gray)" stroke-width="1.5"/>` +
      `<circle cx="${round(first.x)}" cy="${round(first.y)}" r="2.6" fill="var(--gray)"/>` +
      arrowHead(prev, last);

    const mid = r.card !== undefined ? pts[Math.floor(pts.length / 2)] : undefined;
    if (r.card !== undefined && mid !== undefined) {
      const w = 30;
      s +=
        `<rect x="${round(mid.x - w / 2)}" y="${round(mid.y - 9)}" width="${w}" height="18" rx="9" fill="var(--white)" stroke="var(--rule)"/>` +
        `<text x="${round(mid.x)}" y="${round(mid.y + 3)}" class="edge-label">${escapeHtml(r.card)}</text>`;
    }
  });

  // Entity boxes.
  for (const b of boxes) {
    const p = topLeft.get(b.name);
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

/** A 10px arrowhead at `to`, pointing along the `from → to` direction. */
function arrowHead(from: Pt, to: Pt): string {
  const ang = Math.atan2(to.y - from.y, to.x - from.x);
  const len = 10;
  const spread = 0.42;
  const b1x = to.x - len * Math.cos(ang - spread);
  const b1y = to.y - len * Math.sin(ang - spread);
  const b2x = to.x - len * Math.cos(ang + spread);
  const b2y = to.y - len * Math.sin(ang + spread);
  return `<path d="M${round(b1x)},${round(b1y)} L${round(to.x)},${round(to.y)} L${round(b2x)},${round(b2y)}" fill="none" stroke="var(--navy)" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>`;
}

const round = (n: number): number => Math.round(n * 10) / 10;
