/**
 * Renders a UML class diagram — class boxes with stereotype, name, attributes,
 * and methods compartments; orthogonal-routed relationships with kind-specific
 * markers (inheritance triangle, composition diamond, etc.).
 *
 * Skin (`DESIGN.md`): a class is a paper card with an ink outline, the
 * stereotype as an eyebrow over the name, hairline compartment rules and
 * mono member rows. Relations are `muted`; `implements` and `dependency`
 * are the dashed return stroke; the UML heads stay (hollow triangle, filled
 * and hollow diamonds, open arrow) since they carry the relation's meaning.
 *
 * Accent rule: the single class stereotyped `interface` takes the accent —
 * the contract the rest of the model implements. Two or more, or none,
 * means no accent.
 */

import dagre from '@dagrejs/dagre';
import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { edgeLabelLayer, type EdgeLabelPoint } from '../svg/edgeSteps.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { roundedPath } from '../svg/shapes.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';

type UmlClass = NonNullable<BlockDataMap['uml']['classes']>[number];

type RelKind = 'inheritance' | 'implementation' | 'composition' | 'aggregation' | 'dependency' | 'association';

interface UmlRelStyle {
  readonly kind: RelKind;
  readonly dash: string;
  readonly start?: string;
  readonly end?: string;
}

function umlRel(kind: string | undefined): UmlRelStyle {
  switch ((kind ?? 'association').toLowerCase()) {
    case 'inheritance':
    case 'extends':
      return { kind: 'inheritance', dash: '', end: 'umlTri' };
    case 'implementation':
    case 'implements':
      return { kind: 'implementation', dash: '5 4', end: 'umlTri' };
    case 'composition':
      return { kind: 'composition', dash: '', start: 'umlDiaF' };
    case 'aggregation':
      return { kind: 'aggregation', dash: '', start: 'umlDiaH' };
    case 'dependency':
      return { kind: 'dependency', dash: '5 4', end: 'umlOpen' };
    default:
      return { kind: 'association', dash: '', end: 'umlOpen' };
  }
}

const isInterface = (c: UmlClass): boolean =>
  (c.stereotype ?? '').replace(/[«»]/g, '').trim().toLowerCase() === 'interface';

