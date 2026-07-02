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
function axes(f: Frame, labels: readonly string[], unit: string | undefined): string {
  let s = '';
  for (let t = 0; t <= TICKS; t++) {
    const y = Math.round(f.y1 - ((f.y1 - f.y0) * t) / TICKS);
    s += `<line x1="${f.x0}" y1="${y}" x2="${f.x1}" y2="${y}" class="chart-axis"${t === 0 ? '' : ' opacity="0.6"'}/>`;
    s += `<text x="${f.x0 - 8}" y="${y + 3}" class="chart-tick">${escapeHtml(fmt((f.yMax * t) / TICKS, unit))}</text>`;
  }
  const n = Math.max(labels.length, 1);
  const slot = (f.x1 - f.x0) / n;
  labels.forEach((label, i) => {
    const x = Math.round(f.x0 + slot * i + slot / 2);
    s += `<text x="${x}" y="${f.y1 + 18}" class="chart-label">${escapeHtml(label)}</text>`;
  });
  return s;
}

/** Legend row beneath the SVG (same `.legend` chrome as c4). */
function legendRow(entries: ReadonlyArray<{ label: string; color: string }>): string {
  if (entries.length === 0) return '';
  const items = entries
    .map(
      (e) =>
        `<span class="item"><span class="sw" style="background:${e.color};border:1px solid #d1d5db"></span>${escapeHtml(e.label)}</span>`,
    )
    .join('');
  return `<div class="legend">${items}</div>`;
}

function renderBars(data: ChartData, labels: readonly string[], series: readonly Series[]): string {
  const f = frameFor(data, labels.length);
  const n = Math.max(labels.length, 1);
  const slot = (f.x1 - f.x0) / n;
  const groupPad = Math.min(18, slot * 0.18);
  const barGap = 4;
  const k = Math.max(series.length, 1);
  const barW = Math.max(6, Math.round((slot - groupPad * 2 - barGap * (k - 1)) / k));
  let s = '';
  series.forEach((sr, si) => {
    const color = colorAt(sr.accent, si);
    for (let ci = 0; ci < labels.length; ci++) {
      const v = pos(sr.values[ci] ?? 0);
      const capped = Math.min(v, f.yMax);
      const h = Math.round(((f.y1 - f.y0) * capped) / f.yMax);
      const x = Math.round(f.x0 + slot * ci + groupPad + si * (barW + barGap));
      const y = f.y1 - h;
      s += `<rect x="${x}" y="${y}" width="${barW}" height="${Math.max(h, 1)}" rx="3" fill="${color}"${h === 0 ? ' opacity="0.35"' : ''}/>`;
      s += `<text x="${x + Math.round(barW / 2)}" y="${y - 4}" class="chart-val">${escapeHtml(fmt(v, data.unit))}</text>`;
    }
  });
  return svgOpen(f) + axes(f, labels, data.unit) + s + `</svg>`;
}

function renderLineArea(
  data: ChartData,
  labels: readonly string[],
  series: readonly Series[],
  area: boolean,
): string {
  const f = frameFor(data, labels.length);
  const n = Math.max(labels.length, 1);
  const slot = (f.x1 - f.x0) / n;
  const xAt = (i: number): number => Math.round(f.x0 + slot * i + slot / 2);
  const yAt = (v: number): number =>
    Math.round(f.y1 - ((f.y1 - f.y0) * Math.min(pos(v), f.yMax)) / f.yMax);
  let s = '';
  series.forEach((sr, si) => {
    const color = colorAt(sr.accent, si);
    const pts = sr.values.slice(0, labels.length).map((v, i) => `${xAt(i)},${yAt(v)}`);
    if (pts.length === 0) return;
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
  });
  return svgOpen(f) + axes(f, labels, data.unit) + s + `</svg>`;
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
    items.forEach((it, i) => {
      const v = pos(it.value);
      if (v === 0) return;
      const sweep = (v / total) * 360;
      const color = colorAt(it.accent, i);
      if (sweep >= 359.999) {
        // A full circle can't be a single arc — draw a ring.
        s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}"/>`;
      } else {
        const a0 = (angle * Math.PI) / 180;
        const a1 = ((angle + sweep) * Math.PI) / 180;
        const x0 = Math.round(cx + r * Math.cos(a0));
        const y0 = Math.round(cy + r * Math.sin(a0));
        const x1 = Math.round(cx + r * Math.cos(a1));
        const y1 = Math.round(cy + r * Math.sin(a1));
        const large = sweep > 180 ? 1 : 0;
        s += `<path d="M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="butt"/>`;
      }
      angle += sweep;
    });
  }
  s += `<text x="${cx}" y="${cy + 2}" class="chart-total">${escapeHtml(fmt(total, data.unit))}</text>`;
  s += `<text x="${cx}" y="${cy + 20}" class="chart-total-label">TOTAL</text>`;
  s += `</svg>`;
  const legend = legendRow(
    items.map((it, i) => ({
      label: `${it.label} — ${fmt(pos(it.value), data.unit)}`,
      color: colorAt(it.accent, i),
    })),
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
  labels.forEach((label, i) => {
    const a = angleAt(i);
    const [x, y] = ptAt(i, r + 14);
    const cos = Math.cos(a);
    const anchor = cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle';
    // Inline style: the .chart-label class sets text-anchor:middle, which
    // would override a presentation attribute.
    s += `<text x="${x}" y="${y + 3}" class="chart-label" style="text-anchor:${anchor}">${escapeHtml(label)}</text>`;
  });
  // One stroked polygon (+ vertex dots) per series.
  series.forEach((sr, si) => {
    const color = colorAt(sr.accent, si);
    const pts = Array.from({ length: n }, (_, i) => {
      const v = Math.min(pos(sr.values[i] ?? 0), vMax);
      return ptAt(i, (r * v) / vMax);
    });
    s += `<polygon points="${pts.map((p) => p.join(',')).join(' ')}" fill="${color}" fill-opacity="0.12" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>`;
    pts.forEach(([x, y]) => {
      s += `<circle cx="${x}" cy="${y}" r="2.5" fill="${color}"/>`;
    });
  });
  return s + `</svg>`;
}

function svgOpen(f: Frame): string {
  return svgOpenSize(f.width, f.height);
}
function svgOpenSize(w: number, h: number): string {
  return `<svg viewBox="0 0 ${w} ${h}" role="img"><title>Chart</title>`;
}

export function renderChart(data: ChartData): string {
  const kind = data.kind ?? 'bar';
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
        ? legendRow(series.map((s, i) => ({ label: s.label, color: colorAt(s.accent, i) })))
        : '';
    inner = body + legend;
  } else {
    // Derive labels when omitted so a bare series still charts (1, 2, 3, …).
    const n = Math.max(labels.length, ...series.map((s) => s.values.length), 0);
    const cats = labels.length > 0 ? labels : Array.from({ length: n }, (_, i) => String(i + 1));
    const body =
      kind === 'bar'
        ? renderBars(data, cats, series)
        : renderLineArea(data, cats, series, kind === 'area');
    const legend =
      series.length > 1
        ? legendRow(series.map((s, i) => ({ label: s.label, color: colorAt(s.accent, i) })))
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
