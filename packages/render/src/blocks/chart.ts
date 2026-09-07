/**
 * Renders a `chart` block — a declarative data chart in pure SVG (no deps).
 * Kinds: `bar` (grouped), `stacked`, `line`, `area`, `scatter` (ordinal, or
 * numeric with `points`), `donut`, `gauge`, `radar`, `waterfall`, `funnel`.
 *
 * Skin (`DESIGN.md`, `svg/dsTone.ts`): axes are `rule` hairlines on a
 * `rule-solid` baseline, tick labels `.t-sub` in `soft`, category labels
 * `.t-sub`, value labels `.t-arrow` on the paper halo. Colour is spent on the
 * series only: one series is `ink`; 2–5 series take the desaturated series
 * ramp in order; a series marked `accent: red` is `negative`. Donut, gauge,
 * waterfall and funnel tell the parts of one whole apart on the ink ramp
 * (`ink` → `muted` → `soft` → `rule-solid` → `paper-2`) — an item that names
 * any other accent is the focal one and takes `accent`. Negative values are
 * clamped at 0. No gradients, no shadows, no 3D.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { inkTone, marksOf, seriesColor, sliceTone, type Mark } from '../svg/dsTone.js';
import { diagramFrame } from './frame.js';
import { DECORATIVE } from '../svg/decorative.js';

type ChartData = BlockDataMap['chart'];
type Series = NonNullable<ChartData['series']>[number];
type DonutItem = NonNullable<ChartData['items']>[number];

/** Clamps negatives to 0 (charts render the non-negative range only). */
const pos = (v: number): number => (Number.isFinite(v) && v > 0 ? v : 0);

/** Formats a value with the optional unit suffix, trimming float noise. */
function fmt(v: number, unit: string | undefined): string {
  const n = Math.round(v * 100) / 100;
  return `${n}${unit ?? ''}`;
}

/** Text drawn ON a dark fill: `paper`, and no paper halo (it would blur). */
const ON_DARK = ' style="fill:var(--paper);stroke:none"';

/** Shared cartesian frame geometry for bar / line / area. */
interface Frame {
  readonly width: number;
  readonly height: number;
  readonly x0: number; // plot left
  readonly x1: number; // plot right
  readonly y0: number; // plot top
  readonly y1: number; // plot bottom (baseline)
  /** The top tick — the axis ceiling the data is scaled to. */
  readonly yMax: number;
  /** Nice tick values, 0 first, `yMax` last. */
  readonly ticks: readonly number[];
}

/**
 * A nice tick step (1 / 2 / 2.5 / 5 × 10^n) for a span, choosing the step
 * whose tick count over `span` lands in 4–6 (closest to 5).
 */
function niceStep(span: number): number {
  if (!(span > 0)) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(span / 5)));
  const candidates = [1, 2, 2.5, 5, 10].map((m) => m * mag);
  let best = candidates[0] ?? 1;
  let bestScore = Infinity;
  for (const c of candidates) {
    const n = Math.ceil(span / c - 1e-9);
    const score = n >= 4 && n <= 6 ? Math.abs(n - 5) : 10 + Math.abs(n - 5);
    if (score < bestScore) {
      best = c;
      bestScore = score;
    }
  }
  return best;
}

/** Nice ticks from 0 to the first step multiple at or above `max`. */
function niceTicks(max: number): number[] {
  const step = niceStep(max);
  const n = Math.max(1, Math.ceil(max / step - 1e-9));
  return Array.from({ length: n + 1 }, (_v, i) => Math.round(i * step * 1e6) / 1e6);
}

function frameFor(data: ChartData, cats: number, stacked = false): Frame {
  const width = Math.max(420, Math.min(680, 120 + cats * 84));
  const height = 240;
  const series = data.series ?? [];
  const values = series.flatMap((s) => s.values.map(pos));
  // A stacked column is as tall as its total, so that is what the axis has to
  // fit — scaling to the tallest single value would run the stack off the top.
  const totals = stacked
    ? Array.from({ length: cats }, (_v, i) => series.reduce((a, sr) => a + pos(sr.values[i] ?? 0), 0))
    : [];
  const dataMax = Math.max(0, ...values, ...totals);
  const ceiling = data.max !== undefined && data.max > 0 ? data.max : dataMax > 0 ? dataMax : 1;
  const ticks = niceTicks(ceiling);
  const yMax = ticks[ticks.length - 1] ?? ceiling;
  return { width, height, x0: 52, x1: width - 18, y0: 18, y1: height - 32, yMax, ticks };
}

/** Baseline, hairline gridlines, tick labels, and category labels. */
function axes(f: Frame, labels: readonly string[], unit: string | undefined, tagLabels: boolean): string {
  let s = '';
  f.ticks.forEach((t, ti) => {
    const y = Math.round(f.y1 - ((f.y1 - f.y0) * t) / f.yMax);
    s += `<line x1="${f.x0}" y1="${y}" x2="${f.x1}" y2="${y}" stroke="${ti === 0 ? 'var(--rule-solid)' : 'var(--rule)'}" stroke-width="1"${DECORATIVE}/>`;
    s += `<text x="${f.x0 - 8}" y="${y + 3}" class="t-sub c-soft" text-anchor="end">${escapeHtml(fmt(t, unit))}</text>`;
  });
  const n = Math.max(labels.length, 1);
  const slot = (f.x1 - f.x0) / n;
  // Category labels are only addressable when they come from `labels` in the
  // YAML (they can be derived 1, 2, 3, … when omitted).
  if (tagLabels) s += `<g${bl('labels')}>`;
  labels.forEach((label, i) => {
    const x = Math.round(f.x0 + slot * i + slot / 2);
    s += `<text x="${x}" y="${f.y1 + 18}" class="t-sub" text-anchor="middle"${tagLabels ? bp(`labels.${i}`) : ''}>${escapeHtml(label)}</text>`;
  });
  if (tagLabels) s += `</g>`;
  return s;
}

/** The series legend — one swatch per series, in the ramp's order. */
function seriesLegend(series: readonly Series[]): string {
  const items: LegendItem[] = series.map((sr, i) => ({
    swatch: 'fill',
    fill: seriesColor(i, series.length, sr.accent),
    label: sr.label,
    path: `series.${i}`,
  }));
  return renderLegend(items, 'series');
}

/** The items legend (donut / gauge) — label and value per slice. */
function itemsLegend(items: readonly DonutItem[], unit: string | undefined): string {
  const marks = marksOf(items.map((it) => it.accent));
  const entries: LegendItem[] = items.map((it, i) => ({
    swatch: 'fill',
    fill: sliceTone(i, marks[i]).fill,
    label: `${it.label} — ${fmt(pos(it.value), unit)}`,
    path: `items.${i}`,
  }));
  return renderLegend(entries, 'items');
}

