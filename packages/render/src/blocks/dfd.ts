/**
 * Renders a data-flow diagram — process bubbles, external rectangles, and
 * three-sided data-store boxes, with orthogonal edges.
 *
 * Ported from doc-studio.jsx `DFDDiagram` + `dfdStyle`.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { edgeLanes, ortho } from '../svg/ortho.js';
import { wrapText } from '../svg/wrapText.js';
import { edgeLabelLayer, type EdgeLabelPoint } from '../svg/edgeSteps.js';
import { GROUP_PADS, gridGroupsSvg, groupExtent } from '../svg/gridGroups.js';
import { gridMetaAttrs, nodeCellAttrs } from '../svg/gridMeta.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';
import { ensureGrid } from './autoLayout.js';

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
  const edges = data.edges ?? [];
  const rawNodes = data.nodes ?? [];
  const quick = !(rawNodes.length > 0 && rawNodes.every((n) => n.col !== undefined && n.row !== undefined));
  const nodes = ensureGrid(rawNodes, edges, 'LR');
  const cellW = 148;
  // Long names wrap (word-aware, ≤3 lines) inside the shape; the cell grows
  // uniformly per extra line so wrapped labels never spill or collide.
  const nameLines = nodes.map((n) => wrapText(n.name, 20, 3));
  const maxLines = Math.max(1, ...nameLines.map((ls) => ls.length));
  const cellH = 66 + (maxLines - 1) * 14;
  const gapX = 104;
  const gapY = 54;
  const groups = data.groups ?? [];
  // Group outlines overshoot their cells (label headroom): grow the padding
  // to fit them ONLY when groups exist, so group-less docs stay byte-identical.
  const padX = groups.length > 0 ? GROUP_PADS.padX : 26;
  const padTop = groups.length > 0 ? GROUP_PADS.padTop : 26;
  const padBot = groups.length > 0 ? GROUP_PADS.padBot : 20;
  const gx = groupExtent(groups);
  const cols = Math.max(1, ...nodes.map((n) => n.col), gx.cols);
  const rows = Math.max(1, ...nodes.map((n) => n.row), gx.rows);
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

  // Grid metadata for editors (Avodado Studio drag-to-connect): inert attrs
  // mirroring the layout constants plus each node's effective cell below.
  const gridMeta = gridMetaAttrs({ quick, cols, rows, cellW, cellH, gapX, gapY, padX, padTop });
  let s = `<svg viewBox="0 0 ${width} ${height}" role="img"${gridMeta}><title>Data-flow diagram</title>`;

  // Dashed group zones — beneath edges and nodes. Only emitted when present,
  // keeping group-less documents byte-identical to the pre-groups output.
  if (groups.length > 0) s += gridGroupsSvg(groups, { xOf, yOf, cellW, cellH, gapX, gapY });

  const pending: EdgeLabelPoint[] = [];
  const lanes = edgeLanes(edges);
  s += `<g${bl('edges')}>`;
  edges.forEach((e, ei) => {
    const A = byId.get(e.from);
    const B = byId.get(e.to);
    if (!A || !B) return;
    const p = ortho(rectFor(A), rectFor(B), lanes[ei] ?? 0);
    s += `<path d="${p.d}" fill="none" stroke="var(--charcoal)" stroke-width="1.4" marker-end="url(#gArrow)"${bp(`edges.${ei}`)}/>`;
    pending.push({ lx: p.lx, ly: p.ly, ...(e.label !== undefined ? { label: e.label } : {}), path: `edges.${ei}` });
  });
  s += `</g>`; // close the edges list container (editors add via its chip)

  s += `<g${bl('nodes')}>`;
  nodes.forEach((n, ni) => {
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
        ? `<text x="${r.x + 12}" y="${r.y + 18}" class="dfd-num" fill="${st.text}"${bp(`nodes.${ni}.num`)}>${escapeHtml(n.num)}</text>`
        : '';
    const lines = nameLines[ni] ?? [];
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const name =
      lines.length <= 1
        ? `<text x="${cx}" y="${cy + 4}" class="dfd-name" fill="${st.text}"${bp(`nodes.${ni}.name`)}>${escapeHtml(n.name)}</text>`
        : `<g${bp(`nodes.${ni}.name`)}>` +
          lines
            .map(
              (ln, j) =>
                `<text x="${cx}" y="${cy + 4 - (lines.length - 1) * 7 + j * 14}" class="dfd-name" fill="${st.text}">${escapeHtml(ln)}</text>`,
            )
            .join('') +
          `</g>`;
    s += `<g filter="url(#gshadow)"${bp(`nodes.${ni}`)}${nodeCellAttrs(n.col, n.row)}>${shape}${num}${name}</g>`;
  });
  s += `</g>`; // close the nodes list container

  const { overlay, legend } = edgeLabelLayer(pending, nodes.map((n) => rectFor(n)));
  s += overlay; // labels on top, never crossed by a line
  s += `</svg>`;
  return diagramFrame(
    {
      tag: 'DFD',
      tagBg: '#0e54a1',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
    },
    s + legend,
  );
}
