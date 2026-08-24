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
 * {@link LEADER_AT}px from its endpoint gets a short muted leader back to
 * it (the scatter-chart pattern). Crossing lines are the point, not a
 * defect. An `accent` colors one item's line and both labels; every item
 * carries a full-text `<title>` ("label: from → to unit"), so truncated
 * labels stay recoverable.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';

/** Accent name → bright diagram palette hex (matches svg/blockStyle.ts). */
const ACCENT_HEX: Record<string, string> = {
  navy: '#0e54a1',
  blue: '#1a6dbe',
  teal: '#0f766e',
  green: '#1f9747',
  amber: '#f7952c',
  purple: '#6b21a8',
  red: '#991b1b',
  gray: '#6b7280',
};

const PAD = 26;
/** Horizontal span between the two baselines. */
const SPAN_W = 260;
/** Minimum vertical separation between neighbouring labels on one side. */
const MIN_SEP = 14;
/** A label displaced further than this from its endpoint gets a leader. */
const LEADER_AT = 7;
/** Labels longer than this are cut with an ellipsis (full text in <title>). */
const LABEL_MAX = 28;
/** Approximate character width at the 12.5px item size. */
const CHAR_W = 6.9;

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
    `<line x1="${f(x)}" y1="${f(top - 8)}" x2="${f(x)}" y2="${f(bottom)}" stroke="var(--rule)" stroke-width="1.4"/>`;
  s += axis(leftX) + axis(rightX);
  s += `<text x="${f(leftX)}" y="${f(PAD + 8)}" class="sg-col"${bp('left')}>${escapeHtml(data.left)}</text>`;
  s += `<text x="${f(rightX)}" y="${f(PAD + 8)}" class="sg-col"${bp('right')}>${escapeHtml(data.right)}</text>`;

  s += `<g${bl('items')}>`;
  items.forEach((it, i) => {
    const color = it.accent !== undefined ? (ACCENT_HEX[it.accent] ?? 'var(--gray)') : undefined;
    const stroke = color ?? 'var(--gray)';
    const fill = color !== undefined ? ` fill="${color}"` : '';
    const weight = color !== undefined ? ` font-weight="700"` : '';
    const ey1 = endL[i] ?? top;
    const ey2 = endR[i] ?? top;
    const ly1 = yl[i] ?? top;
    const ly2 = yr[i] ?? top;
    let g = `<g${bp(`items.${i}`)}>`;
    g += `<title>${escapeHtml(`${it.label}: ${val(it.from)} → ${val(it.to)}`)}</title>`;
    g += `<line x1="${f(leftX)}" y1="${f(ey1)}" x2="${f(rightX)}" y2="${f(ey2)}" stroke="${stroke}" stroke-width="${color !== undefined ? 2 : 1.4}"/>`;
    g += `<circle cx="${f(leftX)}" cy="${f(ey1)}" r="3" fill="${stroke}"/>`;
    g += `<circle cx="${f(rightX)}" cy="${f(ey2)}" r="3" fill="${stroke}"/>`;
    // A displaced label points back at its endpoint with a muted leader.
    if (Math.abs(ly1 - ey1) > LEADER_AT) {
      g += `<line x1="${f(leftX - 8)}" y1="${f(ly1)}" x2="${f(leftX - 2)}" y2="${f(ey1)}" class="sg-leader"/>`;
    }
    if (Math.abs(ly2 - ey2) > LEADER_AT) {
      g += `<line x1="${f(rightX + 2)}" y1="${f(ey2)}" x2="${f(rightX + 8)}" y2="${f(ly2)}" class="sg-leader"/>`;
    }
    g += `<text x="${f(leftX - 10)}" y="${f(ly1 + 4)}" class="sg-item sg-left"${fill}${weight}${bp(`items.${i}.from`)}>${escapeHtml(leftTexts[i] ?? '')}</text>`;
    g += `<text x="${f(rightX + 10)}" y="${f(ly2 + 4)}" class="sg-item sg-right"${fill}${weight}${bp(`items.${i}.to`)}>${escapeHtml(rightTexts[i] ?? '')}</text>`;
    s += g + `</g>`;
  });
  s += `</g></svg>`;

  return diagramFrame(
    {
      tag: 'SLOPEGRAPH',
      tagBg: '#0e54a1',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
    },
    s,
  );
}
