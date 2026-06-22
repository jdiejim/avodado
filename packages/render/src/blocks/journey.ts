/**
 * Renders a user-journey map — a table of touchpoints across stages, plus an
 * optional emotion curve (SVG polyline) showing user sentiment per stage.
 *
 * Ported from doc-studio.jsx `JourneyMap`.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

export function renderJourney(data: BlockDataMap['journey']): string {
  const stages = data.stages ?? [];
  const rows = data.rows ?? [];
  const emotion = data.emotion ?? [];
  const n = Math.max(stages.length, 1);
  const W = Math.max(380, n * 150);
  const H = 92;
  const pad = 20;
  const colW = (W - pad * 2) / n;
  const ex = (i: number): number => pad + colW * (i + 0.5);
  const ey = (v: number): number => H - 14 - (H - 30) * clamp01(v);

  const head =
    `<tr><th></th>` +
    stages.map((s) => `<th class="c">${escapeHtml(s.label)}</th>`).join('') +
    `</tr>`;
  const body = rows
    .map(
      (r) =>
        `<tr><td class="lead">${escapeHtml(r.label)}</td>` +
        (r.cells ?? []).map((c) => `<td class="c">${escapeHtml(c)}</td>`).join('') +
        `</tr>`,
    )
    .join('');

  let svg = '';
  if (emotion.length > 0) {
    const points = emotion.map((v, i) => `${ex(i)},${ey(v)}`).join(' ');
    const dots = emotion
      .map((v, i) => {
        const fill = v >= 0.6 ? '#1f9747' : v <= 0.35 ? '#991b1b' : '#f7952c';
        return `<circle cx="${ex(i)}" cy="${ey(v)}" r="5" fill="${fill}" stroke="#fff" stroke-width="1.5"/>`;
      })
      .join('');
    svg =
      `<div style="margin-top:10px">` +
      `<div style="font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Emotion</div>` +
      `<svg viewBox="0 0 ${W} ${H}" style="width:100%" role="img"><title>Emotion curve</title>` +
      `<polyline points="${points}" fill="none" stroke="#0e54a1" stroke-width="2"/>` +
      dots +
      `</svg></div>`;
  }

  return (
    `<div>` +
    `<table class="pres-table"><thead>${head}</thead><tbody>${body}</tbody></table>` +
    svg +
    `</div>`
  );
}
