/**
 * Renders a UML class diagram — class boxes with stereotype, name, attributes,
 * and methods compartments; orthogonal-routed relationships with kind-specific
 * markers (inheritance triangle, composition diamond, etc.).
 *
 * Ported from doc-studio.jsx `UMLDiagram` + `umlRel`.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { ortho } from '../svg/ortho.js';
import { edgePill } from '../svg/edgePill.js';
import { diagramFrame } from './frame.js';
import { ensureGrid } from './autoLayout.js';

type UmlClass = NonNullable<BlockDataMap['uml']['classes']>[number];

interface UmlRelStyle {
  dash: string;
  start?: string;
  end?: string;
}

function umlRel(kind: string | undefined): UmlRelStyle {
  switch ((kind ?? 'association').toLowerCase()) {
    case 'inheritance':
    case 'extends':
      return { dash: '', end: 'umlTri' };
    case 'implementation':
    case 'implements':
      return { dash: '6 4', end: 'umlTri' };
    case 'composition':
      return { dash: '', start: 'umlDiaF' };
    case 'aggregation':
      return { dash: '', start: 'umlDiaH' };
    case 'dependency':
      return { dash: '6 4', end: 'umlOpen' };
    default:
      return { dash: '', end: 'umlOpen' };
  }
}

export function renderUml(data: BlockDataMap['uml']): string {
  const rels = data.rels ?? [];
  const classes = ensureGrid(data.classes ?? [], rels, 'TB');
  const colW = 204;
  const gapX = 64;
  const gapY = 50;
  const padX = 26;
  const padTop = 30;
  const padBot = 22;
  const rowH = 17;
  const headH = (c: UmlClass): number => 28 + (c.stereotype !== undefined ? 12 : 0);
  const compH = (list: readonly string[] | undefined): number =>
    (list !== undefined && list.length > 0 ? list.length * rowH : 6) + 8;
  const clsH = (c: UmlClass): number => headH(c) + compH(c.attrs) + compH(c.methods);

  const cols = Math.max(1, ...classes.map((c) => c.col));
  const rows = Math.max(1, ...classes.map((c) => c.row));
  const bandH = new Map<number, number>();
  const bandTop = new Map<number, number>();
  let acc = padTop;
  for (let r = 1; r <= rows; r++) {
    const hs = classes.filter((c) => c.row === r).map(clsH);
    const h = hs.length > 0 ? Math.max(...hs) : 60;
    bandH.set(r, h);
    bandTop.set(r, acc);
    acc += h + gapY;
  }
  const xOf = (c: number): number => padX + (c - 1) * (colW + gapX);
  const rectFor = (c: UmlClass & { col: number; row: number }): {
    x: number;
    y: number;
    w: number;
    h: number;
  } => ({
    x: xOf(c.col),
    y: bandTop.get(c.row) ?? padTop,
    w: colW,
    h: clsH(c),
  });
  const byId = new Map(classes.map((c) => [c.id, c]));
  const width = padX * 2 + cols * colW + (cols - 1) * gapX;
  const height = acc - gapY + padBot;

  let s =
    `<svg viewBox="0 0 ${width} ${height}" role="img"><title>UML class diagram</title>` +
    `<defs>` +
    `<marker id="umlTri" viewBox="0 0 14 14" refX="13" refY="7" markerWidth="15" markerHeight="15" orient="auto-start-reverse">` +
    `<path d="M1,1 L13,7 L1,13 z" fill="#fff" stroke="#1a1a2e" stroke-width="1.2"/></marker>` +
    `<marker id="umlDiaF" viewBox="0 0 20 12" refX="19" refY="6" markerWidth="20" markerHeight="12" orient="auto-start-reverse">` +
    `<path d="M1,6 L10,1 L19,6 L10,11 z" fill="#1a1a2e"/></marker>` +
    `<marker id="umlDiaH" viewBox="0 0 20 12" refX="19" refY="6" markerWidth="20" markerHeight="12" orient="auto-start-reverse">` +
    `<path d="M1,6 L10,1 L19,6 L10,11 z" fill="#fff" stroke="#1a1a2e" stroke-width="1.2"/></marker>` +
    `<marker id="umlOpen" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="12" markerHeight="12" orient="auto-start-reverse">` +
    `<path d="M1,1 L11,6 L1,11" fill="none" stroke="#1a1a2e" stroke-width="1.3"/></marker>` +
    `</defs>`;

  for (const rl of rels) {
    const A = byId.get(rl.from);
    const B = byId.get(rl.to);
    if (!A || !B) continue;
    const p = ortho(rectFor(A), rectFor(B));
    const st = umlRel(rl.kind);
    const start = st.start !== undefined ? ` marker-start="url(#${st.start})"` : '';
    const end = st.end !== undefined ? ` marker-end="url(#${st.end})"` : '';
    s +=
      `<g><path d="${p.d}" fill="none" stroke="#1a1a2e" stroke-width="1.3" stroke-dasharray="${st.dash}"${start}${end}/>` +
      edgePill(p, rl.label) +
      `</g>`;
  }

  for (const c of classes) {
    const r = rectFor(c);
    const hh = headH(c);
    const aH = compH(c.attrs);
    const nameY = r.y + (c.stereotype !== undefined ? 24 : 19);
    const stereo =
      c.stereotype !== undefined
        ? `<text x="${r.x + r.w / 2}" y="${r.y + 13}" class="uml-stereo">«${escapeHtml(c.stereotype)}»</text>`
        : '';
    const attrs = (c.attrs ?? [])
      .map(
        (a, j) =>
          `<text x="${r.x + 10}" y="${r.y + hh + 14 + j * rowH}" class="uml-row">${escapeHtml(a)}</text>`,
      )
      .join('');
    const methods = (c.methods ?? [])
      .map(
        (m, j) =>
          `<text x="${r.x + 10}" y="${r.y + hh + aH + 14 + j * rowH}" class="uml-row">${escapeHtml(m)}</text>`,
      )
      .join('');
    s +=
      `<g filter="url(#gshadow)">` +
      `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="3" fill="#fff" stroke="#0e54a1" stroke-width="1.3"/>` +
      stereo +
      `<text x="${r.x + r.w / 2}" y="${nameY}" class="uml-name">${escapeHtml(c.name)}</text>` +
      `<line x1="${r.x}" y1="${r.y + hh}" x2="${r.x + r.w}" y2="${r.y + hh}" class="uml-sep"/>` +
      attrs +
      `<line x1="${r.x}" y1="${r.y + hh + aH}" x2="${r.x + r.w}" y2="${r.y + hh + aH}" class="uml-sep"/>` +
      methods +
      `</g>`;
  }

  s += `</svg>`;
  return diagramFrame(
    {
      tag: 'UML',
      tagBg: '#6b21a8',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
    },
    s,
  );
}