function renderBars(
  data: ChartData,
  labels: readonly string[],
  series: readonly Series[],
  tagLabels: boolean,
): string {
  const f = frameFor(data, labels.length);
  const n = Math.max(labels.length, 1);
  const slot = (f.x1 - f.x0) / n;
  const groupPad = Math.min(18, slot * 0.18);
  const barGap = 4;
  const k = Math.max(series.length, 1);
  const barW = Math.max(6, Math.round((slot - groupPad * 2 - barGap * (k - 1)) / k));
  let s = `<g${bl('series')}>`;
  series.forEach((sr, si) => {
    const color = seriesColor(si, series.length, sr.accent);
    s += `<g${bp(`series.${si}`)}>`;
    for (let ci = 0; ci < labels.length; ci++) {
      const v = pos(sr.values[ci] ?? 0);
      const capped = Math.min(v, f.yMax);
      const h = Math.round(((f.y1 - f.y0) * capped) / f.yMax);
      const x = Math.round(f.x0 + slot * ci + groupPad + si * (barW + barGap));
      const y = f.y1 - h;
      s += `<g${bp(`series.${si}.values.${ci}`)}>`;
      s += `<rect x="${x}" y="${y}" width="${barW}" height="${Math.max(h, 1)}" fill="${color}"${h === 0 ? ' opacity="0.35"' : ''}/>`;
      s += `<text x="${x + Math.round(barW / 2)}" y="${y - 4}" class="t-arrow" text-anchor="middle">${escapeHtml(fmt(v, data.unit))}</text>`;
      s += `</g>`;
    }
    s += `</g>`;
  });
  s += `</g>`;
  return svgOpen(f) + axes(f, labels, data.unit, tagLabels) + s + `</svg>`;
}

function renderLineArea(
  data: ChartData,
  labels: readonly string[],
  series: readonly Series[],
  area: boolean,
  tagLabels: boolean,
): string {
  const f = frameFor(data, labels.length);
  const n = Math.max(labels.length, 1);
  const slot = (f.x1 - f.x0) / n;
  const xAt = (i: number): number => Math.round(f.x0 + slot * i + slot / 2);
  const yAt = (v: number): number =>
    Math.round(f.y1 - ((f.y1 - f.y0) * Math.min(pos(v), f.yMax)) / f.yMax);
  let s = `<g${bl('series')}>`;
  series.forEach((sr, si) => {
    const color = seriesColor(si, series.length, sr.accent);
    const pts = sr.values.slice(0, labels.length).map((v, i) => `${xAt(i)},${yAt(v)}`);
    if (pts.length === 0) return;
    s += `<g${bp(`series.${si}`)}>`;
    if (area && pts.length > 1) {
      const first = xAt(0);
      const last = xAt(pts.length - 1);
      s += `<polygon points="${first},${f.y1} ${pts.join(' ')} ${last},${f.y1}" fill="${color}" fill-opacity="0.12" stroke="none"/>`;
    }
    if (pts.length > 1) {
      s += `<polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="1.75" stroke-linejoin="round"/>`;
    }
    sr.values.slice(0, labels.length).forEach((v, i) => {
      s += `<circle cx="${xAt(i)}" cy="${yAt(v)}" r="3" fill="var(--paper)" stroke="${color}" stroke-width="1.75"/>`;
    });
    s += `</g>`;
  });
  s += `</g>`;
  return svgOpen(f) + axes(f, labels, data.unit, tagLabels) + s + `</svg>`;
}

/** A drawing plus the legend strip the frame shows under it. */
interface Drawn {
  readonly svg: string;
  readonly legend: string;
}

function renderDonut(data: ChartData, items: readonly DonutItem[]): Drawn {
  const width = 480;
  const height = 236;
  const cx = Math.round(width / 2);
  const cy = Math.round(height / 2);
  const r = 74;
  const sw = 26;
  const total = items.reduce((acc, it) => acc + pos(it.value), 0);
  let s = svgOpenSize(width, height);
  const ringEdges =
    `<circle cx="${cx}" cy="${cy}" r="${r + sw / 2}" fill="none" stroke="var(--rule-solid)" stroke-width="1"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r - sw / 2}" fill="none" stroke="var(--rule-solid)" stroke-width="1"/>`;
  if (total <= 0) {
    s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--paper)" stroke-width="${sw}"${DECORATIVE}/>` + ringEdges;
  } else {
    let angle = -90;
    const marks = marksOf(items.map((it) => it.accent));
    const seams: string[] = [];
    const seam = (deg: number): void => {
      const a = (deg * Math.PI) / 180;
      const x0 = Math.round((cx + (r - sw / 2 - 1) * Math.cos(a)) * 10) / 10;
      const y0 = Math.round((cy + (r - sw / 2 - 1) * Math.sin(a)) * 10) / 10;
      const x1 = Math.round((cx + (r + sw / 2 + 1) * Math.cos(a)) * 10) / 10;
      const y1 = Math.round((cy + (r + sw / 2 + 1) * Math.sin(a)) * 10) / 10;
      seams.push(`<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="var(--paper-2)" stroke-width="2"${DECORATIVE}/>`);
    };
    // Every slice worth ≥ 8% is named beside the ring, with a leader from
    // the slice's middle; labels on one side are nudged apart top-down.
    interface Callout {
      readonly mid: number; // degrees
      readonly text: string;
    }
    const callouts: Callout[] = [];
    s += `<g${bl('items')}>`;
    items.forEach((it, i) => {
      const v = pos(it.value);
      if (v === 0) return;
      const sweep = (v / total) * 360;
      const color = sliceTone(i, marks[i]).fill;
      if (sweep >= 359.999) {
        // A full circle can't be a single arc — draw a ring.
        s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}"${bp(`items.${i}`)}/>`;
      } else {
        const a0 = (angle * Math.PI) / 180;
        const a1 = ((angle + sweep) * Math.PI) / 180;
        const x0 = Math.round(cx + r * Math.cos(a0));
        const y0 = Math.round(cy + r * Math.sin(a0));
        const x1 = Math.round(cx + r * Math.cos(a1));
        const y1 = Math.round(cy + r * Math.sin(a1));
        const large = sweep > 180 ? 1 : 0;
        s += `<path d="M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="butt"${bp(`items.${i}`)}/>`;
        seam(angle);
      }
      if (v / total >= 0.08) callouts.push({ mid: angle + sweep / 2, text: `${it.label} ${fmt(v, data.unit)}` });
      angle += sweep;
    });
    s += `</g>`;
    s += ringEdges;
    // Ground-coloured seams between slices, so pale steps stay separable.
    if (seams.length > 1) s += seams.join('');
    s += donutCallouts(callouts, cx, cy, r + sw / 2);
  }
  s += `<text x="${cx}" y="${cy + 2}" class="chart-total">${escapeHtml(fmt(total, data.unit))}</text>`;
  s += `<text x="${cx}" y="${cy + 20}" class="t-eyebrow" text-anchor="middle">TOTAL</text>`;
  s += `</svg>`;
  return { svg: s, legend: itemsLegend(items, data.unit) };
}

