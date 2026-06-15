/**
 * Renders a data-flow diagram — process bubbles, external rectangles, and
 * three-sided data-store boxes, with orthogonal edges.
 *
 * Ported from doc-studio.jsx `DFDDiagram` + `dfdStyle`.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { ortho } from '../svg/ortho.js';
import { edgePill } from '../svg/edgePill.js';
import { diagramFrame } from './frame.js';

function dfdStyle(kind: string | undefined): { fill: string; stroke: string; text: string } {
  switch ((kind ?? 'process').toLowerCase()) {
    case 'external':
      return { fill: '#f3f4f6', stroke: '#6b7280', text: '#374151' };
    case 'store':
    case 'datastore':
      return { fill: '#fde7cd', stroke: '#f7952c', text: '#7a3d00' };
    default:
      return { fill: '#e5eff8', stroke: '#0e54a1', text: '#0a3a6e' };
  }
}

export function renderDfd(data: BlockDataMap['dfd']): string {
  const nodes = data.nodes ?? [];
  const edges = data.edges ?? [];
  const cellW = 168;
  const cellH = 76;
  const gapX = 60;
  const gapY = 58;
  const padX = 26;
  const padTop = 26;
  const padBot = 20;
  const cols = Math.max(1, ...nodes.map((n) => n.col));
  const rows = Math.max(1, ...nodes.map((n) => n.row));
  const xOf = (c: number): number => padX + (c - 1) * (cellW + gapX);
  const yOf = (r: number): number => padTop + (r - 1) * (cellH + gapY);
  const rectFor = (n: { col: number; row: number }): {
    x: number;
    y: number;
    w: number;
    h: number;
  } => ({ x: xOf(n.col), y: yOf(n.row), w: cellW, h: cellH });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const width = padX * 2 + cols * cellW + (cols - 1) * gapX;
  const height = padTop + rows * cellH + (rows - 1) * gapY + padBot;

  let s = `<svg viewBox="0 0 ${width} ${height}" role="img"><title>Data-flow diagram</title>`;

  for (const e of edges) {
    const A = byId.get(e.from);
    const B = byId.get(e.to);
    if (!A || !B) continue;
    const p = ortho(rectFor(A), rectFor(B));
    s +=
      `<g><path d="${p.d}" fill="none" stroke="#1a1a2e" stroke-width="1.4" marker-end="url(#gArrow)"/>` +
      edgePill(p, e.label) +
      `</g>`;
  }

  for (const n of nodes) {
    const r = rectFor(n);
    const st = dfdStyle(n.kind);
    const k = (n.kind ?? 'process').toLowerCase();
    let shape: string;
    if (k === 'process') {
      shape = `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="16" fill="${st.fill}" stroke="${st.stroke}" stroke-width="1.4"/>`;
    } else if (k === 'store' || k === 'datastore') {
      shape =
        `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${st.fill}" stroke="none"/>` +
        `<line x1="${r.x}" y1="${r.y}" x2="${r.x + r.w}" y2="${r.y}" stroke="${st.stroke}" stroke-width="1.6"/>` +
        `<line x1="${r.x}" y1="${r.y + r.h}" x2="${r.x + r.w}" y2="${r.y + r.h}" stroke="${st.stroke}" stroke-width="1.6"/>` +
        `<line x1="${r.x}" y1="${r.y}" x2="${r.x}" y2="${r.y + r.h}" stroke="${st.stroke}" stroke-width="1.6"/>`;
    } else {
      shape = `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${st.fill}" stroke="${st.stroke}" stroke-width="1.4"/>`;
    }
    const num =
      n.num !== undefined && k === 'process'
        ? `<text x="${r.x + 12}" y="${r.y + 18}" class="dfd-num" fill="${st.text}">${escapeHtml(n.num)}</text>`
        : '';
    s +=
      `<g filter="url(#gshadow)">${shape}${num}` +
      `<text x="${r.x + r.w / 2}" y="${r.y + r.h / 2 + 4}" class="dfd-name" fill="${st.text}">${escapeHtml(n.name)}</text>` +
      `</g>`;
  }

  s += `</svg>`;
  return diagramFrame(
    {
      tag: 'DFD',
      tagBg: '#0e54a1',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
    },
    s,
  );
}
