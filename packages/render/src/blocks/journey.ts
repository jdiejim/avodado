/**
 * Renders a user-journey map — a table of touchpoints across stages, plus an
 * optional emotion curve (SVG polyline) showing user sentiment per stage.
 *
 * Ported from doc-studio.jsx `JourneyMap`.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';

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
    `<tr${bl('stages')}><th></th>` +
    stages.map((s, i) => `<th class="c"${bp(`stages.${i}`)}>${escapeHtml(s.label)}</th>`).join('') +
    `</tr>`;
  const body = rows
    .map(
      (r, ri) =>
        `<tr${bp(`rows.${ri}`)}><td class="lead"${bp(`rows.${ri}.label`)}>${escapeHtml(r.label)}</td>` +
        (r.cells ?? [])
          .map((c, ci) => `<td class="c"${bp(`rows.${ri}.cells.${ci}`)}>${escapeHtml(c)}</td>`)
          .join('') +
        `</tr>`,
    )
    .join('');

  let svg = '';
  if (emotion.length > 0) {
    const points = emotion.map((v, i) => `${ex(i)},${ey(v)}`).join(' ');
    const dots = emotion
      .map((v, i) => {
        const fill = v >= 0.6 ? '#1f9747' : v <= 0.35 ? '#991b1b' : '#f7952c';
        return `<circle cx="${ex(i)}" cy="${ey(v)}" r="5" fill="${fill}" stroke="#fff" stroke-width="1.5"${bp(`emotion.${i}`)}/>`;
      })
      .join('');
    svg =
      `<div class="jr-emotion">` +
      `<div class="jr-emotion-label">Emotion</div>` +
      `<svg viewBox="0 0 ${W} ${H}" style="width:100%" role="img"><title>Emotion curve</title>` +
      `<polyline points="${points}" fill="none" stroke="#0e54a1" stroke-width="2"/>` +
      `<g${bl('emotion')}>${dots}</g>` +
      `</svg></div>`;
  }

  return (
    `<div>` +
    `<table class="pres-table"><thead>${head}</thead><tbody${bl('rows')}>${body}</tbody></table>` +
    svg +
    `</div>`
  );
}