/**
 * Slice callouts: a short leader from the ring's rim to a `.t-sub` label just
 * outside it, anchored away from the ring. Labels on the same side are swept
 * top-down and pushed at least 12px apart so neighbours never overprint.
 */
function donutCallouts(
  callouts: ReadonlyArray<{ mid: number; text: string }>,
  cx: number,
  cy: number,
  rim: number,
): string {
  const placed = callouts.map((c) => {
    const a = (c.mid * Math.PI) / 180;
    const right = Math.cos(a) >= 0;
    return {
      text: c.text,
      right,
      x0: cx + (rim + 2) * Math.cos(a),
      y0: cy + (rim + 2) * Math.sin(a),
      x1: cx + (rim + 12) * Math.cos(a),
      y: cy + (rim + 12) * Math.sin(a),
    };
  });
  for (const side of [true, false]) {
    const group = placed.filter((p) => p.right === side).sort((a, b) => a.y - b.y);
    let floor = -Infinity;
    for (const p of group) {
      const y = Math.max(p.y, floor + 12);
      (p as { y: number }).y = y;
      floor = y;
    }
  }
  const round = (n: number): number => Math.round(n * 10) / 10;
  return placed
    .map((p) => {
      const lx = p.right ? Math.max(p.x1, cx + rim + 8) : Math.min(p.x1, cx - rim - 8);
      return (
        `<line x1="${round(p.x0)}" y1="${round(p.y0)}" x2="${round(lx)}" y2="${round(p.y)}" stroke="var(--muted)" stroke-width="0.75"/>` +
        `<text x="${round(lx + (p.right ? 4 : -4))}" y="${round(p.y + 3.5)}" class="t-sub c-ink" text-anchor="${p.right ? 'start' : 'end'}">${escapeHtml(p.text)}</text>`
      );
    })
    .join('');
}

/**
 * `kind: stacked` — bars that sum instead of standing side by side, for the
 * case where the total matters as much as the split (spend by team per
 * quarter, requests by status per day).
 */
function renderStacked(
  data: ChartData,
  labels: readonly string[],
  series: readonly Series[],
  tagLabels: boolean,
): string {
  const f = frameFor(data, labels.length, true);
  const n = Math.max(labels.length, 1);
  const slot = (f.x1 - f.x0) / n;
  const barW = Math.max(10, Math.min(56, slot * 0.55));
  let s = `<g${bl('series')}>`;
  for (let ci = 0; ci < labels.length; ci++) {
    const x = Math.round(f.x0 + slot * ci + (slot - barW) / 2);
    let top = f.y1;
    series.forEach((sr, si) => {
      const v = pos(sr.values[ci] ?? 0);
      if (v === 0) return;
      const h = Math.round(((f.y1 - f.y0) * v) / f.yMax);
      top -= h;
      s += `<rect x="${x}" y="${top}" width="${Math.round(barW)}" height="${h}" fill="${seriesColor(si, series.length, sr.accent)}" stroke="var(--paper-2)" stroke-width="1"${DECORATIVE}${bp(`series.${si}.values.${ci}`)}><title>${escapeHtml(`${sr.label} — ${fmt(v, data.unit)}`)}</title></rect>`;
    });
    // The column total sits above the stack, which is the number people read.
    const total = series.reduce((a, sr) => a + pos(sr.values[ci] ?? 0), 0);
    if (total > 0) {
      s += `<text x="${x + Math.round(barW / 2)}" y="${top - 5}" class="t-arrow" text-anchor="middle">${escapeHtml(fmt(total, data.unit))}</text>`;
    }
  }
  s += `</g>`;
  return svgOpen(f) + axes(f, labels, data.unit, tagLabels) + s + `</svg>`;
}

/**
 * `kind: scatter` — points instead of a joined line, for the case where the
 * x order carries no meaning and the question is where things cluster.
 */
function renderScatter(
  data: ChartData,
  labels: readonly string[],
  series: readonly Series[],
  tagLabels: boolean,
): string {
  const f = frameFor(data, labels.length);
  const n = Math.max(labels.length, 1);
  const slot = (f.x1 - f.x0) / n;
  const xAt = (i: number): number => Math.round(f.x0 + slot * i + slot / 2);
  const yAt = (v: number): number =>
    Math.round(f.y1 - ((f.y1 - f.y0) * Math.min(pos(v), f.yMax)) / f.yMax);
  let s = `<g${bl('series')}>`;
  series.forEach((sr, si) => {
    const color = seriesColor(si, series.length, sr.accent);
    s += `<g${bp(`series.${si}`)}>`;
    sr.values.slice(0, labels.length).forEach((v, i) => {
      s += `<circle cx="${xAt(i)}" cy="${yAt(v)}" r="5" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="1.5"><title>${escapeHtml(`${sr.label} — ${fmt(pos(v), data.unit)}`)}</title></circle>`;
    });
    s += `</g>`;
  });
  s += `</g>`;
  return svgOpen(f) + axes(f, labels, data.unit, tagLabels) + s + `</svg>`;
}

// ─── kind: scatter with `points` (numeric axes) ──────────────────────────────
// Each point owns its own x/y, so both axes are numeric: domains come from the
// data (extended to include any guides), padded, and snapped to nice tick
// steps. `size` drives the bubble radius on a sqrt scale (area reads as the
// value); `label` sits beside its bubble, nudged vertically when two labels
// would overlap. `guides` draws dashed reference lines and optional muted
// quadrant labels in the plot corners (TL, TR, BL, BR order).

type ScatterPoint = NonNullable<ChartData['points']>[number];

interface NumScale {
  readonly min: number;
  readonly max: number;
  readonly ticks: readonly number[];
}

/** Pads a data extent, snaps it to nice tick multiples, and lists the ticks. */
function numScale(values: readonly number[]): NumScale {
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (lo === hi) {
    // A flat extent can't scale — open a symmetric window around the value.
    const pad = lo === 0 ? 1 : Math.abs(lo) * 0.2;
    lo -= pad;
    hi += pad;
  } else {
    const pad = (hi - lo) * 0.06;
    lo -= pad;
    hi += pad;
  }
  const step = niceStep(hi - lo);
  const min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  // Guard float drift so the last tick always lands on `max`.
  for (let t = min; t <= max + step / 2; t += step) ticks.push(Math.round(t * 1e6) / 1e6);
  return { min, max, ticks };
}

/** Truncation cap for point labels — the full text still ships in <title>. */
const SC_LABEL_CHARS = 40;

function scLabel(label: string): string {
  return label.length > SC_LABEL_CHARS ? `${label.slice(0, SC_LABEL_CHARS - 1)}…` : label;
}

/** Bubble radius: sqrt scale over `size`, r 4–18; 5 when `size` is absent. */
function scRadius(size: number | undefined, minS: number, maxS: number): number {
  if (size === undefined) return 5;
  const s = Math.max(size, 0);
  if (maxS <= minS) return 8;
  const t = (Math.sqrt(s) - Math.sqrt(minS)) / (Math.sqrt(maxS) - Math.sqrt(minS));
  return Math.round((4 + t * 14) * 10) / 10;
}

