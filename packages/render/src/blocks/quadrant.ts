/**
 * Renders a 2x2 matrix — labelled axes, optional low/high endpoint labels,
 * and dots for each `(x, y, label)` item.
 *
 * Ported from doc-studio.jsx `Quadrant`.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { diagramFrame } from './frame.js';

function clamp01(v: number | undefined): number {
  if (v === undefined || Number.isNaN(v)) return 0.5;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

export function renderQuadrant(data: BlockDataMap['quadrant']): string {
  const W = 580;
  const H = 440;
  const pad = 56;
  const x0 = pad;
  const x1 = W - pad;
  const y0 = pad - 16;
  const y1 = H - pad;
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  const px = (v: number | undefined): number => x0 + (x1 - x0) * clamp01(v);
  const py = (v: number | undefined): number => y1 - (y1 - y0) * clamp01(v);
  const items = data.items ?? [];
  const xA = data.xAxis ?? {};
  const yA = data.yAxis ?? {};

  let s = `<svg viewBox="0 0 ${W} ${H}" role="img"><title>Quadrant</title>`;
  s += `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="#fafbfc" stroke="#e5e7eb"/>`;
  s += `<rect x="${mx}" y="${y0}" width="${x1 - mx}" height="${my - y0}" fill="#0e54a1" fill-opacity="0.04"/>`;
  s += `<line x1="${x0}" y1="${my}" x2="${x1}" y2="${my}" class="quad-axis" marker-end="url(#gArrow)"/>`;
  s += `<line x1="${mx}" y1="${y1}" x2="${mx}" y2="${y0}" class="quad-axis" marker-end="url(#gArrow)"/>`;

  if (xA.label !== undefined)
    s += `<text x="${x1}" y="${y1 + 30}" class="quad-title" text-anchor="end">${escapeHtml(xA.label)} →</text>`;
  if (yA.label !== undefined)
    s += `<text x="${mx - 8}" y="${y0 - 4}" class="quad-title" text-anchor="end">↑ ${escapeHtml(yA.label)}</text>`;
  if (xA.low !== undefined)
    s += `<text x="${x0}" y="${y1 + 16}" class="quad-end" text-anchor="start">${escapeHtml(xA.low)}</text>`;
  if (xA.high !== undefined)
    s += `<text x="${x1}" y="${y1 + 16}" class="quad-end" text-anchor="end">${escapeHtml(xA.high)}</text>`;
  if (yA.high !== undefined)
    s += `<text x="${x0 - 10}" y="${y0 + 6}" class="quad-end" text-anchor="end">${escapeHtml(yA.high)}</text>`;
  if (yA.low !== undefined)
    s += `<text x="${x0 - 10}" y="${y1}" class="quad-end" text-anchor="end">${escapeHtml(yA.low)}</text>`;

  for (const it of items) {
    const cx = px(it.x);
    const cy = py(it.y);
    const left = cx > mx;
    const tx = cx + (left ? -12 : 12);
    const anchor = left ? 'end' : 'start';
    s +=
      `<g filter="url(#gshadow)">` +
      `<circle cx="${cx}" cy="${cy}" r="7" fill="#f7952c" stroke="#fff" stroke-width="1.5"/>` +
      `<text x="${tx}" y="${cy + 4}" class="quad-pt-label" text-anchor="${anchor}">${escapeHtml(it.label)}</text>` +
      `</g>`;
  }

  s += `</svg>`;
  return diagramFrame(
    {
      tag: '2×2',
      tagBg: '#0f766e',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
    },
    s,
  );
}
