/**
 * Renders a swimlane diagram — horizontal lanes per role with labelled steps
 * in column positions, plus orthogonal links between steps.
 *
 * Ported from doc-studio.jsx `Swimlane` + `laneColor`.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { edgeLanes, ortho } from '../svg/ortho.js';
import { wrapText } from '../svg/wrapText.js';
import { edgeLabelLayer, type EdgeLabelPoint } from '../svg/edgeSteps.js';
import { gridMetaAttrs, nodeCellAttrs } from '../svg/gridMeta.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';

function laneColor(kind: string | undefined): { fill: string; stroke: string; text: string } {
  switch ((kind ?? 'action').toLowerCase()) {
    case 'decision':
      return { fill: '#fde7cd', stroke: '#f7952c', text: '#7a3d00' };
    case 'start':
    case 'end':
      return { fill: '#dcf1e2', stroke: '#1f9747', text: '#0f3d22' };
    case 'wait':
      return { fill: '#f3f4f6', stroke: '#6b7280', text: '#374151' };
    default:
      return { fill: '#e5eff8', stroke: '#0e54a1', text: '#0a3a6e' };
  }
}

export function renderSwimlane(data: BlockDataMap['swimlane']): string {
  const lanes = data.lanes ?? [];
  const steps = data.steps ?? [];
  const links = data.links ?? [];
  const labelW = 132;
  const padX = 18;
  const padTop = 24;
  const padBot = 20;
  const colW = 168;
  const gapCol = 34;
  const boxW = 150;
  // Long step labels wrap to a third line (instead of silently dropping the
  // tail); boxes and lanes grow uniformly so nothing overlaps.
  const stepLines = steps.map((st) => wrapText(st.label, 20, 3));
  const maxLines = Math.max(1, ...stepLines.map((ls) => ls.length));
  const boxH = 52 + Math.max(0, maxLines - 2) * 14;
  const laneH = 92 + Math.max(0, maxLines - 2) * 14;
  const cols = Math.max(1, ...steps.map((s) => s.col));
  const xCol = (c: number): number => labelW + padX + (c - 1) * (colW + gapCol);
  const yLane = (l: number): number => padTop + l * laneH;
  const rectFor = (s: { col: number; lane: number }): {
    x: number;
    y: number;
    w: number;
    h: number;
  } => ({
    x: xCol(s.col) + (colW - boxW) / 2,
    y: yLane(s.lane) + (laneH - boxH) / 2,
    w: boxW,
    h: boxH,
  });
  const byId = new Map(steps.map((s) => [s.id, s]));
  const width = labelW + padX * 2 + cols * colW + (cols - 1) * gapCol;
  const height = padTop + lanes.length * laneH + padBot;

  // Grid metadata for editors (Avodado Studio drag-to-move / drag-to-connect):
  // the step grid is labelW-offset columns × lanes-as-rows, so the left pad
  // includes the lane-label column and the row pitch is the lane height. Each
  // step's data-row below is its 1-based lane (`lane + 1`) — editors work in
  // row space and write back `lane = row - 1`.
  const gridMeta = gridMetaAttrs({
    quick: false, // col/lane are required — swimlanes are always placed
    cols,
    rows: Math.max(1, lanes.length),
    cellW: colW,
    cellH: laneH,
    gapX: gapCol,
    gapY: 0,
    padX: labelW + padX,
    padTop,
  });
  let s = `<svg viewBox="0 0 ${width} ${height}" role="img"${gridMeta}><title>Swimlane</title>`;

  s += `<g${bl('lanes')}>`;
  for (let i = 0; i < lanes.length; i++) {
    const L = lanes[i];
    if (L === undefined) continue;
    // Wrap the lane label (≤3 lines) so it never spills out of the label column.
    const llines = wrapText(L.label, Math.max(8, Math.floor((labelW - 28) / 6.4)), 3);
    const ltext = llines
      .map(
        (ln, j) =>
          `<text x="${padX + 14}" y="${(yLane(i) + laneH / 2 + 4 - (llines.length - 1) * 8 + j * 16).toFixed(1)}" class="sl-lane-label">${escapeHtml(ln)}</text>`,
      )
      .join('');
    s +=
      `<g${bp(`lanes.${i}`)}>` +
      `<rect x="${padX}" y="${yLane(i)}" width="${width - padX * 2}" height="${laneH}" fill="${i % 2 ? '#fafafa' : '#fff'}" stroke="#e5e7eb"/>` +
      `<rect x="${padX}" y="${yLane(i)}" width="${labelW}" height="${laneH}" fill="var(--navy)"/>` +
      ltext +
      `</g>`;
  }
  s += `</g>`; // close the lanes list container

  const pending: EdgeLabelPoint[] = [];
  const linkLanes = edgeLanes(links);
  s += `<g${bl('links')}>`;
  links.forEach((lk, li) => {
    const A = byId.get(lk.from);
    const B = byId.get(lk.to);
    if (!A || !B) return;
    const p = ortho(rectFor(A), rectFor(B), linkLanes[li] ?? 0);
    s += `<path d="${p.d}" fill="none" stroke="var(--charcoal)" stroke-width="1.4" marker-end="url(#gArrow)"${bp(`links.${li}`)}/>`;
    pending.push({ lx: p.lx, ly: p.ly, ...(lk.label !== undefined ? { label: lk.label } : {}), path: `links.${li}` });
  });
  s += `</g>`; // close the links list container (editors add via its chip)

  s += `<g${bl('steps')}>`;
  steps.forEach((st, si) => {
    const r = rectFor(st);
    const c = laneColor(st.kind);
    const lines = stepLines[si] ?? [];
    const texts = lines
      .map(
        (ln, j) =>
          `<text x="${r.x + r.w / 2}" y="${r.y + r.h / 2 + 4 - (lines.length - 1) * 7 + j * 14}" class="sl-step" fill="${c.text}">${escapeHtml(ln)}</text>`,
      )
      .join('');
    s +=
      `<g filter="url(#gshadow)"${bp(`steps.${si}`)}${nodeCellAttrs(st.col, st.lane + 1)}>` +
      `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="7" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.3"/>` +
      texts +
      `</g>`;
  });
  s += `</g>`; // close the steps list container

  const { overlay, legend } = edgeLabelLayer(pending);
  s += overlay; // labels on top, never crossed by a line
  s += `</svg>`;
  return diagramFrame(
    {
      tag: 'LANES',
      tagBg: '#0e54a1',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
    },
    s + legend,
  );
}
