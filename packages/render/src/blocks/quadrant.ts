/**
 * Renders a 2x2 matrix — labelled axes, optional low/high endpoint labels,
 * and dots for each `(x, y, label)` item.
 *
 * Skin (`DESIGN.md`): a paper plot with a `rule-solid` edge, `muted` axis
 * arrows through the middle, `.t-eyebrow` axis titles, `.t-sub` endpoint
 * labels, and ink dots with `.t-name` labels. The high/high quadrant sits on
 * `paper-2` so it reads as the target corner without a hue.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';
import { DECORATIVE } from '../svg/decorative.js';

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
  s += `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="var(--paper)" stroke="var(--rule-solid)" stroke-width="1"/>`;
  s += `<rect x="${mx}" y="${y0}" width="${x1 - mx}" height="${my - y0}" fill="var(--paper-2)"/>`;
  s += `<line x1="${x0}" y1="${my}" x2="${x1}" y2="${my}" stroke="var(--muted)" stroke-width="1.25" marker-end="url(#skArrow)"/>`;
  s += `<line x1="${mx}" y1="${y1}" x2="${mx}" y2="${y0}" stroke="var(--muted)" stroke-width="1.25" marker-end="url(#skArrow)"/>`;

  if (xA.label !== undefined)
    s += `<text x="${x1}" y="${y1 + 30}" class="t-eyebrow" text-anchor="end"${bp('xAxis.label')}>${escapeHtml(xA.label)} →</text>`;
  if (yA.label !== undefined)
    s += `<text x="${mx - 8}" y="${y0 - 4}" class="t-eyebrow" text-anchor="end"${bp('yAxis.label')}>↑ ${escapeHtml(yA.label)}</text>`;
  if (xA.low !== undefined)
    s += `<text x="${x0}" y="${y1 + 16}" class="t-sub c-soft" text-anchor="start"${bp('xAxis.low')}>${escapeHtml(xA.low)}</text>`;
  if (xA.high !== undefined)
    s += `<text x="${x1}" y="${y1 + 16}" class="t-sub c-soft" text-anchor="end"${bp('xAxis.high')}>${escapeHtml(xA.high)}</text>`;
  if (yA.high !== undefined)
    s += `<text x="${x0 - 10}" y="${y0 + 6}" class="t-sub c-soft" text-anchor="end"${bp('yAxis.high')}>${escapeHtml(yA.high)}</text>`;
  if (yA.low !== undefined)
    s += `<text x="${x0 - 10}" y="${y1}" class="t-sub c-soft" text-anchor="end"${bp('yAxis.low')}>${escapeHtml(yA.low)}</text>`;

  s += `<g${bl('items')}>`;
  items.forEach((it, i) => {
    const cx = px(it.x);
    const cy = py(it.y);
    const left = cx > mx;
    const tx = cx + (left ? -12 : 12);
    const anchor = left ? 'end' : 'start';
    s +=
      `<g${bp(`items.${i}`)}>` +
      `<circle cx="${cx}" cy="${cy}" r="5.5" fill="var(--ink)" stroke="var(--paper)" stroke-width="1.5"${DECORATIVE}/>` +
      `<text x="${tx}" y="${cy + 4.5}" class="t-name" text-anchor="${anchor}"${bp(`items.${i}.label`)}>${escapeHtml(it.label)}</text>` +
      `</g>`;
  });
  s += `</g>`;

  s += `</svg>`;
  return diagramFrame(
    {
      tag: '2×2',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
    },
    s,
  );
}
