/**
 * Renders a flowchart — decision diamonds, stadium start/end nodes, rectangles
 * for processes, with orthogonal edges and error-coloured paths.
 *
 * Ported from doc-studio.jsx `Flowchart` + `flowStyle`.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { ortho } from '../svg/ortho.js';
import { wrapText } from '../svg/wrapText.js';
import { edgePill } from '../svg/edgePill.js';
import { diagramFrame } from './frame.js';

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
      return { shape: 'stadium', fill: '#1a1a2e', stroke: '#1a1a2e', text: '#fff' };
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

/** Generates the inner SVG (no diagram frame) — shared by `flow` and `dag`. */
export function renderFlowSvg(data: BlockDataMap['flow']): string {
  const nodes = data.nodes ?? [];
  const edges = data.edges ?? [];
  const cellW = 176;
  const cellH = 70;
  const gapX = 60;
  const gapY = 56;
  const padX = 26;
  const padTop = 26;
  const padBot = 22;
  const cols = Math.max(1, ...nodes.map((n) => n.col + ((n.w ?? 1) - 1)));
  const rows = Math.max(1, ...nodes.map((n) => n.row));
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

  let s = `<svg viewBox="0 0 ${width} ${height}" role="img"><title>Flowchart</title>`;

  for (const e of edges) {
    const A = byId.get(e.from);
    const B = byId.get(e.to);
    if (!A || !B) continue;
    const p = ortho(rectFor(A), rectFor(B));
    const isErr = e.kind === 'error' || ERR_LABEL_RE.test(e.label ?? '');
    const stroke = isErr ? '#991b1b' : '#1a1a2e';
    const marker = isErr ? 'gErr' : 'gArrow';
    const sw = isErr ? 1.6 : 1.4;
    s +=
      `<g><path d="${p.d}" fill="none" stroke="${stroke}" stroke-width="${sw}" marker-end="url(#${marker})"/>` +
      edgePill(p, e.label, isErr) +
      `</g>`;
  }

  for (const n of nodes) {
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
    s += `<g filter="url(#gshadow)">${shape}${texts}</g>`;
  }

  s += `</svg>`;
  return s;
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

/** `flow` — decision flow with slate `FLOW` tag. */
export function renderFlow(data: BlockDataMap['flow']): string {
  return renderFlowFrame(data, { tag: 'FLOW', tagBg: '#374151' });
}
/** `dag` — same shape, navy `DAG` tag (pipeline / directed-acyclic graph). */
export function renderDag(data: BlockDataMap['dag']): string {
  return renderFlowFrame(data as BlockDataMap['flow'], { tag: 'DAG', tagBg: '#0e54a1' });
}
