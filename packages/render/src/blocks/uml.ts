/**
 * Renders a UML class diagram — class boxes with stereotype, name, attributes,
 * and methods compartments; orthogonal-routed relationships with kind-specific
 * markers (inheritance triangle, composition diamond, etc.).
 *
 * Ported from doc-studio.jsx `UMLDiagram` + `umlRel`.
 */

import dagre from '@dagrejs/dagre';
import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { edgePill } from '../svg/edgePill.js';
import { roundedPath } from '../svg/shapes.js';
import { diagramFrame } from './frame.js';

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
  const classes = data.classes ?? [];
  const rels = data.rels ?? [];
  const colW = 144;
  const rowH = 14;
  const headH = (c: UmlClass): number => 22 + (c.stereotype !== undefined ? 10 : 0);
  const compH = (list: readonly string[] | undefined): number =>
    (list !== undefined && list.length > 0 ? list.length * rowH : 6) + 8;
  const clsH = (c: UmlClass): number => headH(c) + compH(c.attrs) + compH(c.methods);

  const byId = new Map(classes.map((c) => [c.id, c]));
  const validRels = rels.filter((rl) => byId.has(rl.from) && byId.has(rl.to));

  // Lay the classes out with dagre using their real sizes, then route edges
  // through dagre's points (smooth, non-overlapping) — same approach as the ERD.
  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setGraph({ rankdir: 'TB', nodesep: 46, ranksep: 58, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const c of classes) g.setNode(c.id, { width: colW, height: clsH(c) });
  validRels.forEach((rl, i) => g.setEdge(rl.from, rl.to, {}, `e${i}`));
  dagre.layout(g);

  const graph = g.graph();
  const width = Math.ceil(graph.width ?? 0);
  const height = Math.ceil(graph.height ?? 0);
  const at = new Map<string, { x: number; y: number }>();
  for (const c of classes) {
    const n = g.node(c.id) as { x: number; y: number } | undefined;
    if (n !== undefined) at.set(c.id, { x: n.x - colW / 2, y: n.y - clsH(c) / 2 });
  }

  let s =
    `<svg viewBox="0 0 ${width} ${height}" role="img"><title>UML class diagram</title>` +
    `<defs>` +
    `<marker id="umlTri" viewBox="0 0 14 14" refX="13" refY="7" markerWidth="13" markerHeight="13" markerUnits="userSpaceOnUse" orient="auto-start-reverse">` +
    `<path d="M1,1 L13,7 L1,13 z" fill="var(--white)" stroke="var(--charcoal)" stroke-width="1.2"/></marker>` +
    `<marker id="umlDiaF" viewBox="0 0 20 12" refX="19" refY="6" markerWidth="11" markerHeight="7" markerUnits="userSpaceOnUse" orient="auto-start-reverse">` +
    `<path d="M1,6 L10,1 L19,6 L10,11 z" fill="var(--charcoal)"/></marker>` +
    `<marker id="umlDiaH" viewBox="0 0 20 12" refX="19" refY="6" markerWidth="11" markerHeight="7" markerUnits="userSpaceOnUse" orient="auto-start-reverse">` +
    `<path d="M1,6 L10,1 L19,6 L10,11 z" fill="var(--white)" stroke="var(--charcoal)" stroke-width="1.2"/></marker>` +
    `<marker id="umlOpen" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="12" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto-start-reverse">` +
    `<path d="M1,1 L11,6 L1,11" fill="none" stroke="var(--charcoal)" stroke-width="1.3"/></marker>` +
    `</defs>`;

  const labels: string[] = [];
  validRels.forEach((rl, i) => {
    const e = g.edge(rl.from, rl.to, `e${i}`) as { points?: Array<{ x: number; y: number }> } | undefined;
    const pts = e?.points;
    if (pts === undefined || pts.length < 2) return;
    const st = umlRel(rl.kind);
    const start = st.start !== undefined ? ` marker-start="url(#${st.start})"` : '';
    const end = st.end !== undefined ? ` marker-end="url(#${st.end})"` : '';
    s += `<path d="${roundedPath(pts, 9)}" fill="none" stroke="var(--charcoal)" stroke-width="1.3" stroke-dasharray="${st.dash}"${start}${end}/>`;
    if (rl.label !== undefined && rl.label !== '') {
      const mid = pts[Math.floor(pts.length / 2)];
      if (mid !== undefined) labels.push(edgePill({ lx: mid.x, ly: mid.y }, rl.label));
    }
  });

  for (const c of classes) {
    const p = at.get(c.id);
    if (p === undefined) continue;
    const r = { x: p.x, y: p.y, w: colW, h: clsH(c) };
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
      `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="3" fill="var(--white)" stroke="var(--navy)" stroke-width="1.3"/>` +
      stereo +
      `<text x="${r.x + r.w / 2}" y="${nameY}" class="uml-name">${escapeHtml(c.name)}</text>` +
      `<line x1="${r.x}" y1="${r.y + hh}" x2="${r.x + r.w}" y2="${r.y + hh}" class="uml-sep"/>` +
      attrs +
      `<line x1="${r.x}" y1="${r.y + hh + aH}" x2="${r.x + r.w}" y2="${r.y + hh + aH}" class="uml-sep"/>` +
      methods +
      `</g>`;
  }

  s += labels.join(''); // labels on top, never crossed by a line
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
