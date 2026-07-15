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

function frameFor(data: ChartData, cats: number): Frame {
  const width = Math.max(420, Math.min(680, 120 + cats * 84));
  const height = 240;
  const values = (data.series ?? []).flatMap((s) => s.values.map(pos));
  const dataMax = values.length > 0 ? Math.max(...values) : 0;
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
