/**
 * Renders a `chart` block — a declarative data chart in pure SVG (no deps).
 * Five kinds: `bar` (grouped, rounded bars with subtle value labels), `line`
 * (2px polyline with dots), `area` (line + soft fill), `donut` (stroked
 * arcs + centered total + a legend row beneath, like c4's legend), and
 * `radar` (a polygon web — concentric rings + spokes, one stroked polygon
 * per series; needs 3+ labels as axes).
 *
 * Axes are hairlines (`var(--rule)`), category labels are 9.5px mono gray.
 * Series colours come from the bright diagram palette (see `blockStyle`),
 * cycling navy → teal → amber → purple → green → blue when no accent is set.
 * Negative values are clamped at 0.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';

type ChartData = BlockDataMap['chart'];
type Series = NonNullable<ChartData['series']>[number];
type DonutItem = NonNullable<ChartData['items']>[number];

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

/** Default colour cycle when a series/item carries no accent. */
const CYCLE = ['#0e54a1', '#0f766e', '#f7952c', '#6b21a8', '#1f9747', '#1a6dbe'];

function colorAt(accent: string | undefined, i: number): string {
  if (accent !== undefined && ACCENT_HEX[accent] !== undefined) return ACCENT_HEX[accent];
  return CYCLE[i % CYCLE.length] ?? '#0e54a1';
}

/** Clamps negatives to 0 (charts render the non-negative range only). */
const pos = (v: number): number => (Number.isFinite(v) && v > 0 ? v : 0);

/** Formats a value with the optional unit suffix, trimming float noise. */
function fmt(v: number, unit: string | undefined): string {
  const n = Math.round(v * 100) / 100;
  return `${n}${unit ?? ''}`;
}

/** Shared cartesian frame geometry for bar / line / area. */
interface Frame {
  readonly width: number;
  readonly height: number;
  readonly x0: number; // plot left
  readonly x1: number; // plot right
  readonly y0: number; // plot top
  readonly y1: number; // plot bottom (baseline)
  readonly yMax: number;
}

const TICKS = 4;

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
  const yMax = data.max !== undefined && data.max > 0 ? data.max : dataMax > 0 ? dataMax : 1;
  return { width, height, x0: 52, x1: width - 18, y0: 18, y1: height - 32, yMax };
}

/** Baseline, hairline gridlines, tick labels, and category labels. */
function axes(f: Frame, labels: readonly string[], unit: string | undefined, tagLabels: boolean): string {
  let s = '';
  for (let t = 0; t <= TICKS; t++) {
    const y = Math.round(f.y1 - ((f.y1 - f.y0) * t) / TICKS);
    s += `<line x1="${f.x0}" y1="${y}" x2="${f.x1}" y2="${y}" class="chart-axis"${t === 0 ? '' : ' opacity="0.6"'}/>`;
    s += `<text x="${f.x0 - 8}" y="${y + 3}" class="chart-tick">${escapeHtml(fmt((f.yMax * t) / TICKS, unit))}</text>`;
  }
  const n = Math.max(labels.length, 1);
  const slot = (f.x1 - f.x0) / n;
  // Category labels are only addressable when they come from `labels` in the
  // YAML (they can be derived 1, 2, 3, … when omitted).
  if (tagLabels) s += `<g${bl('labels')}>`;
  labels.forEach((label, i) => {
    const x = Math.round(f.x0 + slot * i + slot / 2);
    s += `<text x="${x}" y="${f.y1 + 18}" class="chart-label"${tagLabels ? bp(`labels.${i}`) : ''}>${escapeHtml(label)}</text>`;
  });
  if (tagLabels) s += `</g>`;
  return s;
}

