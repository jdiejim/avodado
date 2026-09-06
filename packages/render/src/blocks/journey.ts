/**
 * Renders a user-journey map — a table of touchpoints across stages, plus an
 * optional emotion curve (SVG polyline) showing user sentiment per stage.
 *
 * Skin (`DESIGN.md`): the curve is an ink line; each stage's dot tells the
 * sentiment by fill rather than hue — a high point (≥ 0.6) is solid ink, a
 * middling one is a hollow paper dot, and a low point (≤ 0.35) is `negative`,
 * the one place a real problem may be coloured. A legend under the curve
 * names the fills present.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

type Mood = 'high' | 'mid' | 'low';

function moodOf(v: number): Mood {
  return v >= 0.6 ? 'high' : v <= 0.35 ? 'low' : 'mid';
}

const DOT_ATTRS: Record<Mood, string> = {
  high: 'fill="var(--ink)" stroke="var(--paper)" stroke-width="1.5"',
  mid: 'fill="var(--paper)" stroke="var(--ink)" stroke-width="1.5"',
  low: 'fill="var(--negative)" stroke="var(--paper)" stroke-width="1.5"',
};

const MOOD_LEGEND: Record<Mood, LegendItem> = {
  high: { swatch: 'fill', fill: 'var(--ink)', label: 'positive' },
  mid: { swatch: 'node', label: 'neutral' },
  low: { swatch: 'fill', fill: 'var(--negative)', label: 'negative' },
};

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
    const moods = new Set<Mood>();
    const points = emotion.map((v, i) => `${ex(i)},${ey(v)}`).join(' ');
    const dots = emotion
      .map((v, i) => {
        const mood = moodOf(v);
        moods.add(mood);
        return `<circle cx="${ex(i)}" cy="${ey(v)}" r="5" ${DOT_ATTRS[mood]}${bp(`emotion.${i}`)}/>`;
      })
      .join('');
    const legend = renderLegend((['high', 'mid', 'low'] as const).filter((m) => moods.has(m)).map((m) => MOOD_LEGEND[m]));
    svg =
      `<div class="jr-emotion">` +
      `<div class="jr-emotion-label t-eyebrow">Emotion</div>` +
      `<svg viewBox="0 0 ${W} ${H}" style="width:100%" role="img"><title>Emotion curve</title>` +
      `<polyline points="${points}" fill="none" stroke="var(--ink)" stroke-width="1.5" stroke-linejoin="round"/>` +
      `<g${bl('emotion')}>${dots}</g>` +
      `</svg>${legend}</div>`;
  }

  return (
    `<div>` +
    `<table class="pres-table"><thead>${head}</thead><tbody${bl('rows')}>${body}</tbody></table>` +
    svg +
    `</div>`
  );
}
