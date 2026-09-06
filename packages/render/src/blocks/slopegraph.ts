/**
 * Renders a slopegraph — a ranked before / after comparison. Two vertical
 * baselines carry the `left` and `right` column headers; every item is one
 * straight line between them, with "label value" text end-anchored at the
 * left baseline and "value label" text start-anchored at the right one.
 *
 * The lines are facts: every line endpoint and dot sits at the TRUE value
 * position on the shared linear scale over the combined from/to domain, so
 * slopes are value-proportional and comparable within the chart. Only the
 * `<text>` labels dodge: colliding labels are nudged apart top-down —
 * deterministic, value order preserved, at least {@link MIN_SEP}px between
 * neighbours on the same side (right-side ties break by left-side position,
 * so tie groups stack parallel instead of fabricating crossings) — and the
 * viewBox grows to fit instead of clipping. A label displaced more than
 * {@link LEADER_AT}px from its endpoint gets a short leader back to it (the
 * scatter-chart pattern). Crossing lines are the point, not a defect.
 *
 * Skin (`DESIGN.md`): lines are `muted` with ink dots; an item the author
 * marked with an accent is the story and takes `accent` for its line and both
 * labels (`accent: red` is `negative`). Every item carries a full-text
 * `<title>` ("label: from → to unit"), so truncated labels stay recoverable.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { marksOf, type Mark } from '../svg/dsTone.js';
import { diagramFrame } from './frame.js';

const PAD = 26;
/** Horizontal span between the two baselines. */
const SPAN_W = 260;
/** Minimum vertical separation between neighbouring labels on one side. */
const MIN_SEP = 14;
/** A label displaced further than this from its endpoint gets a leader. */
const LEADER_AT = 7;
/** Labels longer than this are cut with an ellipsis (full text in <title>). */
const LABEL_MAX = 28;
/** Approximate character width of the 10px mono item text. */
const CHAR_W = 6.2;

/** Cuts to {@link LABEL_MAX} characters with a trailing ellipsis. */
function cut(label: string): string {
  return label.length > LABEL_MAX ? `${label.slice(0, LABEL_MAX - 1)}…` : label;
}

/**
 * Ideal LABEL y positions → collision-free positions (endpoints never move).
 * Sorted by position (value order) with ties broken by `ties` (the caller
 * passes the OTHER column's true positions, so a tie group stacks in the
 * order its lines arrive and leaders never cross), then by item order.
 * Swept top-down so each label sits at least {@link MIN_SEP} below the one
 * above it on the same side. The bottom is open — the caller grows the
 * viewBox.
 */
function nudge(ys: readonly number[], ties: readonly number[]): number[] {
  const order = ys
    .map((y, i) => ({ y, tie: ties[i] ?? 0, i }))
    .sort((a, b) => a.y - b.y || a.tie - b.tie || a.i - b.i);
  const out = ys.slice();
  let floor = -Infinity;
  for (const { y, i } of order) {
    const v = Math.max(y, floor + MIN_SEP);
    out[i] = v;
    floor = v;
  }
  return out;
}

type Tone = 'plain' | 'accent' | 'negative';

function toneOf(mark: Mark): Tone {
  if (mark === 'negative') return 'negative';
  if (mark === 'focal') return 'accent';
  return 'plain';
}

const STROKE: Record<Tone, string> = {
  plain: 'var(--muted)',
  accent: 'var(--accent)',
  negative: 'var(--negative)',
};
const TEXT_CLS: Record<Tone, string> = {
  plain: 't-sub c-ink',
  accent: 't-sub c-accent',
  negative: 't-sub c-negative',
};

