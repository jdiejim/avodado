/**
 * Renders a swimlane diagram — horizontal lanes per role with labelled steps
 * in column positions, plus orthogonal links between steps.
 *
 * Ported from doc-studio.jsx `Swimlane` + `laneColor`.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { ortho } from '../svg/ortho.js';
import { wrapText } from '../svg/wrapText.js';
import { edgePill } from '../svg/edgePill.js';
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
  const laneH = 92;
  const colW = 168;
  const gapCol = 34;
  const boxW = 150;
  const boxH = 52;
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

  let s = `<svg viewBox="0 0 ${width} ${height}" role="img"><title>Swimlane</title>`;

  for (let i = 0; i < lanes.length; i++) {
    const L = lanes[i];
    if (L === undefined) continue;
    s +=
      `<g>` +
      `<rect x="${padX}" y="${yLane(i)}" width="${width - padX * 2}" height="${laneH}" fill="${i % 2 ? '#fafafa' : '#fff'}" stroke="#e5e7eb"/>` +
      `<rect x="${padX}" y="${yLane(i)}" width="${labelW}" height="${laneH}" fill="#0e54a1"/>` +
      `<text x="${padX + 14}" y="${yLane(i) + laneH / 2 + 4}" class="sl-lane-label">${escapeHtml(L.label)}</text>` +
      `</g>`;
  }

  for (const lk of links) {
    const A = byId.get(lk.from);
    const B = byId.get(lk.to);
    if (!A || !B) continue;
    const p = ortho(rectFor(A), rectFor(B));
    s +=
      `<g><path d="${p.d}" fill="none" stroke="#1a1a2e" stroke-width="1.4" marker-end="url(#gArrow)"/>` +
      edgePill(p, lk.label) +
      `</g>`;
  }

  for (const st of steps) {
    const r = rectFor(st);
    const c = laneColor(st.kind);
    const lines = wrapText(st.label, 20, 2);
    const texts = lines
      .map(
        (ln, j) =>
          `<text x="${r.x + r.w / 2}" y="${r.y + r.h / 2 + 4 - (lines.length - 1) * 7 + j * 14}" class="sl-step" fill="${c.text}">${escapeHtml(ln)}</text>`,
      )
      .join('');
    s +=
      `<g filter="url(#gshadow)">` +
      `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="7" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.3"/>` +
      texts +
      `</g>`;
  }

  s += `</svg>`;
  return diagramFrame(
    {
      tag: 'LANES',
      tagBg: '#0e54a1',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
    },
    s,
  );
}
