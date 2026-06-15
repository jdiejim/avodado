/**
 * Renders an entity-relationship diagram as inline SVG.
 *
 * Doc-studio variant: column flags are booleans (`pk`, `fk`) rather than the
 * string enum `key: 'PK'|'FK'`. Relations may carry `label` and a cardinality
 * marker `card: '1:1'|'1:N'|'N:M'` (rendered as a centered chip).
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { diagramFrame } from './frame.js';

type ErdData = BlockDataMap['erd'];
type ErdEntity = NonNullable<ErdData['entities']>[number];
type ErdColumn = NonNullable<ErdEntity['columns']>[number];

interface EntityBox {
  readonly name: string;
  readonly columns: readonly ErdColumn[];
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export function renderErd(data: BlockDataMap['erd']): string {
  const ents = data.entities ?? [];
  const rels = data.relations ?? [];

  const colW = 200;
  const rowH = 22;
  const headH = 30;
  const gapX = 80;
  const top = 14;
  const pad = 16;

  let x = pad;
  let maxH = 0;
  const boxes: EntityBox[] = ents.map((e) => {
    const cols = e.columns ?? [];
    const h = headH + cols.length * rowH + 10;
    const box: EntityBox = { name: e.name, columns: cols, x, y: top, w: colW, h };
    x += colW + gapX;
    if (h > maxH) maxH = h;
    return box;
  });

  const W = pad * 2 + ents.length * colW + Math.max(0, ents.length - 1) * gapX;
  const H = top + maxH + 24;

  const byName = new Map<string, EntityBox>();
  for (const b of boxes) byName.set(b.name, b);

  let s =
    `<svg viewBox="0 0 ${W} ${H}" role="img">` +
    `<title>Entity-relationship diagram</title>`;

  // Vertical centre of a column's row (or the box's header area if idx < 0).
  const rowCenterY = (box: EntityBox, idx: number): number =>
    idx < 0 ? box.y + 24 : box.y + headH + 16 + idx * rowH - 4;

  // Relations (drawn first so boxes sit on top). Each connects the foreign-key
  // column in `from` to the primary-key column in `to`, with the arrowhead
  // pointing into the PK (FK → PK).
  for (const r of rels) {
    const a = byName.get(r.from);
    const b = byName.get(r.to);
    if (!a || !b) continue;

    const fkIdx = pickFkIndex(a.columns, r.to);
    const pkIdx = b.columns.findIndex((c) => c.pk === true);
    const y1 = rowCenterY(a, fkIdx);
    const y2 = rowCenterY(b, pkIdx);

    // Exit/enter on the sides that face each other.
    const aLeftOfB = a.x + a.w / 2 <= b.x + b.w / 2;
    const x1 = aLeftOfB ? a.x + a.w : a.x;
    const x2 = aLeftOfB ? b.x : b.x + b.w;
    const mx = (x1 + x2) / 2;
    const dir = aLeftOfB ? 1 : -1; // arrowhead points toward `to`

    s +=
      `<path d="M${x1},${y1} H${mx} V${y2} H${x2}" fill="none" stroke="var(--gray)" stroke-width="1.5"/>` +
      // small dot marks the FK origin
      `<circle cx="${x1}" cy="${y1}" r="2.6" fill="var(--gray)"/>` +
      // arrowhead into the PK
      `<path d="M${x2 - 9 * dir},${y2 - 6} L${x2},${y2} L${x2 - 9 * dir},${y2 + 6}" fill="none" stroke="var(--navy)" stroke-width="1.6" stroke-linejoin="round"/>`;

    if (r.card !== undefined) {
      const w = 30;
      const cy = (y1 + y2) / 2;
      s +=
        `<rect x="${mx - w / 2}" y="${cy - 9}" width="${w}" height="18" rx="9" fill="var(--white)" stroke="var(--rule)"/>` +
        `<text x="${mx}" y="${cy + 3}" class="edge-label">${escapeHtml(r.card)}</text>`;
    }
  }

  // Entity boxes
  for (const b of boxes) {
    s +=
      `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="4" fill="var(--white)" stroke="var(--navy)"/>` +
      `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${headH}" rx="4" fill="var(--navy)"/>` +
      `<rect x="${b.x}" y="${b.y + headH - 4}" width="${b.w}" height="4" fill="var(--navy)"/>` +
      `<text x="${b.x + b.w / 2}" y="${b.y + 20}" class="er-head-text">${escapeHtml(b.name)}</text>`;
    b.columns.forEach((f, j) => {
      const fy = b.y + headH + 16 + j * rowH;
      const nameX = f.pk === true || f.fk === true ? b.x + 38 : b.x + 12;
      if (j > 0) {
        s += `<line x1="${b.x}" y1="${fy - 14}" x2="${b.x + b.w}" y2="${fy - 14}" class="er-rowline"/>`;
      }
      if (f.pk === true) {
        s += `<text x="${b.x + 12}" y="${fy}" class="er-key">PK</text>`;
      } else if (f.fk === true) {
        s += `<text x="${b.x + 12}" y="${fy}" class="er-key fk">FK</text>`;
      }
      s +=
        `<text x="${nameX}" y="${fy}" class="er-col">${escapeHtml(f.name)}</text>` +
        `<text x="${b.x + b.w - 12}" y="${fy}" class="er-col dim" text-anchor="end">${escapeHtml(f.type ?? '')}</text>`;
    });
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

/**
 * Picks which foreign-key column in `columns` a relation to `toName` originates
 * from. Prefers an FK whose name references the target entity (e.g. `user_id`
 * for a relation to `User`/`Users`); otherwise the first FK column; -1 if none.
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
