/**
 * Renders a flowchart — decision diamonds, stadium start/end nodes, rectangles
 * for processes, with orthogonal edges and error-coloured paths.
 *
 * Ported from doc-studio.jsx `Flowchart` + `flowStyle`.
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

type Kind = 'start' | 'end' | 'decision' | 'process';
interface Style {
  shape: 'rect' | 'diamond' | 'stadium';
  fill: string;
  stroke: string;
  text: string;
}
function flowStyle(kind: Kind | undefined): Style {
  switch (kind ?? 'process') {
    case 'start':
      return { shape: 'stadium', fill: '#dcf1e2', stroke: '#1f9747', text: '#0f3d22' };
    case 'end':
      return { shape: 'stadium', fill: 'var(--charcoal)', stroke: 'var(--charcoal)', text: '#fff' };
    case 'decision':
      return { shape: 'diamond', fill: '#fde7cd', stroke: '#f7952c', text: '#7a3d00' };
    default:
      return { shape: 'rect', fill: '#e5eff8', stroke: '#0e54a1', text: '#0a3a6e' };
  }
}

const ERR_LABEL_RE = /^(no|fail|error|reject)/i;

interface FlowFrameOpts {
  readonly tag: string;
  readonly tagBg?: string;
}

/** Generates the inner SVG + edge-step legend (no diagram frame) — shared by `flow` and `dag`. */
export function renderFlowSvg(data: BlockDataMap['flow']): string {
  const edges = data.edges ?? [];
  const groups = data.groups ?? [];
  const rawNodes = data.nodes ?? [];
  const quick = !(rawNodes.length > 0 && rawNodes.every((n) => n.col !== undefined && n.row !== undefined));
  const nodes = ensureGrid(rawNodes, edges, 'TB');
  const cellW = 176;
  const cellH = 70;
  const gapX = 60;
  const gapY = 56;
  // Group outlines overshoot their cells (label headroom): grow the padding
  // to fit them ONLY when groups exist, so group-less docs stay byte-identical.
  const padX = groups.length > 0 ? GROUP_PADS.padX : 26;
  const padTop = groups.length > 0 ? GROUP_PADS.padTop : 26;
  const padBot = groups.length > 0 ? GROUP_PADS.padBot : 22;
  const gx = groupExtent(groups);
  const cols = Math.max(1, ...nodes.map((n) => n.col + ((n.w ?? 1) - 1)), gx.cols);
  const rows = Math.max(1, ...nodes.map((n) => n.row), gx.rows);
  const xOf = (c: number): number => padX + (c - 1) * (cellW + gapX);
  const yOf = (r: number): number => padTop + (r - 1) * (cellH + gapY);
  const rectFor = (n: { col: number; row: number; w?: number | undefined }): {
    x: number;
    y: number;
    w: number;
    h: number;
  } => ({
    x: xOf(n.col),
    y: yOf(n.row),
    w: (n.w ?? 1) * cellW + ((n.w ?? 1) - 1) * gapX,
    h: cellH,
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const width = padX * 2 + cols * cellW + (cols - 1) * gapX;
  const height = padTop + rows * cellH + (rows - 1) * gapY + padBot;

  // Grid metadata for editors (Avodado Studio drag-to-connect): inert attrs
  // mirroring the layout constants plus each node's effective cell below.
  const gridMeta = gridMetaAttrs({ quick, cols, rows, cellW, cellH, gapX, gapY, padX, padTop });
  let s = `<svg viewBox="0 0 ${width} ${height}" role="img"${gridMeta}><title>Flowchart</title>`;

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
    const isErr = e.kind === 'error' || ERR_LABEL_RE.test(e.label ?? '');
    const stroke = isErr ? '#991b1b' : 'var(--charcoal)';
    const marker = isErr ? 'gErr' : 'gArrow';
    const sw = isErr ? 1.6 : 1.4;
    s += `<path d="${p.d}" fill="none" stroke="${stroke}" stroke-width="${sw}" marker-end="url(#${marker})"${bp(`edges.${ei}`)}/>`;
    pending.push({ lx: p.lx, ly: p.ly, ...(e.label !== undefined ? { label: e.label } : {}), err: isErr, path: `edges.${ei}` });
  });
  s += `</g>`; // close the edges list container (editors add via its chip)

  s += `<g${bl('nodes')}>`;
  nodes.forEach((n, ni) => {
    const r = rectFor(n);
    const st = flowStyle(n.kind);
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    let shape: string;
    if (st.shape === 'diamond') {
      shape = `<polygon points="${cx},${r.y} ${r.x + r.w},${cy} ${cx},${r.y + r.h} ${r.x},${cy}" fill="${st.fill}" stroke="${st.stroke}" stroke-width="1.5"/>`;
    } else if (st.shape === 'stadium') {
      shape = `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="${r.h / 2}" fill="${st.fill}" stroke="${st.stroke}" stroke-width="1.5"/>`;
    } else {
      shape = `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="7" fill="${st.fill}" stroke="${st.stroke}" stroke-width="1.4"/>`;
    }
    const lines = wrapText(n.label, 22, 2);
    const texts = lines
      .map(
        (ln, j) =>
          `<text x="${cx}" y="${cy + 4 - (lines.length - 1) * 7 + j * 14}" class="fc-label" fill="${st.text}">${escapeHtml(ln)}</text>`,
      )
      .join('');
    s += `<g filter="url(#gshadow)"${bp(`nodes.${ni}`)}${nodeCellAttrs(n.col, n.row, n.w ?? 1)}>${shape}${texts}</g>`;
  });
  s += `</g>`; // close the nodes list container

  const { overlay, legend } = edgeLabelLayer(pending);
  s += overlay; // labels on top, never crossed by a line
  s += `</svg>`;
  return s + legend;
}

function renderFlowFrame(data: BlockDataMap['flow'], frame: FlowFrameOpts): string {
  return diagramFrame(
    {
      tag: frame.tag,
      ...(frame.tagBg !== undefined ? { tagBg: frame.tagBg } : {}),
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
    },
    renderFlowSvg(data),
  );
}

/**
 * `flow` — decision flow with slate `FLOW` tag; `variant: dag` keeps the
 * former `dag` presentation (navy `DAG` tag — pipeline / directed-acyclic graph).
 */
export function renderFlow(data: BlockDataMap['flow']): string {
  return data.variant === 'dag'
    ? renderFlowFrame(data, { tag: 'DAG', tagBg: '#0e54a1' })
    : renderFlowFrame(data, { tag: 'FLOW', tagBg: '#374151' });
}
