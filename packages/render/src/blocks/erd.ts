/**
 * Renders an entity-relationship diagram as inline SVG.
 *
 * Two-stage layout, computed at render time (pure JS, no DOM, static SVG out):
 *  1. dagre places the entity cards (layered, no overlap, edges drawn around).
 *  2. each relation is routed at the FIELD level — from the foreign-key row in
 *     the source entity to the primary-key row in the target entity — with a
 *     clean orthogonal path through the gap between the cards.
 *
 * Skin (`DESIGN.md`): an entity is a paper card with an ink outline, an
 * eyebrow (`ENTITY` / `JOIN` / `AGGREGATE ROOT`) over the name, and mono rows
 * where `#` marks the primary key and `→` a foreign key. Relation lines carry
 * `1` / `N` letters at each end instead of crow's feet. The entity on the
 * "one" side of the most relations is the aggregate root and takes the accent.
 *
 * Entities longer than `MAX_ROWS` are truncated with a "… +N more" row.
 */

import dagre from '@dagrejs/dagre';
import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';

type ErdData = BlockDataMap['erd'];
type ErdEntity = NonNullable<ErdData['entities']>[number];
type ErdColumn = NonNullable<ErdEntity['columns']>[number];

/** Rows shown before an entity is truncated with a "… +N more" row. */
const MAX_ROWS = 10;

const COL_W = 200;
const ROW_H = 20;
const HEAD_H = 40;
const BOT_PAD = 6;
/** Approximate advance of one 10px mono glyph. */
const CH = 6.2;

