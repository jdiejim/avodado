/**
 * Renders a generic node-link graph — rounded pills with orthogonal edges
 * (directed or undirected).
 *
 * Skin (`DESIGN.md`): a node is a paper pill with an ink outline. An
 * algorithm-walkthrough `state` travels through fill, dash and an eyebrow
 * chip — `visited` on the inactive fill, `frontier` dashed, `current` and
 * `target` solid — and a `group` number becomes a `G<n>` chip, never a hue.
 *
 * Accent rule: the single `target` node; when there is none, the single
 * `current` node. Two or more candidates, or none, means no accent.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { edgeLanes, entryPortOffsets, ortho } from '../svg/ortho.js';
import { edgeLabelLayer, type EdgeLabelPoint } from '../svg/edgeSteps.js';
import { gridMetaAttrs, nodeCellAttrs } from '../svg/gridMeta.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';
import { ensureGrid } from './autoLayout.js';

type State = 'visited' | 'current' | 'frontier' | 'target';

export function renderGraph(data: BlockDataMap['graph']): string {
  const edges = data.edges ?? [];
  const rawNodes = data.nodes ?? [];
  const quick = !(rawNodes.length > 0 && rawNodes.every((n) => n.col !== undefined && n.row !== undefined));
  const nodes = ensureGrid(rawNodes, edges, 'LR');
  const cellW = 150;
  const cellH = 84;
  const gapX = 44;
  const gapY = 40;
  const padX = 26;
  const padTop = 24;
  const padBot = 20;
  const cols = Math.max(1, ...nodes.map((n) => n.col));
  const rows = Math.max(1, ...nodes.map((n) => n.row));
  const cxOf = (c: number): number => padX + (c - 1) * (cellW + gapX) + cellW / 2;
  const cyOf = (r: number): number => padTop + (r - 1) * (cellH + gapY) + cellH / 2;
  const rectFor = (n: { col: number; row: number; label: string }): {
    x: number;
    y: number;
    w: number;
    h: number;
    cx: number;
    cy: number;
  } => {
    const cx = cxOf(n.col);
    const cy = cyOf(n.row);
    // Clamp the pill so very long labels can't collide with neighbours.
    const w = Math.max(98, Math.min(n.label.length * 8 + 26, cellW + gapX - 10));
    return { x: cx - w / 2, y: cy - 20, w, h: 40, cx, cy };
  };
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const width = padX * 2 + cols * cellW + (cols - 1) * gapX;
  const height = padTop + rows * cellH + (rows - 1) * gapY + padBot;

  // The accent (see the header comment).
  const targets = nodes.filter((n) => n.state === 'target');
  const currents = nodes.filter((n) => n.state === 'current');
  const accentId =
    targets.length === 1 ? targets[0]?.id : targets.length === 0 && currents.length === 1 ? currents[0]?.id : undefined;
  const hasChips = nodes.some((n) => n.state !== undefined || n.group !== undefined);

  // Grid metadata for editors (Avodado Studio drag-to-move / drag-to-connect):
  // inert attrs mirroring the layout constants plus each node's cell below.
  const gridMeta = gridMetaAttrs({ quick, cols, rows, cellW, cellH, gapX, gapY, padX, padTop });
  let s = `<svg viewBox="0 0 ${width} ${height}" role="img"${gridMeta}><title>Graph</title>`;

  const pending: EdgeLabelPoint[] = [];
  const lanes = edgeLanes(edges);
  const entries = entryPortOffsets(edges, (id) => {
    const n = byId.get(id);
    return n !== undefined ? rectFor(n) : undefined;
  });
  let directedUsed = false;
  let undirectedUsed = false;
  s += `<g${bl('edges')}>`;
  edges.forEach((e, ei) => {
    const A = byId.get(e.from);
    const B = byId.get(e.to);
    if (!A || !B) return;
    const p = ortho(rectFor(A), rectFor(B), lanes[ei] ?? 0, entries[ei] ?? 0);
    const directed = (e.dir ?? 'directed') !== 'undirected';
    if (directed) directedUsed = true;
    else undirectedUsed = true;
    const markerAttr = directed ? ` marker-end="url(#skArrow)"` : '';
    s += `<path d="${p.d}" fill="none" stroke="var(--muted)" stroke-width="1.5"${markerAttr}${bp(`edges.${ei}`)}/>`;
    // A weighted edge shows "label · w" (or just the weight when unlabelled).
    const pill =
      e.weight !== undefined
        ? e.label !== undefined && e.label.length > 0
          ? `${e.label} · ${e.weight}`
          : String(e.weight)
        : e.label;
    pending.push({ lx: p.lx, ly: p.ly, ...(pill !== undefined ? { label: pill } : {}), path: `edges.${ei}` });
  });
  s += `</g>`; // close the edges list container (editors add via its chip)

  const statesUsed = new Set<State>();
  let groupsUsed = false;
  s += `<g${bl('nodes')}>`;
  nodes.forEach((n, ni) => {
    const r = rectFor(n);
    const accent = n.id === accentId;
    const st = n.state;
    if (st !== undefined) statesUsed.add(st);
    const inactive = st === 'visited';
    const stroke = accent ? 'var(--accent)' : inactive ? 'var(--rule-solid)' : 'var(--ink)';
    const fill = accent ? 'var(--accent-tint)' : inactive ? 'var(--paper-2)' : 'var(--paper)';
    const sw = accent ? 1.5 : inactive ? 1 : 1.5;
    const dash = st === 'frontier' ? ' stroke-dasharray="4 3"' : '';
    const chipTone = accent ? ' c-accent' : inactive ? ' c-muted' : '';
    const stateChip =
      st !== undefined
        ? `<text x="${r.x + 14}" y="${r.y + 11}" class="t-eyebrow${chipTone}">${st.toUpperCase()}</text>`
        : '';
    let groupChip = '';
    if (n.group !== undefined) {
      groupsUsed = true;
      groupChip = `<text x="${r.x + r.w - 14}" y="${r.y + 11}" class="t-eyebrow${chipTone}" text-anchor="end">G${n.group}</text>`;
    }
    const nameY = r.cy + 4 + (hasChips ? 3 : 0);
    s +=
      `<g${bp(`nodes.${ni}`)}${nodeCellAttrs(n.col, n.row)}>` +
      `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="20" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dash}/>` +
      stateChip +
      groupChip +
      `<text x="${r.cx}" y="${nameY}" class="t-name${accent ? ' c-accent' : ''}" text-anchor="middle">${escapeHtml(n.label.length > 21 ? `${n.label.slice(0, 20)}…` : n.label)}</text>` +
      `</g>`;
  });
  s += `</g>`;

  const { overlay, legend: steps } = edgeLabelLayer(pending, nodes.map((n) => rectFor(n)), { skin: true });
  s += overlay; // labels on top, never crossed by a line
  s += `</svg>`;

  const items: LegendItem[] = [];
  if (nodes.some((n) => n.state === undefined)) items.push({ swatch: 'node', label: 'node' });
  if (statesUsed.has('visited')) items.push({ swatch: 'node-fill2', label: 'visited' });
  if (statesUsed.has('frontier')) items.push({ swatch: 'node-dashed', label: 'frontier' });
  if (statesUsed.has('current')) items.push({ swatch: 'chip', chip: 'CURRENT', label: 'current' });
  if (statesUsed.has('target')) items.push({ swatch: 'chip', chip: 'TARGET', label: 'target' });
  if (groupsUsed) items.push({ swatch: 'chip', chip: 'G1', label: 'group' });
  if (directedUsed) items.push({ swatch: 'edge', label: 'edge' });
  if (undirectedUsed) items.push({ swatch: 'edge', label: 'undirected (no head)' });
  if (accentId !== undefined) {
    items.push({ swatch: 'node-accent', label: targets.length === 1 ? 'target' : 'current' });
  }
  const legend = renderLegend(items);

  return diagramFrame(
    {
      tag: 'GRAPH',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legend.length > 0 ? { legendHtml: legend } : {}),
    },
    s + steps,
  );
}
