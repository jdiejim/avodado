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

  // Relations (drawn first so boxes sit on top)
  for (const r of rels) {
    const a = byName.get(r.from);
    const b = byName.get(r.to);
    if (!a || !b) continue;
    const x1 = a.x + a.w;
    const y1 = a.y + 24;
    const x2 = b.x;
    const y2 = b.y + 24;
    const mx = (x1 + x2) / 2;
    s +=
      `<path d="M${x1},${y1} H${mx} V${y2} H${x2}" fill="none" stroke="#8a96a3"/>` +
      `<path d="M${x2 - 11},${y2 - 7} L${x2},${y2} L${x2 - 11},${y2 + 7}" fill="none" stroke="#8a96a3"/>`;
    if (r.card !== undefined) {
      const w = 28;
      s +=
        `<rect x="${mx - w / 2}" y="${(y1 + y2) / 2 - 9}" width="${w}" height="18" rx="9" fill="#fff" stroke="#d1d5db"/>` +
        `<text x="${mx}" y="${(y1 + y2) / 2 + 3}" class="edge-label">${escapeHtml(r.card)}</text>`;
    }
  }

  // Entity boxes
  for (const b of boxes) {
    s +=
      `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="4" fill="#fff" stroke="#0e54a1"/>` +
      `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${headH}" rx="4" fill="#0e54a1"/>` +
      `<rect x="${b.x}" y="${b.y + headH - 4}" width="${b.w}" height="4" fill="#0e54a1"/>` +
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
