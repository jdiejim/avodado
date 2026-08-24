/**
 * Renders a generic node-link graph — rounded pills colored by group, with
 * orthogonal edges (directed or undirected).
 *
 * Ported from doc-studio.jsx `Graph`.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { edgeLanes, entryPortOffsets, ortho } from '../svg/ortho.js';
import { edgeLabelLayer, type EdgeLabelPoint } from '../svg/edgeSteps.js';
import { gridMetaAttrs, nodeCellAttrs } from '../svg/gridMeta.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';
import { ensureGrid } from './autoLayout.js';

const CHART_COLORS = ['#0e54a1', '#1a6dbe', '#0f766e', '#1f9747', '#6b21a8', '#f7952c'];

/** Fill / stroke / text for an algorithm-walkthrough node `state`. */
const STATE_STYLE: Record<'visited' | 'current' | 'frontier' | 'target', {
  fill: string;
  stroke: string;
  text: string;
}> = {
  visited: { fill: 'var(--light-blue)', stroke: 'var(--navy)', text: 'var(--navy)' },
  current: { fill: 'var(--navy)', stroke: 'var(--navy)', text: '#fff' },
  frontier: { fill: 'var(--highlight-soft)', stroke: 'var(--highlight)', text: 'var(--highlight)' },
  target: { fill: 'var(--positive-soft)', stroke: 'var(--positive)', text: 'var(--positive)' },
};

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
  s += `<g${bl('edges')}>`;
  edges.forEach((e, ei) => {
    const A = byId.get(e.from);
    const B = byId.get(e.to);
    if (!A || !B) return;
    const p = ortho(rectFor(A), rectFor(B), lanes[ei] ?? 0, entries[ei] ?? 0);
    const directed = (e.dir ?? 'directed') !== 'undirected';
    const markerAttr = directed ? ` marker-end="url(#gArrow)"` : '';
    s += `<path d="${p.d}" fill="none" stroke="var(--gray)" stroke-width="1.4"${markerAttr}${bp(`edges.${ei}`)}/>`;
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

  s += `<g${bl('nodes')}>`;
  nodes.forEach((n, ni) => {
    const r = rectFor(n);
    const c = CHART_COLORS[(n.group ?? 0) % CHART_COLORS.length] ?? '#0e54a1';
    // `state` (algorithm walkthroughs) overrides the group colouring.
    const st = n.state !== undefined ? STATE_STYLE[n.state] : undefined;
    const fill = st?.fill ?? '#fff';
    const stroke = st?.stroke ?? c;
    const text = st?.text ?? c;
    s +=
      `<g filter="url(#gshadow)"${bp(`nodes.${ni}`)}${nodeCellAttrs(n.col, n.row)}>` +
      `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="20" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/>` +
      `<text x="${r.cx}" y="${r.cy + 4}" class="blk-name" fill="${text}" text-anchor="middle" style="font-size:12px">${escapeHtml(n.label.length > 21 ? `${n.label.slice(0, 20)}…` : n.label)}</text>` +
      `</g>`;
  });
  s += `</g>`;

  const { overlay, legend } = edgeLabelLayer(pending, nodes.map((n) => rectFor(n)));
  s += overlay; // labels on top, never crossed by a line
  s += `</svg>`;
  return diagramFrame(
    {
      tag: 'GRAPH',
      tagBg: '#374151',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
    },
    s + legend,
  );
}