/** Legend row beneath the SVG (same `.legend` chrome as c4). */
function legendRow(
  entries: ReadonlyArray<{ label: string; color: string; path: string }>,
  listPath: string,
): string {
  if (entries.length === 0) return '';
  const items = entries
    .map(
      (e) =>
        `<span class="item"${bp(e.path)}><span class="sw" style="background:${e.color};border:1px solid #d1d5db"></span>${escapeHtml(e.label)}</span>`,
    )
    .join('');
  return `<div class="legend"${bl(listPath)}>${items}</div>`;
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
    const color = colorAt(sr.accent, si);
    s += `<g${bp(`series.${si}`)}>`;
    for (let ci = 0; ci < labels.length; ci++) {
      const v = pos(sr.values[ci] ?? 0);
      const capped = Math.min(v, f.yMax);
      const h = Math.round(((f.y1 - f.y0) * capped) / f.yMax);
      const x = Math.round(f.x0 + slot * ci + groupPad + si * (barW + barGap));
      const y = f.y1 - h;
      s += `<g${bp(`series.${si}.values.${ci}`)}>`;
      s += `<rect x="${x}" y="${y}" width="${barW}" height="${Math.max(h, 1)}" rx="3" fill="${color}"${h === 0 ? ' opacity="0.35"' : ''}/>`;
      s += `<text x="${x + Math.round(barW / 2)}" y="${y - 4}" class="chart-val">${escapeHtml(fmt(v, data.unit))}</text>`;
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
    const color = colorAt(sr.accent, si);
    const pts = sr.values.slice(0, labels.length).map((v, i) => `${xAt(i)},${yAt(v)}`);
    if (pts.length === 0) return;
    s += `<g${bp(`series.${si}`)}>`;
    if (area && pts.length > 1) {
      const first = xAt(0);
      const last = xAt(pts.length - 1);
      s += `<polygon points="${first},${f.y1} ${pts.join(' ')} ${last},${f.y1}" fill="${color}" fill-opacity="0.15" stroke="none"/>`;
    }
    if (pts.length > 1) {
      s += `<polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>`;
    }
    sr.values.slice(0, labels.length).forEach((v, i) => {
      s += `<circle cx="${xAt(i)}" cy="${yAt(v)}" r="3" fill="${color}"/>`;
    });
    s += `</g>`;
  });
  s += `</g>`;
  return svgOpen(f) + axes(f, labels, data.unit, tagLabels) + s + `</svg>`;
}