interface Box {
  readonly name: string;
  readonly cols: readonly ErdColumn[]; // full column list (for FK/PK lookup)
  readonly rows: readonly ErdColumn[]; // visible rows (after truncation)
  readonly hidden: number;
  readonly pkIdx: number; // index of the primary-key column, or -1
  readonly join: boolean; // every column is a foreign key
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
    // Size each entity to its longest column-name + type pair (clamped) so
    // wide schemas never truncate and narrow ones don't waste space.
    const w = Math.min(
      300,
      Math.max(
        COL_W,
        e.name.length * 7.5 + 40,
        ...cols.map((c) => (c.name.length + (c.type?.length ?? 0)) * CH + 60),
      ),
    );
    return {
      name: e.name,
      cols,
      rows,
      hidden,
      pkIdx: cols.findIndex((c) => c.pk === true),
      join: cols.length > 0 && cols.every((c) => c.fk === true),
      w: Math.round(w),
      h: HEAD_H + bodyRows * ROW_H + BOT_PAD,
    };
  });
  const byName = new Map(boxes.map((b) => [b.name, b]));
  const validRels = rels.filter((r) => byName.has(r.from) && byName.has(r.to));

  // The aggregate root: the entity on the "one" side of the most relations.
  // A tie means no root — zero accent is a valid outcome.
  const ones = new Map<string, number>();
  for (const r of validRels) {
    const card = parseCard(r.card);
    if (!card.toMany) ones.set(r.to, (ones.get(r.to) ?? 0) + 1);
    if (!card.fromMany) ones.set(r.from, (ones.get(r.from) ?? 0) + 1);
  }
  let rootName: string | undefined;
  let best = 0;
  let tied = false;
  for (const [name, n] of ones) {
    if (n > best) {
      best = n;
      rootName = name;
      tied = false;
    } else if (n === best) {
      tied = true;
    }
  }
  if (tied) rootName = undefined;

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
  const labels: string[] = [];
  let hasCard = false;
  s += `<g${bl('relations')}>`; // editors add relations via this list's chip
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

    const card = parseCard(r.card);
    hasCard = true;
    // The whole routed connector is one editable part (`relations.N`).
    s +=
      `<g${bp(`relations.${rels.indexOf(r)}`)}>` +
      `<path d="M${round(sx)},${round(fkY)} H${round(midX)} V${round(pkY)} H${round(tx)}" fill="none" stroke="var(--muted)" stroke-width="1.25"/>` +
      cardLetter(sx, fkY, rightward ? 1 : -1, card.fromMany) +
      cardLetter(tx, pkY, rightward ? -1 : 1, card.toMany) +
      `</g>`;

    if (r.label !== undefined && r.label !== '') {
      const w = Math.round(r.label.length * CH + 8);
      const cy = (fkY + pkY) / 2;
      labels.push(
        `<rect x="${round(midX - w / 2)}" y="${round(cy - 7)}" width="${w}" height="14" fill="var(--paper)"/>` +
          `<text x="${round(midX)}" y="${round(cy + 3.5)}" class="t-arrow er-rel" text-anchor="middle">${escapeHtml(r.label.toUpperCase())}</text>`,
      );
    }
  });
  s += `</g>`; // close the relations list container

  // Entity cards.
  let hasPk = false;
  let hasFk = false;
  let hasJoin = false;
  s += `<g${bl('entities')}>`;
  for (const [bi, b] of boxes.entries()) {
    const p = at.get(b.name);
    if (!p) continue;
    const { x, y } = p;
    const root = b.name === rootName;
    const eyebrow = root ? 'AGGREGATE ROOT' : b.join ? 'JOIN' : 'ENTITY';
    if (b.join && !root) hasJoin = true;
    const stroke = root ? 'var(--accent)' : 'var(--ink)';
    const fill = root ? 'var(--accent-tint)' : 'var(--paper)';
    s +=
      `<g${bp(`entities.${bi}`)}>` +
      `<rect x="${round(x)}" y="${round(y)}" width="${b.w}" height="${b.h}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>` +
      `<text x="${round(x + 12)}" y="${round(y + 15)}" class="er-eyebrow t-eyebrow${root ? ' c-accent' : ''}">${eyebrow}</text>` +
      `<text x="${round(x + 12)}" y="${round(y + 31)}" class="er-head-text t-name">${escapeHtml(b.name)}</text>` +
      `<line x1="${round(x)}" y1="${round(y + HEAD_H)}" x2="${round(x + b.w)}" y2="${round(y + HEAD_H)}" class="er-headline"/>`;

    s += `<g${bl(`entities.${bi}.columns`)}>`;
    b.rows.forEach((f, j) => {
      const rowTop = y + HEAD_H + j * ROW_H;
      const ty = rowTop + 14;
      s += `<g${bp(`entities.${bi}.columns.${j}`)}>`;
      if (j > 0) {
        s += `<line x1="${round(x + 1)}" y1="${round(rowTop)}" x2="${round(x + b.w - 1)}" y2="${round(rowTop)}" class="er-rowline"/>`;
      }
      const nameX = x + 24;
      if (f.pk === true) {
        hasPk = true;
        s += `<text x="${round(x + 12)}" y="${round(ty)}" class="er-key pk t-sub c-muted">#</text>`;
      } else if (f.fk === true) {
        hasFk = true;
        s += `<text x="${round(x + 12)}" y="${round(ty)}" class="er-key fk t-sub c-muted">→</text>`;
      }
      // The 300px width clamp can leave very long name+type pairs short of
      // room — ellipsize the NAME into the space the type doesn't use (the
      // full name stays available as a hover <title>), so the two never touch.
      const typePx = (f.type?.length ?? 0) * CH;
      const nameBudget = Math.floor((x + b.w - 12 - typePx - 10 - nameX) / CH);
      const nameCut = f.name.length > nameBudget && nameBudget > 1;
      const nameShown = nameCut ? `${f.name.slice(0, nameBudget - 1)}…` : f.name;
      const nameTitle = nameCut ? `<title>${escapeHtml(f.name)}</title>` : '';
      s +=
        `<text x="${round(nameX)}" y="${round(ty)}" class="er-col t-sub c-ink">${nameTitle}${escapeHtml(nameShown)}</text>` +
        `<text x="${round(x + b.w - 12)}" y="${round(ty)}" class="er-col dim t-sub c-soft" text-anchor="end">${escapeHtml(f.type ?? '')}</text>`;
      s += `</g>`;
    });
    s += `</g>`;

    if (b.hidden > 0) {
      const rowTop = y + HEAD_H + b.rows.length * ROW_H;
      s +=
        `<line x1="${round(x + 1)}" y1="${round(rowTop)}" x2="${round(x + b.w - 1)}" y2="${round(rowTop)}" class="er-rowline"/>` +
        `<text x="${round(x + b.w / 2)}" y="${round(rowTop + 14)}" class="er-col dim t-sub c-soft" text-anchor="middle">… +${b.hidden} more</text>`;
    }
    s += `</g>`;
  }
  s += `</g>`; // close the entities list container

  s += labels.join(''); // relation labels on top of boxes + lines
  s += `</svg>`;

  const items: LegendItem[] = [];
  if (hasPk) items.push({ swatch: 'chip', chip: '#', label: 'primary key' });
  if (hasFk) items.push({ swatch: 'chip', chip: '→', label: 'foreign key' });
  if (hasCard) items.push({ swatch: 'chip', chip: '1 / N', label: 'cardinality' });
  if (hasJoin) items.push({ swatch: 'chip', chip: 'JOIN', label: 'join table' });
  if (rootName !== undefined) items.push({ swatch: 'node-accent', label: 'aggregate root' });
  const legend = renderLegend(items);

  const opts: Parameters<typeof diagramFrame>[0] = {
    tag: 'ER',
    ...(data.title !== undefined ? { title: data.title } : {}),
    ...(data.description !== undefined ? { desc: data.description } : {}),
    ...(legend.length > 0 ? { legendHtml: legend } : {}),
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

/** Splits a `card` value ('1:N', 'N:1', '1:1', 'N:M') into per-end multiplicity.
 *  Defaults to many → one (the typical FK → PK shape) when absent. */
function parseCard(card: string | undefined): { fromMany: boolean; toMany: boolean } {
  if (card === undefined) return { fromMany: true, toMany: false };
  const parts = card.split(':');
  const many = (p: string | undefined): boolean => p !== undefined && p.trim().toUpperCase() !== '1';
  return { fromMany: many(parts[0]), toMany: many(parts[1]) };
}

/**
 * The cardinality letter at a box edge (bx, y): `N` for many, `1` for one,
 * 10px in from the entity edge along the line and 4px above it — both ends on
 * the same side of the line.
 */
function cardLetter(bx: number, y: number, outward: number, many: boolean): string {
  const tx = bx + outward * 10;
  const anchor = outward > 0 ? 'start' : 'end';
  return `<text x="${round(tx)}" y="${round(y - 4)}" class="t-arrow er-card" text-anchor="${anchor}">${many ? 'N' : '1'}</text>`;
}

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));
const round = (n: number): number => Math.round(n * 10) / 10;