export function renderSlopegraph(data: BlockDataMap['slopegraph']): string {
  const items = data.items;
  const unit = data.unit ?? '';
  const val = (v: number): string =>
    unit === '' ? String(v) : unit === '%' ? `${v}${unit}` : `${v} ${unit}`;

  // Shared linear domain over every from/to value; a flat domain gets ±1
  // padding so equal values still land mid-plot.
  let lo = Math.min(...items.map((it) => Math.min(it.from, it.to)));
  let hi = Math.max(...items.map((it) => Math.max(it.from, it.to)));
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }

  const top = PAD + 34; // headers sit above the plot
  const plotH = Math.max(160, items.length * 22);
  const y = (v: number): number => top + ((hi - v) / (hi - lo)) * plotH;

  // True endpoint positions — the lines and dots always sit here.
  const endL = items.map((it) => y(it.from));
  const endR = items.map((it) => y(it.to));
  // Label positions — dodged copies; right-side ties break by left position.
  const yl = nudge(endL, endL);
  const yr = nudge(endR, endL);

  const leftTexts = items.map((it) => `${cut(it.label)} ${val(it.from)}`);
  const rightTexts = items.map((it) => `${val(it.to)} ${cut(it.label)}`);
  const textW = (texts: readonly string[]): number =>
    Math.max(30, ...texts.map((t) => t.length * CHAR_W));

  const leftX = PAD + textW(leftTexts) + 12;
  const rightX = leftX + SPAN_W;
  const width = rightX + 12 + textW(rightTexts) + PAD;
  const bottom = Math.max(top + plotH, ...yl, ...yr) + 8;
  const height = bottom + PAD;

  const f = (v: number): string => v.toFixed(1);
  let s = `<svg viewBox="0 0 ${f(width)} ${f(height)}" role="img"><title>Slopegraph</title>`;

  // Baselines and their column headers.
  const axis = (x: number): string =>
    `<line x1="${f(x)}" y1="${f(top - 8)}" x2="${f(x)}" y2="${f(bottom)}" stroke="var(--rule-solid)" stroke-width="1"/>`;
  s += axis(leftX) + axis(rightX);
  s += `<text x="${f(leftX)}" y="${f(PAD + 8)}" class="t-eyebrow" text-anchor="middle"${bp('left')}>${escapeHtml(data.left)}</text>`;
  s += `<text x="${f(rightX)}" y="${f(PAD + 8)}" class="t-eyebrow" text-anchor="middle"${bp('right')}>${escapeHtml(data.right)}</text>`;

  const used = new Set<Tone>();
  const marks = marksOf(items.map((it) => it.accent));
  s += `<g${bl('items')}>`;
  items.forEach((it, i) => {
    const tone = toneOf(marks[i]);
    used.add(tone);
    const stroke = STROKE[tone];
    const weight = tone !== 'plain' ? ` font-weight="600"` : '';
    const ey1 = endL[i] ?? top;
    const ey2 = endR[i] ?? top;
    const ly1 = yl[i] ?? top;
    const ly2 = yr[i] ?? top;
    let g = `<g${bp(`items.${i}`)}>`;
    g += `<title>${escapeHtml(`${it.label}: ${val(it.from)} → ${val(it.to)}`)}</title>`;
    g += `<line x1="${f(leftX)}" y1="${f(ey1)}" x2="${f(rightX)}" y2="${f(ey2)}" stroke="${stroke}" stroke-width="${tone !== 'plain' ? 1.75 : 1.25}"/>`;
    g += `<circle cx="${f(leftX)}" cy="${f(ey1)}" r="3" fill="${tone === 'plain' ? 'var(--ink)' : stroke}"/>`;
    g += `<circle cx="${f(rightX)}" cy="${f(ey2)}" r="3" fill="${tone === 'plain' ? 'var(--ink)' : stroke}"/>`;
    // A displaced label points back at its endpoint with a hairline leader.
    if (Math.abs(ly1 - ey1) > LEADER_AT) {
      g += `<line x1="${f(leftX - 8)}" y1="${f(ly1)}" x2="${f(leftX - 2)}" y2="${f(ey1)}" stroke="var(--rule-solid)" stroke-width="1"/>`;
    }
    if (Math.abs(ly2 - ey2) > LEADER_AT) {
      g += `<line x1="${f(rightX + 2)}" y1="${f(ey2)}" x2="${f(rightX + 8)}" y2="${f(ly2)}" stroke="var(--rule-solid)" stroke-width="1"/>`;
    }
    g += `<text x="${f(leftX - 10)}" y="${f(ly1 + 3.5)}" class="${TEXT_CLS[tone]}" text-anchor="end"${weight}${bp(`items.${i}.from`)}>${escapeHtml(leftTexts[i] ?? '')}</text>`;
    g += `<text x="${f(rightX + 10)}" y="${f(ly2 + 3.5)}" class="${TEXT_CLS[tone]}" text-anchor="start"${weight}${bp(`items.${i}.to`)}>${escapeHtml(rightTexts[i] ?? '')}</text>`;
    s += g + `</g>`;
  });
  s += `</g></svg>`;

  const legend: LegendItem[] = [];
  if (used.has('plain')) legend.push({ swatch: 'fill', fill: 'var(--muted)', label: 'item' });
  if (used.has('accent')) legend.push({ swatch: 'fill', fill: 'var(--accent)', label: 'focal item' });
  if (used.has('negative')) legend.push({ swatch: 'fill', fill: 'var(--negative)', label: 'negative' });
  const legendHtml = renderLegend(legend);

  return diagramFrame(
    {
      tag: 'SLOPEGRAPH',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legendHtml.length > 0 ? { legendHtml } : {}),
    },
    s,
  );
}