function renderDonut(data: ChartData, items: readonly DonutItem[]): string {
  const width = 420;
  const height = 220;
  const cx = Math.round(width / 2);
  const cy = Math.round(height / 2);
  const r = 74;
  const sw = 26;
  const total = items.reduce((acc, it) => acc + pos(it.value), 0);
  let s = svgOpenSize(width, height);
  if (total <= 0) {
    s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--rule)" stroke-width="${sw}"/>`;
  } else {
    let angle = -90;
    s += `<g${bl('items')}>`;
    items.forEach((it, i) => {
      const v = pos(it.value);
      if (v === 0) return;
      const sweep = (v / total) * 360;
      const color = colorAt(it.accent, i);
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
      }
      angle += sweep;
    });
    s += `</g>`;
  }
  s += `<text x="${cx}" y="${cy + 2}" class="chart-total">${escapeHtml(fmt(total, data.unit))}</text>`;
  s += `<text x="${cx}" y="${cy + 20}" class="chart-total-label">TOTAL</text>`;
  s += `</svg>`;
  const legend = legendRow(
    items.map((it, i) => ({
      label: `${it.label} — ${fmt(pos(it.value), data.unit)}`,
      color: colorAt(it.accent, i),
      path: `items.${i}`,
    })),
    'items',
  );
  return s + legend;
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
      s += `<rect x="${x}" y="${top}" width="${Math.round(barW)}" height="${h}" fill="${colorAt(sr.accent, si)}"${bp(`series.${si}.values.${ci}`)}><title>${escapeHtml(`${sr.label} — ${fmt(v, data.unit)}`)}</title></rect>`;
    });
    // The column total sits above the stack, which is the number people read.
    const total = series.reduce((a, sr) => a + pos(sr.values[ci] ?? 0), 0);
    if (total > 0) {
      s += `<text x="${x + Math.round(barW / 2)}" y="${top - 5}" class="chart-val">${escapeHtml(fmt(total, data.unit))}</text>`;
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
    const color = colorAt(sr.accent, si);
    s += `<g${bp(`series.${si}`)}>`;
    sr.values.slice(0, labels.length).forEach((v, i) => {
      s += `<circle cx="${xAt(i)}" cy="${yAt(v)}" r="5" fill="${color}" fill-opacity="0.75" stroke="${color}" stroke-width="1.5"><title>${escapeHtml(`${sr.label} — ${fmt(pos(v), data.unit)}`)}</title></circle>`;
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

/** A nice tick step (1/2/5 × 10^k) for roughly `count` ticks over `range`. */
function niceStep(range: number, count: number): number {
  const raw = range / Math.max(count, 1);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const scaled = raw / mag;
  const nice = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return nice * mag;
}

interface NumScale {
  readonly min: number;
  readonly max: number;
  readonly ticks: readonly number[];
}

/** Pads a data extent, snaps it to nice tick multiples, and lists the ticks. */
function numScale(values: readonly number[], count: number): NumScale {
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
  const step = niceStep(hi - lo, count);
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

function renderScatterPoints(data: ChartData, points: readonly ScatterPoint[]): string {
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
  const sx = numScale(xs, 5);
  const sy = numScale(ys, 5);
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
    s += `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" class="chart-axis"${t === sy.min ? '' : ' opacity="0.6"'}/>`;
    s += `<text x="${x0 - 8}" y="${y + 3}" class="chart-tick">${escapeHtml(fmt(t, data.unit))}</text>`;
  }
  for (const t of sx.ticks) {
    const x = X(t);
    s += `<line x1="${x}" y1="${y0}" x2="${x}" y2="${y1}" class="chart-axis" opacity="${t === sx.min ? 1 : 0.35}"/>`;
    s += `<text x="${x}" y="${y1 + 16}" class="chart-label">${escapeHtml(fmt(t, undefined))}</text>`;
  }

  // Axis titles.
  if (data.xLabel !== undefined) {
    s += `<text x="${Math.round((x0 + x1) / 2)}" y="${height - 8}" class="chart-label"${bp('xLabel')}>${escapeHtml(data.xLabel)}</text>`;
  }
  if (data.yLabel !== undefined) {
    const cy = Math.round((y0 + y1) / 2);
    s += `<text x="14" y="${cy}" class="chart-label" transform="rotate(-90 14 ${cy})"${bp('yLabel')}>${escapeHtml(data.yLabel)}</text>`;
  }

  // Dashed reference guides + muted quadrant corner labels (TL, TR, BL, BR).
  if (guides !== undefined) {
    if (guides.x !== undefined) {
      const gx = X(guides.x);
      s += `<line x1="${gx}" y1="${y0}" x2="${gx}" y2="${y1}" stroke="var(--gray)" stroke-width="1" stroke-dasharray="5 4" opacity="0.65"${bp('guides.x')}/>`;
    }
    if (guides.y !== undefined) {
      const gy = Y(guides.y);
      s += `<line x1="${x0}" y1="${gy}" x2="${x1}" y2="${gy}" stroke="var(--gray)" stroke-width="1" stroke-dasharray="5 4" opacity="0.65"${bp('guides.y')}/>`;
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
          : `<text x="${x}" y="${y}" class="chart-label" style="text-anchor:${anchor};opacity:.55"${bp(`guides.quadrants.${i}`)}>${escapeHtml(text)}</text>`;
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

  let dotSvg = `<g${bl('points')}>`;
  points.forEach((p, i) => {
    const d = dots[i];
    if (d === undefined) return;
    const color = colorAt(p.accent, 0);
    const tip = `${p.label !== undefined ? `${p.label} — ` : ''}${fmt(p.x, undefined)}, ${fmt(p.y, data.unit)}${p.size !== undefined ? ` (${fmt(p.size, undefined)})` : ''}`;
    dotSvg += `<circle cx="${d.px}" cy="${d.py}" r="${d.r}" fill="${color}" fill-opacity="0.55" stroke="${color}" stroke-width="1.5"${bp(`points.${i}`)}><title>${escapeHtml(tip)}</title></circle>`;
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
    const w = text.length * 5.6;
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
      const sx = Math.max(box.x0, Math.min(px, box.x1));
      const sy = Math.max(box.y0, Math.min(py, box.y1));
      const len = Math.sqrt((px - sx) * (px - sx) + (py - sy) * (py - sy));
      if (len > r + 2) {
        const ex = px - ((px - sx) / len) * (r + 1.5);
        const ey = py - ((py - sy) / len) * (r + 1.5);
        leaders += `<line x1="${Math.round(sx * 10) / 10}" y1="${Math.round(sy * 10) / 10}" x2="${Math.round(ex * 10) / 10}" y2="${Math.round(ey * 10) / 10}" class="chart-leader"/>`;
      }
    }
    const full = p.label.length > SC_LABEL_CHARS ? `<title>${escapeHtml(p.label)}</title>` : '';
    labels += `<text x="${Math.round(pick.lx * 10) / 10}" y="${Math.round(pick.ly * 10) / 10}" class="chart-label" style="text-anchor:${pick.anchor}"${bp(`points.${i}.label`)}>${escapeHtml(text)}${full}</text>`;
  });

  // Leaders under the bubbles, labels on top.
  s += leaders + dotSvg + labels + `</svg>`;
  return s;
}

function renderGauge(data: ChartData, items: readonly DonutItem[]): string {
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
  s += `<g${bl('items')}>`;
  items.forEach((it, i) => {
    const r = outer - i * (band + gap);
    if (r <= band) return; // out of rings — the legend still names the item
    const color = colorAt(it.accent, i);
    const fraction = pos(it.value) / max;
    s += `<g${bp(`items.${i}`)}>`;
    s += `<path d="${arc(r, 1)}" fill="none" stroke="var(--light-gray)" stroke-width="${band}" stroke-linecap="round"/>`;
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
    s += `<text x="${cx}" y="${cy + (solo ? 26 : 20)}" class="chart-total-label">${escapeHtml(caption.toUpperCase())}</text>`;
  }
  // Scale ends, just outside the two open ends of the dial (135° and 45°) —
  // clear of the stroke, so a full arc never runs over its own labels.
  const scaleR = outer + band / 2 + 13;
  const scaleX = Math.round(scaleR * Math.cos((135 * Math.PI) / 180));
  const scaleY = Math.round(cy + scaleR * Math.sin((135 * Math.PI) / 180));
  s += `<text x="${cx + scaleX}" y="${scaleY}" class="chart-label">0</text>`;
  s += `<text x="${cx - scaleX}" y="${scaleY}" class="chart-label">${escapeHtml(fmt(max, data.unit))}</text>`;
  s += `</svg>`;

  const legend =
    items.length > 1 || (items[0]?.desc !== undefined && !solo)
      ? legendRow(
          items.map((it, i) => ({
            label: `${it.label} — ${fmt(pos(it.value), data.unit)}`,
            color: colorAt(it.accent, i),
            path: `items.${i}`,
          })),
          'items',
        )
      : '';
  return s + legend;
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
  const vMax = data.max !== undefined && data.max > 0 ? data.max : dataMax > 0 ? dataMax : 1;
  const angleAt = (i: number): number => -Math.PI / 2 + (2 * Math.PI * i) / n;
  const ptAt = (i: number, radius: number): readonly [number, number] => {
    const a = angleAt(i);
    return [Math.round(cx + radius * Math.cos(a)), Math.round(cy + radius * Math.sin(a))];
  };
  let s = svgOpenSize(width, height);
  // Concentric rings (hairline polygons) + axis spokes.
  for (let ring = 1; ring <= TICKS; ring++) {
    const pts = Array.from({ length: n }, (_, i) => ptAt(i, (r * ring) / TICKS).join(','));
    s += `<polygon points="${pts.join(' ')}" fill="none" class="chart-axis"/>`;
  }
  for (let i = 0; i < n; i++) {
    const [x, y] = ptAt(i, r);
    s += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" class="chart-axis"/>`;
  }
  // Axis labels at the spoke ends, anchored away from the web.
  s += `<g${bl('labels')}>`;
  labels.forEach((label, i) => {
    const a = angleAt(i);
    const [x, y] = ptAt(i, r + 14);
    const cos = Math.cos(a);
    const anchor = cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle';
    // Inline style: the .chart-label class sets text-anchor:middle, which
    // would override a presentation attribute.
    s += `<text x="${x}" y="${y + 3}" class="chart-label" style="text-anchor:${anchor}"${bp(`labels.${i}`)}>${escapeHtml(label)}</text>`;
  });
  s += `</g>`;
  // One stroked polygon (+ vertex dots) per series.
  s += `<g${bl('series')}>`;
  series.forEach((sr, si) => {
    const color = colorAt(sr.accent, si);
    const pts = Array.from({ length: n }, (_, i) => {
      const v = Math.min(pos(sr.values[i] ?? 0), vMax);
      return ptAt(i, (r * v) / vMax);
    });
    s += `<g${bp(`series.${si}`)}>`;
    s += `<polygon points="${pts.map((p) => p.join(',')).join(' ')}" fill="${color}" fill-opacity="0.12" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>`;
    pts.forEach(([x, y]) => {
      s += `<circle cx="${x}" cy="${y}" r="2.5" fill="${color}"/>`;
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
// 0 in navy. An optional `budget` draws a dashed cap line — any bar segment
// past it tints negative, and the total row gets an over / under / on-budget
// chip. Renders inside the diagram frame (tag BUDGET).

/** Bright diagram palette for waterfall bars (same cycle order as bar/donut). */
const WFL_CYCLE = ['#0e54a1', '#0f766e', '#f7952c', '#6b21a8', '#1f9747', '#1a6dbe'];

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
  s += `<g${bl('items')}>`;
  items.forEach((it, i) => {
    const v = pos(it.value);
    const y = topPad + i * (WFL_BAR_H + WFL_GAP);
    const bx = x0 + px(running);
    const bw = Math.max(px(v), v > 0 ? 2 : 0);
    const color = WFL_CYCLE[i % WFL_CYCLE.length] ?? '#0e54a1';
    s += `<g${bp(`items.${i}`)}>`;
    s += `<text x="0" y="${y + 22}" class="wfl-label"${bp(`items.${i}.label`)}>${escapeHtml(wflLabelFor(it))}</text>`;
    s += `<rect x="${bx}" y="${y}" width="${bw}" height="${WFL_BAR_H}" rx="3" fill="${color}" fill-opacity="0.9"/>`;
    // Segment past the budget line tints negative.
    if (hasBudget && running + v > budget) {
      const overStart = Math.max(running, budget);
      const ox = x0 + px(overStart);
      const ow = Math.max(px(running + v) - px(overStart), 2);
      s += `<rect x="${ox}" y="${y}" width="${ow}" height="${WFL_BAR_H}" rx="3" fill="var(--negative)" fill-opacity="0.9"/>`;
    }
    s += `<text x="${bx + bw + 6}" y="${y + 22}" class="wfl-value"${bp(`items.${i}.value`)}>${escapeHtml(wflFmt(v, unit))}</text>`;
    s += `</g>`;
    running += v;
  });
  s += `</g>`;

  // Full-width TOTAL bar from 0.
  if (items.length > 0) {
    const y = topPad + items.length * (WFL_BAR_H + WFL_GAP);
    const tw = Math.max(px(total), total > 0 ? 2 : 0);
    s += `<rect x="${x0}" y="${y}" width="${tw}" height="${WFL_BAR_H}" rx="3" fill="var(--navy)"/>`;
    s += `<text x="${x0 + 10}" y="${y + 22}" class="wfl-total-label">TOTAL</text>`;
    s += `<text x="${x0 + tw + 6}" y="${y + 22}" class="wfl-value">${escapeHtml(wflFmt(total, unit))}</text>`;
    // Over / under / on-budget chip after the total value.
    if (hasBudget) {
      const diff = Math.round((total - budget) * 100) / 100;
      const over = diff > 0;
      const label = diff === 0 ? 'on budget' : over ? `${wflFmt(diff, unit)} over` : `${wflFmt(-diff, unit)} under`;
      const cw = 20 + label.length * 6;
      const cx = x0 + tw + 6 + Math.round(wflFmt(total, unit).length * 6.6) + 8;
      const tone = over ? 'wfl-chip-over' : 'wfl-chip-under';
      s += `<rect x="${cx}" y="${y + 4}" width="${cw}" height="${WFL_BAR_H - 8}" rx="9" class="wfl-chip-bg ${tone}"/>`;
      s += `<text x="${cx + Math.round(cw / 2)}" y="${y + 22}" class="wfl-chip ${tone}">${escapeHtml(label)}</text>`;
    }
  }

  // Dashed budget cap line + label (drawn last so it sits above the bars).
  if (hasBudget && budgetOnScale) {
    const lx = x0 + px(budget);
    s += `<line x1="${lx}" y1="${topPad - 6}" x2="${lx}" y2="${Math.max(height, 40) - 4}" class="wfl-budget-line"/>`;
    // Flip the label to the left of the line when it would overflow the frame.
    const flip = lx > WFL_WIDTH - 130;
    s += `<text x="${flip ? lx - 6 : lx + 6}" y="${topPad - 8}" class="wfl-budget-label"${flip ? ' text-anchor="end"' : ''}${bp('budget')}>budget: ${escapeHtml(wflFmt(budget, unit))}</text>`;
  } else if (hasBudget) {
    // Off-scale budget: annotate instead of drawing an unreachable line.
    s += `<text x="${WFL_WIDTH - 4}" y="${topPad - 8}" class="wfl-budget-label" text-anchor="end"${bp('budget')}>budget: ${escapeHtml(wflFmt(budget, unit))} — beyond scale →</text>`;
  }

  s += `</svg>`;
  return diagramFrame(
    {
      tag: 'BUDGET',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
    },
    s,
  );
}

// ─── kind: funnel (conversion funnel — the former `funnel` type) ─────────────
// Stages stack vertically as centered trapezoid bands whose width is
// proportional to `value / maxValue` (with a 28% floor so labels always fit).
// Band colours cycle the bright diagram palette. Between bands, a small mono
// chip shows the stage-to-stage conversion (`↓ NN%`) — honestly above 100%
// when a stage grows, and 0% when the previous stage is 0. Stages come from
// `items`, or the funnel-era legacy `stages` (whose data paths they keep).
// Renders inside the diagram frame (tag FUNNEL).

/** Bright diagram palette (matches chart's cycle order for the funnel). */
const FN_CYCLE = ['#0e54a1', '#1a6dbe', '#0f766e', '#1f9747', '#6b21a8'];

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
  maxValue: number,
  y: number,
  unit: string | undefined,
  key: string,
): string {
  const cx = FN_WIDTH / 2;
  const topW = fnWidthFor(stage.value, maxValue);
  const botW = nextStage !== undefined ? fnWidthFor(nextStage.value, maxValue) : topW;
  const color = FN_CYCLE[i % FN_CYCLE.length] ?? '#0e54a1';
  const pts = [
    `${cx - topW / 2},${y}`,
    `${cx + topW / 2},${y}`,
    `${cx + botW / 2},${y + FN_BAND_H}`,
    `${cx - botW / 2},${y + FN_BAND_H}`,
  ].join(' ');
  const hasDesc = stage.desc !== undefined && stage.desc.length > 0;
  const labelY = hasDesc ? y + 20 : y + 24;
  const valueY = hasDesc ? y + 35 : y + 40;
  const descText = hasDesc
    ? `<text x="${cx}" y="${y + 47}" class="fn-desc"${bp(`${key}.${i}.desc`)}>${escapeHtml(stage.desc ?? '')}</text>`
    : '';
  return (
    `<g${bp(`${key}.${i}`)}>` +
    `<polygon points="${pts}" fill="${color}" fill-opacity="0.92"/>` +
    `<text x="${cx}" y="${labelY}" class="fn-label"${bp(`${key}.${i}.label`)}>${escapeHtml(stage.label)}</text>` +
    `<text x="${cx}" y="${valueY}" class="fn-value"${bp(`${key}.${i}.value`)}>${escapeHtml(fnFmt(pos(stage.value), unit))}</text>` +
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
    `<rect x="${cx - w / 2}" y="${y}" width="${w}" height="${FN_CHIP_H}" rx="9" class="fn-chip-bg"/>` +
    `<text x="${cx}" y="${y + 13}" class="fn-chip">${escapeHtml(label)}</text>`
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
  s += `<g${bl(key)}>`;
  stages.forEach((stage, i) => {
    const y = i * stepH;
    s += renderFunnelBand(stage, stages[i + 1], i, maxValue, y, data.unit, key);
    const next = stages[i + 1];
    if (next !== undefined) s += renderFunnelChip(stage, next, y + FN_BAND_H + FN_GAP);
  });
  s += `</g>`;
  s += `</svg>`;
  return diagramFrame(
    {
      tag: 'FUNNEL',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
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
  let inner: string;
  if (kind === 'donut') {
    inner = renderDonut(data, data.items ?? []);
  } else if (kind === 'gauge') {
    inner = renderGauge(data, data.items ?? []);
  } else if (kind === 'scatter' && data.points !== undefined && data.points.length > 0) {
    // Numeric-axis scatter: each point owns its x/y. The `labels`+`series`
    // scatter below stays as the ordinal fallback for existing docs.
    inner = renderScatterPoints(data, data.points);
  } else if (kind === 'radar') {
    // Radar uses `labels` as the axes (3+ required to draw a web).
    const body = renderRadar(data, labels, series);
    const legend =
      series.length > 1
        ? legendRow(
            series.map((s, i) => ({ label: s.label, color: colorAt(s.accent, i), path: `series.${i}` })),
            'series',
          )
        : '';
    inner = body + legend;
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
    const legend =
      series.length > 1
        ? legendRow(
            series.map((s, i) => ({ label: s.label, color: colorAt(s.accent, i), path: `series.${i}` })),
            'series',
          )
        : '';
    inner = body + legend;
  }
  return diagramFrame(
    {
      tag: 'CHART',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
    },
    inner,
  );
}