interface LabelBox {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

const boxesOverlap = (a: LabelBox, b: LabelBox): boolean =>
  a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

interface Dot {
  readonly px: number;
  readonly py: number;
  readonly r: number;
}

/** True when a bubble's disc overlaps a label box (closest-point test). */
function circleHitsBox(c: Dot, b: LabelBox): boolean {
  const nx = Math.max(b.x0, Math.min(c.px, b.x1));
  const ny = Math.max(b.y0, Math.min(c.py, b.y1));
  const dx = c.px - nx;
  const dy = c.py - ny;
  return dx * dx + dy * dy < c.r * c.r;
}

/** A point's colour: `ink`, or the accent / negative its mark gives it. */
function pointColor(mark: Mark): string {
  if (mark === 'negative') return 'var(--negative)';
  if (mark === 'focal') return 'var(--accent)';
  return 'var(--ink)';
}

function renderScatterPoints(data: ChartData, points: readonly ScatterPoint[]): Drawn {
  const guides = data.guides;
  const width = 560;
  const height = 320;
  const x0 = data.yLabel !== undefined ? 70 : 56;
  const x1 = width - 20;
  const y0 = 18;
  const y1 = height - (data.xLabel !== undefined ? 48 : 34);

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  // Guides join the extent so an off-data guide extends the domain instead of
  // drawing outside the plot.
  if (guides?.x !== undefined) xs.push(guides.x);
  if (guides?.y !== undefined) ys.push(guides.y);
  const sx = numScale(xs);
  const sy = numScale(ys);
  const X = (v: number): number =>
    Math.round((x0 + ((x1 - x0) * (v - sx.min)) / (sx.max - sx.min)) * 10) / 10;
  const Y = (v: number): number =>
    Math.round((y1 - ((y1 - y0) * (v - sy.min)) / (sy.max - sy.min)) * 10) / 10;

  const sizes = points.filter((p) => p.size !== undefined).map((p) => Math.max(p.size ?? 0, 0));
  const minS = sizes.length > 0 ? Math.min(...sizes) : 0;
  const maxS = sizes.length > 0 ? Math.max(...sizes) : 0;

  let s = svgOpenSize(width, height);

  // Gridlines + tick labels on both axes.
  for (const t of sy.ticks) {
    const y = Y(t);
    s += `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${t === sy.min ? 'var(--rule-solid)' : 'var(--rule)'}" stroke-width="1"${DECORATIVE}/>`;
    s += `<text x="${x0 - 8}" y="${y + 3}" class="t-sub c-soft" text-anchor="end">${escapeHtml(fmt(t, data.unit))}</text>`;
  }
  for (const t of sx.ticks) {
    const x = X(t);
    s += `<line x1="${x}" y1="${y0}" x2="${x}" y2="${y1}" stroke="${t === sx.min ? 'var(--rule-solid)' : 'var(--rule)'}" stroke-width="1"${DECORATIVE}/>`;
    s += `<text x="${x}" y="${y1 + 16}" class="t-sub c-soft" text-anchor="middle">${escapeHtml(fmt(t, undefined))}</text>`;
  }

  // Axis titles.
  if (data.xLabel !== undefined) {
    s += `<text x="${Math.round((x0 + x1) / 2)}" y="${height - 8}" class="t-eyebrow" text-anchor="middle"${bp('xLabel')}>${escapeHtml(data.xLabel)}</text>`;
  }
  if (data.yLabel !== undefined) {
    const cy = Math.round((y0 + y1) / 2);
    s += `<text x="14" y="${cy}" class="t-eyebrow" text-anchor="middle" transform="rotate(-90 14 ${cy})"${bp('yLabel')}>${escapeHtml(data.yLabel)}</text>`;
  }

  // Dashed reference guides + quadrant corner labels (TL, TR, BL, BR).
  if (guides !== undefined) {
    if (guides.x !== undefined) {
      const gx = X(guides.x);
      s += `<line x1="${gx}" y1="${y0}" x2="${gx}" y2="${y1}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="5 4"${bp('guides.x')}/>`;
    }
    if (guides.y !== undefined) {
      const gy = Y(guides.y);
      s += `<line x1="${x0}" y1="${gy}" x2="${x1}" y2="${gy}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="5 4"${bp('guides.y')}/>`;
    }
    if (guides.quadrants !== undefined && guides.quadrants.length === 4) {
      const [tl, tr, bl_, br] = guides.quadrants;
      const corner = (
        text: string | undefined,
        x: number,
        y: number,
        anchor: 'start' | 'end',
        i: number,
      ): string =>
        text === undefined || text === ''
          ? ''
          : `<text x="${x}" y="${y}" class="t-eyebrow" text-anchor="${anchor}"${bp(`guides.quadrants.${i}`)}>${escapeHtml(text)}</text>`;
      s += corner(tl, x0 + 8, y0 + 12, 'start', 0);
      s += corner(tr, x1 - 8, y0 + 12, 'end', 1);
      s += corner(bl_, x0 + 8, y1 - 8, 'start', 2);
      s += corner(br, x1 - 8, y1 - 8, 'end', 3);
    }
  }

  // Bubble geometry first — a label must dodge EVERY bubble, so all discs are
  // known before any label is placed. Dots always sit at their true
  // coordinates, even when coincident; only labels move.
  const dots: Dot[] = points.map((p) => ({
    px: X(p.x),
    py: Y(p.y),
    r: scRadius(p.size, minS, maxS),
  }));

  const marks = marksOf(points.map((p) => p.accent));
  let dotSvg = `<g${bl('points')}>`;
  points.forEach((p, i) => {
    const d = dots[i];
    if (d === undefined) return;
    const color = pointColor(marks[i]);
    const tip = `${p.label !== undefined ? `${p.label} — ` : ''}${fmt(p.x, undefined)}, ${fmt(p.y, data.unit)}${p.size !== undefined ? ` (${fmt(p.size, undefined)})` : ''}`;
    dotSvg += `<circle cx="${d.px}" cy="${d.py}" r="${d.r}" fill="${color}" fill-opacity="0.18" stroke="${color}" stroke-width="1.5"${bp(`points.${i}`)}><title>${escapeHtml(tip)}</title></circle>`;
  });
  dotSvg += `</g>`;

  // Label placement, in point-index order (deterministic). Candidates per
  // label: right of the bubble, left (end-anchor flip), above, below. A
  // candidate is rejected when its box leaves the SVG, crosses ANY bubble, or
  // crosses an already-placed label. No candidate fits → the label is
  // SUPPRESSED (the bubble's <title> still carries it). A label that lands
  // >14px from its default anchor gets a thin leader line back to its bubble.
  const placed: LabelBox[] = [];
  let leaders = '';
  let labels = '';
  points.forEach((p, i) => {
    const d = dots[i];
    if (d === undefined || p.label === undefined || p.label === '') return;
    const text = scLabel(p.label);
    const w = text.length * 6;
    const { px, py, r } = d;
    // Clearance radius: a coincident or covering bubble (think identical
    // coordinates with different sizes) is what the label really has to
    // clear, not just this point's own disc.
    let rc = r;
    for (const c of dots) {
      const dist = Math.sqrt((c.px - px) * (c.px - px) + (c.py - py) * (c.py - py));
      if (dist < c.r && c.r + dist > rc) rc = c.r + dist;
    }
    const candidates: ReadonlyArray<{ anchor: 'start' | 'end' | 'middle'; lx: number; ly: number }> = [
      { anchor: 'start', lx: px + rc + 5, ly: py + 3 },
      { anchor: 'end', lx: px - rc - 5, ly: py + 3 },
      { anchor: 'middle', lx: px, ly: py - rc - 7 },
      { anchor: 'middle', lx: px, ly: py + rc + 12 },
    ];
    const boxFor = (c: (typeof candidates)[number]): LabelBox => ({
      x0: c.anchor === 'start' ? c.lx : c.anchor === 'end' ? c.lx - w : c.lx - w / 2,
      x1: c.anchor === 'start' ? c.lx + w : c.anchor === 'end' ? c.lx : c.lx + w / 2,
      y0: c.ly - 9,
      y1: c.ly + 2,
    });
    const fits = (b: LabelBox): boolean =>
      b.x0 >= 2 &&
      b.x1 <= width - 2 &&
      b.y0 >= 2 &&
      b.y1 <= height - 2 &&
      !dots.some((c) => circleHitsBox(c, b)) &&
      !placed.some((pb) => boxesOverlap(pb, b));
    const pick = candidates.find((c) => fits(boxFor(c)));
    if (pick === undefined) return; // suppressed — <title> keeps the data
    const box = boxFor(pick);
    placed.push(box);
    // Leader when the label sits away from its default (right-of-bubble) spot.
    const dx = pick.lx - (px + r + 5);
    const dy = pick.ly - (py + 3);
    if (Math.sqrt(dx * dx + dy * dy) > 14) {
      // From the box edge nearest the bubble to just outside the bubble rim.
      const sxp = Math.max(box.x0, Math.min(px, box.x1));
      const syp = Math.max(box.y0, Math.min(py, box.y1));
      const len = Math.sqrt((px - sxp) * (px - sxp) + (py - syp) * (py - syp));
      if (len > r + 2) {
        const ex = px - ((px - sxp) / len) * (r + 1.5);
        const ey = py - ((py - syp) / len) * (r + 1.5);
        leaders += `<line x1="${Math.round(sxp * 10) / 10}" y1="${Math.round(syp * 10) / 10}" x2="${Math.round(ex * 10) / 10}" y2="${Math.round(ey * 10) / 10}" stroke="var(--muted)" stroke-width="0.75"/>`;
      }
    }
    const full = p.label.length > SC_LABEL_CHARS ? `<title>${escapeHtml(p.label)}</title>` : '';
    // Inline style, not an attribute: editors read the anchor back from it.
    labels += `<text x="${Math.round(pick.lx * 10) / 10}" y="${Math.round(pick.ly * 10) / 10}" class="t-sub c-ink" style="text-anchor:${pick.anchor}"${bp(`points.${i}.label`)}>${escapeHtml(text)}${full}</text>`;
  });

  // Leaders under the bubbles, labels on top.
  s += leaders + dotSvg + labels + `</svg>`;

  const items: LegendItem[] = [];
  if (marks.some((m) => m === undefined)) items.push({ swatch: 'fill', fill: 'var(--ink)', label: 'point' });
  if (marks.some((m) => m === 'focal')) items.push({ swatch: 'fill', fill: 'var(--accent)', label: 'focal' });
  if (marks.some((m) => m === 'negative')) items.push({ swatch: 'fill', fill: 'var(--negative)', label: 'negative' });
  if (guides?.x !== undefined || guides?.y !== undefined) items.push({ swatch: 'edge-dashed', label: 'guide' });
  return { svg: s, legend: renderLegend(items) };
}

/**
 * `kind: gauge` — radial progress against a ceiling.
 *
 * A donut answers "how does the whole split up"; a gauge answers "how far
 * along is this one number", which is the shape an SLO, a quota, a migration
 * or a rollout actually has. Each item is an arc over the same 270° sweep
 * (open at the bottom, so the dial reads as a dial rather than a ring), swept
 * to `value / max` — `max` defaults to 100, the percentage case.
 *
 * One item draws a single big dial with the value in the middle; several
 * become concentric rings, outermost first, each with the track behind it so
 * an empty arc still reads as "nearly none of it" instead of as missing.
 */
function renderGauge(data: ChartData, items: readonly DonutItem[]): Drawn {
  const width = 420;
  const solo = items.length <= 1;
  const height = solo ? 246 : 264;
  const cx = Math.round(width / 2);
  const cy = solo ? 150 : 158;
  const max = data.max !== undefined && data.max > 0 ? data.max : 100;
  // 270°: from 135° past the bottom-left, clockwise to 45°.
  const START = 135;
  const SWEEP = 270;
  const outer = solo ? 92 : 96;
  const band = solo ? 26 : 16;
  const gap = 7;

  const pointOn = (r: number, deg: number): string => {
    const a = (deg * Math.PI) / 180;
    return `${Math.round((cx + r * Math.cos(a)) * 10) / 10} ${Math.round((cy + r * Math.sin(a)) * 10) / 10}`;
  };
  const arc = (r: number, fraction: number): string => {
    const sweep = SWEEP * Math.min(Math.max(fraction, 0), 1);
    if (sweep <= 0) return '';
    const large = sweep > 180 ? 1 : 0;
    return `M ${pointOn(r, START)} A ${r} ${r} 0 ${large} 1 ${pointOn(r, START + sweep)}`;
  };

  let s = svgOpenSize(width, height);
  const marks = marksOf(items.map((it) => it.accent));
  s += `<g${bl('items')}>`;
  items.forEach((it, i) => {
    const r = outer - i * (band + gap);
    if (r <= band) return; // out of rings — the legend still names the item
    const color = sliceTone(i, marks[i]).fill;
    const fraction = pos(it.value) / max;
    s += `<g${bp(`items.${i}`)}>`;
    s += `<path d="${arc(r, 1)}" fill="none" stroke="var(--paper)" stroke-width="${band}" stroke-linecap="round"${DECORATIVE}/>`;
    const filled = arc(r, fraction);
    if (filled !== '') {
      s += `<path d="${filled}" fill="none" stroke="${color}" stroke-width="${band}" stroke-linecap="round"/>`;
    }
    s += `</g>`;
  });
  s += `</g>`;

  const lead = items[0];
  if (lead !== undefined) {
    // The middle carries the leading item: its value big, then what it is.
    s += `<text x="${cx}" y="${cy + (solo ? 6 : 2)}" class="chart-total">${escapeHtml(fmt(pos(lead.value), data.unit))}</text>`;
    const caption = solo ? (lead.desc ?? lead.label) : 'OF ' + fmt(max, data.unit);
    s += `<text x="${cx}" y="${cy + (solo ? 26 : 20)}" class="t-eyebrow" text-anchor="middle">${escapeHtml(caption.toUpperCase())}</text>`;
  }
  // Scale ends, just outside the two open ends of the dial (135° and 45°) —
  // clear of the stroke, so a full arc never runs over its own labels.
  const scaleR = outer + band / 2 + 13;
  const scaleX = Math.round(scaleR * Math.cos((135 * Math.PI) / 180));
  const scaleY = Math.round(cy + scaleR * Math.sin((135 * Math.PI) / 180));
  s += `<text x="${cx + scaleX}" y="${scaleY}" class="t-sub c-soft" text-anchor="middle">0</text>`;
  s += `<text x="${cx - scaleX}" y="${scaleY}" class="t-sub c-soft" text-anchor="middle">${escapeHtml(fmt(max, data.unit))}</text>`;
  s += `</svg>`;

  const legend = items.length > 1 || (items[0]?.desc !== undefined && !solo) ? itemsLegend(items, data.unit) : '';
  return { svg: s, legend };
}

function renderRadar(data: ChartData, labels: readonly string[], series: readonly Series[]): string {
  const width = 420;
  const height = 280;
  const cx = Math.round(width / 2);
  const cy = Math.round(height / 2);
  const r = 100;
  const n = labels.length;
  // Fewer than 3 axes can't form a web — render the empty frame.
  if (n < 3) return svgOpenSize(width, 60) + `</svg>`;
  const values = series.flatMap((s) => s.values.slice(0, n).map(pos));
  const dataMax = values.length > 0 ? Math.max(...values) : 0;
  const ceiling = data.max !== undefined && data.max > 0 ? data.max : dataMax > 0 ? dataMax : 1;
  const rings = niceTicks(ceiling);
  const vMax = rings[rings.length - 1] ?? ceiling;
  const angleAt = (i: number): number => -Math.PI / 2 + (2 * Math.PI * i) / n;
  const ptAt = (i: number, radius: number): readonly [number, number] => {
    const a = angleAt(i);
    return [Math.round(cx + radius * Math.cos(a)), Math.round(cy + radius * Math.sin(a))];
  };
  let s = svgOpenSize(width, height);
  // Concentric rings (hairline polygons, one per nice tick) + axis spokes.
  rings.forEach((t, ri) => {
    if (ri === 0) return;
    const pts = Array.from({ length: n }, (_, i) => ptAt(i, (r * t) / vMax).join(','));
    s += `<polygon points="${pts.join(' ')}" fill="none" stroke="${ri === rings.length - 1 ? 'var(--rule-solid)' : 'var(--rule)'}" stroke-width="1"${DECORATIVE}/>`;
  });
  for (let i = 0; i < n; i++) {
    const [x, y] = ptAt(i, r);
    s += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="var(--rule)" stroke-width="1"${DECORATIVE}/>`;
  }
  // Axis labels at the spoke ends, anchored away from the web.
  s += `<g${bl('labels')}>`;
  labels.forEach((label, i) => {
    const a = angleAt(i);
    const [x, y] = ptAt(i, r + 14);
    const cos = Math.cos(a);
    const anchor = cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle';
    s += `<text x="${x}" y="${y + 3}" class="t-sub" text-anchor="${anchor}"${bp(`labels.${i}`)}>${escapeHtml(label)}</text>`;
  });
  s += `</g>`;
  // One stroked polygon (+ vertex dots) per series.
  s += `<g${bl('series')}>`;
  series.forEach((sr, si) => {
    const color = seriesColor(si, series.length, sr.accent);
    const pts = Array.from({ length: n }, (_, i) => {
      const v = Math.min(pos(sr.values[i] ?? 0), vMax);
      return ptAt(i, (r * v) / vMax);
    });
    s += `<g${bp(`series.${si}`)}>`;
    s += `<polygon points="${pts.map((p) => p.join(',')).join(' ')}" fill="${color}" fill-opacity="0.1" stroke="${color}" stroke-width="1.75" stroke-linejoin="round"/>`;
    pts.forEach(([x, y]) => {
      s += `<circle cx="${x}" cy="${y}" r="2.5" fill="var(--paper)" stroke="${color}" stroke-width="1.5"/>`;
    });
    s += `</g>`;
  });
  s += `</g>`;
  return s + `</svg>`;
}

function svgOpen(f: Frame): string {
  return svgOpenSize(f.width, f.height);
}
function svgOpenSize(w: number, h: number): string {
  return `<svg viewBox="0 0 ${w} ${h}" role="img"><title>Chart</title>`;
}

// ─── kind: waterfall (a budget cascade — the former `waterfall` type) ────────
// Horizontal cascading bars: each bar starts at the running total of the
// previous items and spans its value; a final full-width TOTAL bar runs from
// 0 in ink. An optional `budget` draws a dashed cap line — any bar segment
// past it tints negative, and the total row gets an over / under / on-budget
// chip. Renders inside the diagram frame (tag BUDGET).

const WFL_WIDTH = 720;
const WFL_LABEL_W = 150; // fixed left label column
const WFL_BAR_H = 34;
const WFL_GAP = 14;

/** Formats a value with the unit suffix (default "ms"), trimming float noise. */
function wflFmt(v: number, unit: string | undefined): string {
  const n = Math.round(v * 100) / 100;
  return `${n.toLocaleString('en-US')} ${unit ?? 'ms'}`;
}

/** Max characters that fit the fixed label column at 13px. */
const WFL_LABEL_CHARS = 23;

/** Truncates a label (with optional desc) to fit the left column. */
function wflLabelFor(item: DonutItem): string {
  const full =
    item.desc !== undefined && item.desc.length > 0 ? `${item.label} — ${item.desc}` : item.label;
  if (full.length <= WFL_LABEL_CHARS) return full;
  if (item.label.length <= WFL_LABEL_CHARS) return item.label;
  return `${item.label.slice(0, WFL_LABEL_CHARS - 1)}…`;
}

function renderWaterfallBody(data: ChartData): string {
  const items = data.items ?? [];
  const unit = data.unit;
  const total = items.reduce((acc, it) => acc + pos(it.value), 0);
  const budget = data.budget !== undefined && data.budget > 0 ? data.budget : undefined;
  const hasBudget = budget !== undefined;
  const topPad = hasBudget ? 22 : 6;
  const rows = items.length + (items.length > 0 ? 1 : 0); // items + TOTAL
  const height = topPad + rows * (WFL_BAR_H + WFL_GAP) - (rows > 0 ? WFL_GAP : 0) + 6;
  const x0 = WFL_LABEL_W + 10;
  // Right margin: room for the value text, plus the over/under chip when a
  // budget is set.
  const valueW = hasBudget ? 176 : 74;
  const plotW = WFL_WIDTH - x0 - valueW;
  // A budget far beyond the cascade would crush the bars into slivers: scale to
  // the bars instead and annotate the off-scale budget (the under-chip carries
  // the headroom). The in-plot cap line only draws when it's within ~1.4× total.
  const budgetOnScale = hasBudget && total > 0 && budget <= total * 1.4;
  const scaleMax = budgetOnScale ? Math.max(total, budget) : total > 0 ? total : (budget ?? 0);
  const px = (v: number): number => (scaleMax > 0 ? Math.round((plotW * v) / scaleMax) : 0);

  let s = `<svg viewBox="0 0 ${WFL_WIDTH} ${Math.max(height, 40)}" role="img"><title>Budget waterfall</title>`;

  // Cascading item bars.
  let running = 0;
  let over = false;
  const marks = marksOf(items.map((it) => it.accent));
  const focal = marks.includes('focal');
  s += `<g${bl('items')}>`;
  items.forEach((it, i) => {
    const v = pos(it.value);
    const y = topPad + i * (WFL_BAR_H + WFL_GAP);
    const bx = x0 + px(running);
    const bw = Math.max(px(v), v > 0 ? 2 : 0);
    const tone = inkTone(i, marks[i]);
    s += `<g${bp(`items.${i}`)}>`;
    s += `<text x="0" y="${y + 22}" class="t-name"${bp(`items.${i}.label`)}>${escapeHtml(wflLabelFor(it))}</text>`;
    s += `<rect x="${bx}" y="${y}" width="${bw}" height="${WFL_BAR_H}" fill="${tone.fill}" stroke="${tone.stroke}" stroke-width="1"/>`;
    // Segment past the budget line tints negative.
    if (hasBudget && running + v > budget) {
      over = true;
      const overStart = Math.max(running, budget);
      const ox = x0 + px(overStart);
      const ow = Math.max(px(running + v) - px(overStart), 2);
      s += `<rect x="${ox}" y="${y}" width="${ow}" height="${WFL_BAR_H}" fill="var(--negative)"/>`;
    }
    s += `<text x="${bx + bw + 6}" y="${y + 22}" class="t-sub c-muted"${bp(`items.${i}.value`)}>${escapeHtml(wflFmt(v, unit))}</text>`;
    s += `</g>`;
    running += v;
  });
  s += `</g>`;

  // Full-width TOTAL bar from 0.
  if (items.length > 0) {
    const y = topPad + items.length * (WFL_BAR_H + WFL_GAP);
    const tw = Math.max(px(total), total > 0 ? 2 : 0);
    s += `<rect x="${x0}" y="${y}" width="${tw}" height="${WFL_BAR_H}" fill="var(--ink)"/>`;
    s += `<text x="${x0 + 10}" y="${y + 21}" class="t-eyebrow"${ON_DARK}>TOTAL</text>`;
    s += `<text x="${x0 + tw + 6}" y="${y + 22}" class="t-sub c-ink">${escapeHtml(wflFmt(total, unit))}</text>`;
    // Over / under / on-budget chip after the total value.
    if (hasBudget) {
      const diff = Math.round((total - budget) * 100) / 100;
      const isOver = diff > 0;
      const label = diff === 0 ? 'on budget' : isOver ? `${wflFmt(diff, unit)} over` : `${wflFmt(-diff, unit)} under`;
      const cw = 20 + label.length * 6;
      const cx = x0 + tw + 6 + Math.round(wflFmt(total, unit).length * 6.2) + 8;
      const stroke = isOver ? 'var(--negative)' : 'var(--rule-solid)';
      const cls = isOver ? ' c-negative' : ' c-muted';
      s += `<rect x="${cx}" y="${y + 4}" width="${cw}" height="${WFL_BAR_H - 8}" rx="2" fill="var(--paper)" stroke="${stroke}" stroke-width="1"/>`;
      s += `<text x="${cx + Math.round(cw / 2)}" y="${y + 21}" class="t-arrow${cls}" text-anchor="middle">${escapeHtml(label)}</text>`;
    }
  }

  // Dashed budget cap line + label (drawn last so it sits above the bars).
  if (hasBudget && budgetOnScale) {
    const lx = x0 + px(budget);
    s += `<line x1="${lx}" y1="${topPad - 6}" x2="${lx}" y2="${Math.max(height, 40) - 4}" stroke="var(--negative)" stroke-width="1.25" stroke-dasharray="5 4"/>`;
    // Flip the label to the left of the line when it would overflow the frame.
    const flip = lx > WFL_WIDTH - 130;
    s += `<text x="${flip ? lx - 6 : lx + 6}" y="${topPad - 8}" class="t-arrow c-negative"${flip ? ' text-anchor="end"' : ''}${bp('budget')}>budget: ${escapeHtml(wflFmt(budget, unit))}</text>`;
  } else if (hasBudget) {
    // Off-scale budget: annotate instead of drawing an unreachable line.
    s += `<text x="${WFL_WIDTH - 4}" y="${topPad - 8}" class="t-arrow c-negative" text-anchor="end"${bp('budget')}>budget: ${escapeHtml(wflFmt(budget, unit))} — beyond scale →</text>`;
  }

  s += `</svg>`;

  const legend: LegendItem[] = [];
  if (items.length > 0) legend.push({ swatch: 'fill', fill: 'var(--ink)', label: 'step (darker first) · total' });
  if (focal) legend.push({ swatch: 'fill', fill: 'var(--accent)', label: 'focal step' });
  if (hasBudget) legend.push({ swatch: 'edge-dashed', label: 'budget cap' });
  if (over) legend.push({ swatch: 'fill', fill: 'var(--negative)', label: 'over budget' });
  const legendHtml = renderLegend(legend);
  return diagramFrame(
    {
      tag: 'BUDGET',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legendHtml.length > 0 ? { legendHtml } : {}),
    },
    s,
  );
}

// ─── kind: funnel (conversion funnel — the former `funnel` type) ─────────────
// Stages stack vertically as centered trapezoid bands whose width is
// proportional to `value / maxValue` (with a 28% floor so labels always fit).
// Bands step down the ink ramp. Between bands, a small mono chip shows the
// stage-to-stage conversion (`↓ NN%`) — honestly above 100% when a stage
// grows, and 0% when the previous stage is 0. Stages come from `items`, or
// the funnel-era legacy `stages` (whose data paths they keep). Renders inside
// the diagram frame (tag FUNNEL).

const FN_WIDTH = 560;
const FN_BAND_H = 54;
const FN_GAP = 10; // gap between a band and the conversion-chip zone
const FN_CHIP_H = 18;
const FN_MIN_FRAC = 0.28; // minimum band width so labels fit

/** Formats a value with thousands separators plus the optional unit suffix. */
function fnFmt(v: number, unit: string | undefined): string {
  const n = Math.round(v * 100) / 100;
  return `${n.toLocaleString('en-US')}${unit !== undefined ? ` ${unit}` : ''}`;
}

/** Band width in px for a value, floored at FN_MIN_FRAC of the drawable width. */
function fnWidthFor(value: number, maxValue: number): number {
  const frac = maxValue > 0 ? pos(value) / maxValue : 0;
  return Math.round(FN_WIDTH * Math.max(frac, FN_MIN_FRAC));
}

function renderFunnelBand(
  stage: DonutItem,
  nextStage: DonutItem | undefined,
  i: number,
  mark: Mark,
  maxValue: number,
  y: number,
  unit: string | undefined,
  key: string,
): string {
  const cx = FN_WIDTH / 2;
  const topW = fnWidthFor(stage.value, maxValue);
  const botW = nextStage !== undefined ? fnWidthFor(nextStage.value, maxValue) : topW;
  const tone = inkTone(i, mark);
  const pts = [
    `${cx - topW / 2},${y}`,
    `${cx + topW / 2},${y}`,
    `${cx + botW / 2},${y + FN_BAND_H}`,
    `${cx - botW / 2},${y + FN_BAND_H}`,
  ].join(' ');
  const hasDesc = stage.desc !== undefined && stage.desc.length > 0;
  const labelY = hasDesc ? y + 20 : y + 24;
  const valueY = hasDesc ? y + 35 : y + 40;
  // Text on a dark band is paper (no halo); on a pale band it keeps the roles.
  const nameAttrs = tone.dark ? ` class="t-name"${ON_DARK}` : ' class="t-name"';
  const subAttrs = tone.dark ? ` class="t-sub"${ON_DARK}` : ' class="t-sub c-muted"';
  const descText = hasDesc
    ? `<text x="${cx}" y="${y + 47}"${subAttrs} text-anchor="middle"${bp(`${key}.${i}.desc`)}>${escapeHtml(stage.desc ?? '')}</text>`
    : '';
  return (
    `<g${bp(`${key}.${i}`)}>` +
    `<polygon points="${pts}" fill="${tone.fill}" stroke="${tone.stroke}" stroke-width="1"/>` +
    `<text x="${cx}" y="${labelY}"${nameAttrs} text-anchor="middle"${bp(`${key}.${i}.label`)}>${escapeHtml(stage.label)}</text>` +
    `<text x="${cx}" y="${valueY}"${subAttrs} text-anchor="middle"${bp(`${key}.${i}.value`)}>${escapeHtml(fnFmt(pos(stage.value), unit))}</text>` +
    descText +
    `</g>`
  );
}

function renderFunnelChip(from: DonutItem, to: DonutItem, y: number): string {
  const cx = FN_WIDTH / 2;
  const prev = pos(from.value);
  const next = pos(to.value);
  const pct = prev > 0 ? Math.round((next / prev) * 100) : 0;
  const label = `↓ ${pct}%`;
  const w = 34 + String(pct).length * 7;
  return (
    `<rect x="${cx - w / 2}" y="${y}" width="${w}" height="${FN_CHIP_H}" rx="2" fill="var(--paper)" stroke="var(--rule-solid)" stroke-width="1"/>` +
    `<text x="${cx}" y="${y + 13}" class="t-arrow" text-anchor="middle">${escapeHtml(label)}</text>`
  );
}

function renderFunnelBody(data: ChartData): string {
  // `items` is the canonical field; `stages` is the funnel-era legacy synonym.
  // Data paths address whichever field the YAML actually uses.
  const key = data.items !== undefined ? 'items' : 'stages';
  const stages = data.items ?? data.stages ?? [];
  const maxValue = Math.max(...stages.map((s) => pos(s.value)), 0);
  const stepH = FN_BAND_H + FN_GAP + FN_CHIP_H + FN_GAP;
  const height = Math.max(
    stages.length * FN_BAND_H + (stages.length - 1) * (FN_GAP + FN_CHIP_H + FN_GAP),
    0,
  );
  let s = `<svg viewBox="0 0 ${FN_WIDTH} ${height}" role="img"><title>Funnel</title>`;
  const marks = marksOf(stages.map((st) => st.accent));
  s += `<g${bl(key)}>`;
  stages.forEach((stage, i) => {
    const y = i * stepH;
    s += renderFunnelBand(stage, stages[i + 1], i, marks[i], maxValue, y, data.unit, key);
    const next = stages[i + 1];
    if (next !== undefined) s += renderFunnelChip(stage, next, y + FN_BAND_H + FN_GAP);
  });
  s += `</g>`;
  s += `</svg>`;
  const legend: LegendItem[] = [];
  if (stages.length > 1) legend.push({ swatch: 'fill', fill: 'var(--ink)', label: 'stage (darker first)' });
  if (marks.includes('focal')) legend.push({ swatch: 'fill', fill: 'var(--accent)', label: 'focal stage' });
  if (marks.includes('negative')) legend.push({ swatch: 'fill', fill: 'var(--negative)', label: 'negative' });
  if (stages.length > 1) legend.push({ swatch: 'chip', chip: '↓ %', label: 'conversion from the stage above' });
  const legendHtml = renderLegend(legend);
  return diagramFrame(
    {
      tag: 'FUNNEL',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legendHtml.length > 0 ? { legendHtml } : {}),
    },
    s,
  );
}

export function renderChart(data: ChartData): string {
  const kind = data.kind ?? 'bar';
  // Waterfall and funnel are whole visual languages of their own (moved in
  // from the former `waterfall` / `funnel` types) — they own their frame.
  if (kind === 'waterfall') return renderWaterfallBody(data);
  if (kind === 'funnel') return renderFunnelBody(data);
  const labels = data.labels ?? [];
  const series = data.series ?? [];
  let drawn: Drawn;
  if (kind === 'donut') {
    drawn = renderDonut(data, data.items ?? []);
  } else if (kind === 'gauge') {
    drawn = renderGauge(data, data.items ?? []);
  } else if (kind === 'scatter' && data.points !== undefined && data.points.length > 0) {
    // Numeric-axis scatter: each point owns its x/y. The `labels`+`series`
    // scatter below stays as the ordinal fallback for existing docs.
    drawn = renderScatterPoints(data, data.points);
  } else if (kind === 'radar') {
    // Radar uses `labels` as the axes (3+ required to draw a web).
    drawn = { svg: renderRadar(data, labels, series), legend: seriesLegend(series) };
  } else {
    // Derive labels when omitted so a bare series still charts (1, 2, 3, …).
    const n = Math.max(labels.length, ...series.map((s) => s.values.length), 0);
    const cats = labels.length > 0 ? labels : Array.from({ length: n }, (_, i) => String(i + 1));
    const tagLabels = labels.length > 0;
    const body =
      kind === 'bar'
        ? renderBars(data, cats, series, tagLabels)
        : kind === 'stacked'
          ? renderStacked(data, cats, series, tagLabels)
          : kind === 'scatter'
            ? renderScatter(data, cats, series, tagLabels)
            : renderLineArea(data, cats, series, kind === 'area', tagLabels);
    drawn = { svg: body, legend: seriesLegend(series) };
  }
  return diagramFrame(
    {
      tag: 'CHART',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(drawn.legend.length > 0 ? { legendHtml: drawn.legend } : {}),
    },
    drawn.svg,
  );
}
