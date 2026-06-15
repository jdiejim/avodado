/**
 * Renders a generic node-link graph — rounded pills colored by group, with
 * orthogonal edges (directed or undirected).
 *
 * Ported from doc-studio.jsx `Graph`.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { ortho } from '../svg/ortho.js';
import { edgePill } from '../svg/edgePill.js';
import { diagramFrame } from './frame.js';

const CHART_COLORS = ['#0e54a1', '#1a6dbe', '#0f766e', '#1f9747', '#6b21a8', '#f7952c'];

export function renderGraph(data: BlockDataMap['graph']): string {
  const nodes = data.nodes ?? [];
  const edges = data.edges ?? [];
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
    const w = Math.max(98, n.label.length * 8 + 26);
    return { x: cx - w / 2, y: cy - 20, w, h: 40, cx, cy };
  };
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const width = padX * 2 + cols * cellW + (cols - 1) * gapX;
  const height = padTop + rows * cellH + (rows - 1) * gapY + padBot;

  let s = `<svg viewBox="0 0 ${width} ${height}" role="img"><title>Graph</title>`;

  const labels: string[] = [];
  for (const e of edges) {
    const A = byId.get(e.from);
    const B = byId.get(e.to);
    if (!A || !B) continue;
    const p = ortho(rectFor(A), rectFor(B));
    const directed = (e.dir ?? 'directed') !== 'undirected';
    const markerAttr = directed ? ` marker-end="url(#gArrow)"` : '';
    s += `<path d="${p.d}" fill="none" stroke="#6b7280" stroke-width="1.4"${markerAttr}/>`;
    labels.push(edgePill(p, e.label));
  }

  for (const n of nodes) {
    const r = rectFor(n);
    const c = CHART_COLORS[(n.group ?? 0) % CHART_COLORS.length] ?? '#0e54a1';
    s +=
      `<g filter="url(#gshadow)">` +
      `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="20" fill="#fff" stroke="${c}" stroke-width="1.6"/>` +
      `<text x="${r.cx}" y="${r.cy + 4}" class="blk-name" fill="${c}" text-anchor="middle" style="font-size:12px">${escapeHtml(n.label)}</text>` +
      `</g>`;
  }

  s += labels.join(''); // labels on top, never crossed by a line
  s += `</svg>`;
  return diagramFrame(
    {
      tag: 'GRAPH',
      tagBg: '#374151',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
    },
    s,
  );
}