export function renderUml(data: BlockDataMap['uml']): string {
  const classes = data.classes ?? [];
  const rels = data.rels ?? [];
  const rowH = 15;
  // Each class box sizes to its longest member line (clamped) so attrs and
  // method signatures never truncate.
  const wOf = (c: UmlClass): number => {
    const texts = [
      c.name,
      ...(c.stereotype !== undefined ? [`«${c.stereotype}»`] : []),
      ...(c.attrs ?? []),
      ...(c.methods ?? []),
    ];
    const maxLen = Math.max(8, ...texts.map((t) => t.length));
    return Math.min(280, Math.max(150, maxLen * 6.4 + 30));
  };
  const headH = (c: UmlClass): number => (c.stereotype !== undefined ? 38 : 26);
  const compH = (list: readonly string[] | undefined): number =>
    (list !== undefined && list.length > 0 ? list.length * rowH : 6) + 10;
  const clsH = (c: UmlClass): number => headH(c) + compH(c.attrs) + compH(c.methods);

  const byId = new Map(classes.map((c) => [c.id, c]));
  // Keep each relation's original index so data paths address `rels.N` in the
  // authored YAML even when invalid relations are filtered out.
  const validRels = rels
    .map((rl, ri) => ({ rl, ri }))
    .filter(({ rl }) => byId.has(rl.from) && byId.has(rl.to));

  // The accent (see the header comment).
  const interfaces = classes.filter(isInterface);
  const accentId = interfaces.length === 1 ? interfaces[0]?.id : undefined;

  // Lay the classes out with dagre using their real sizes, then route edges
  // through dagre's points (smooth, non-overlapping) — same approach as the ERD.
  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setGraph({ rankdir: 'TB', nodesep: 46, ranksep: 58, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const c of classes) g.setNode(c.id, { width: wOf(c), height: clsH(c) });
  validRels.forEach(({ rl }, i) => g.setEdge(rl.from, rl.to, {}, `e${i}`));
  dagre.layout(g);

  const graph = g.graph();
  const width = Math.ceil(graph.width ?? 0);
  const height = Math.ceil(graph.height ?? 0);
  const at = new Map<string, { x: number; y: number }>();
  for (const c of classes) {
    const n = g.node(c.id) as { x: number; y: number } | undefined;
    if (n !== undefined) at.set(c.id, { x: n.x - wOf(c) / 2, y: n.y - clsH(c) / 2 });
  }

  let s =
    `<svg viewBox="0 0 ${width} ${height}" role="img"><title>UML class diagram</title>` +
    `<defs>` +
    `<marker id="umlTri" viewBox="0 0 14 14" refX="13" refY="7" markerWidth="13" markerHeight="13" markerUnits="userSpaceOnUse" orient="auto-start-reverse">` +
    `<path d="M1,1 L13,7 L1,13 z" fill="var(--paper)" stroke="var(--ink)" stroke-width="1.2"/></marker>` +
    `<marker id="umlDiaF" viewBox="0 0 20 12" refX="19" refY="6" markerWidth="11" markerHeight="7" markerUnits="userSpaceOnUse" orient="auto-start-reverse">` +
    `<path d="M1,6 L10,1 L19,6 L10,11 z" fill="var(--muted)"/></marker>` +
    `<marker id="umlDiaH" viewBox="0 0 20 12" refX="19" refY="6" markerWidth="11" markerHeight="7" markerUnits="userSpaceOnUse" orient="auto-start-reverse">` +
    `<path d="M1,6 L10,1 L19,6 L10,11 z" fill="var(--paper)" stroke="var(--muted)" stroke-width="1.2"/></marker>` +
    `<marker id="umlOpen" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="12" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto-start-reverse">` +
    `<path d="M1,1 L11,6 L1,11" fill="none" stroke="var(--muted)" stroke-width="1.3"/></marker>` +
    `</defs>`;

  const pending: EdgeLabelPoint[] = [];
  const relKinds = new Set<RelKind>();
  s += `<g${bl('rels')}>`;
  validRels.forEach(({ rl, ri }, i) => {
    const e = g.edge(rl.from, rl.to, `e${i}`) as { points?: Array<{ x: number; y: number }> } | undefined;
    const pts = e?.points;
    if (pts === undefined || pts.length < 2) return;
    const st = umlRel(rl.kind);
    relKinds.add(st.kind);
    const start = st.start !== undefined ? ` marker-start="url(#${st.start})"` : '';
    const end = st.end !== undefined ? ` marker-end="url(#${st.end})"` : '';
    const dash = st.dash.length > 0 ? ` stroke-dasharray="${st.dash}"` : '';
    s += `<path d="${roundedPath(pts, 9)}" fill="none" stroke="var(--muted)" stroke-width="1.5"${dash}${start}${end}${bp(`rels.${ri}`)}/>`;
    if (rl.label !== undefined && rl.label !== '') {
      const mid = pts[Math.floor(pts.length / 2)];
      if (mid !== undefined)
        pending.push({ lx: mid.x, ly: mid.y, label: rl.label, path: `rels.${ri}` });
    }
  });
  s += `</g>`; // close the rels list container

  s += `<g${bl('classes')}>`;
  const nodeRects: { x: number; y: number; w: number; h: number }[] = [];
  classes.forEach((c, ci) => {
    const p = at.get(c.id);
    if (p === undefined) return;
    const r = { x: p.x, y: p.y, w: wOf(c), h: clsH(c) };
    nodeRects.push(r);
    const hh = headH(c);
    const aH = compH(c.attrs);
    const accent = c.id === accentId;
    const nameY = r.y + (c.stereotype !== undefined ? 30 : 18);
    const stereo =
      c.stereotype !== undefined
        ? `<text x="${r.x + r.w / 2}" y="${r.y + 14}" class="t-eyebrow${accent ? ' c-accent' : ''}" text-anchor="middle">«${escapeHtml(c.stereotype)}»</text>`
        : '';
    const attrs =
      `<g${bl(`classes.${ci}.attrs`)}>` +
      (c.attrs ?? [])
        .map(
          (a, j) =>
            `<text x="${r.x + 12}" y="${r.y + hh + 15 + j * rowH}" class="t-sub c-ink"${bp(`classes.${ci}.attrs.${j}`)}>${escapeHtml(a)}</text>`,
        )
        .join('') +
      `</g>`;
    const methods =
      `<g${bl(`classes.${ci}.methods`)}>` +
      (c.methods ?? [])
        .map(
          (m, j) =>
            `<text x="${r.x + 12}" y="${r.y + hh + aH + 15 + j * rowH}" class="t-sub c-ink"${bp(`classes.${ci}.methods.${j}`)}>${escapeHtml(m)}</text>`,
        )
        .join('') +
      `</g>`;
    const stroke = accent ? 'var(--accent)' : 'var(--ink)';
    const fill = accent ? 'var(--accent-tint)' : 'var(--paper)';
    s +=
      `<g${bp(`classes.${ci}`)}>` +
      `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>` +
      stereo +
      `<text x="${r.x + r.w / 2}" y="${nameY}" class="t-name${accent ? ' c-accent' : ''}" text-anchor="middle"${bp(`classes.${ci}.name`)}>${escapeHtml(c.name)}</text>` +
      `<line x1="${r.x}" y1="${r.y + hh}" x2="${r.x + r.w}" y2="${r.y + hh}" class="uml-sep"/>` +
      attrs +
      `<line x1="${r.x}" y1="${r.y + hh + aH}" x2="${r.x + r.w}" y2="${r.y + hh + aH}" class="uml-sep"/>` +
      methods +
      `</g>`;
  });
  s += `</g>`; // close the classes list container

  const { overlay, legend: steps } = edgeLabelLayer(pending, nodeRects, { skin: true });
  s += overlay; // labels on top, never crossed by a line
  s += `</svg>`;

  const items: LegendItem[] = [];
  if (relKinds.has('association')) items.push({ swatch: 'edge', label: 'association' });
  if (relKinds.has('inheritance')) items.push({ swatch: 'chip', chip: '△', label: 'inherits' });
  if (relKinds.has('implementation')) items.push({ swatch: 'edge-dashed', label: 'implements' });
  if (relKinds.has('composition')) items.push({ swatch: 'chip', chip: '◆', label: 'composed of' });
  if (relKinds.has('aggregation')) items.push({ swatch: 'chip', chip: '◇', label: 'aggregates' });
  if (relKinds.has('dependency')) items.push({ swatch: 'edge-dashed', label: 'depends on' });
  if (accentId !== undefined) items.push({ swatch: 'node-accent', label: 'interface' });
  const legend = renderLegend(items);

  return diagramFrame(
    {
      tag: 'UML',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legend.length > 0 ? { legendHtml: legend } : {}),
    },
    s + steps,
  );
}
