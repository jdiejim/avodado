/**
 * Renders a `percentiles` block — a dot-and-whisker plot of latency
 * distributions: one row per series, one shared axis. The whisker runs from
 * p50 to the last value the row has (p99 / p999 / max); p50 is the filled
 * ink dot, p90 and p95 small hollow dots, p99 the filled accent dot (the
 * tail is the story of every row), max a hollow `soft` dot with a × mark.
 *
 * The SLO is a dashed vertical rule (`slo` on the block; a row's own `slo`
 * draws a short rule across that row instead). A row whose p99 crosses its
 * SLO takes `negative` on the p99 dot and its value. `scale: log` spreads a
 * long tail; the domain runs from the smallest p50 to the largest tail value
 * (and the SLO), with nice ticks carrying the unit.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { DECORATIVE } from '../svg/decorative.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { marksOf } from '../svg/dsTone.js';
import { countPhrase, svgName } from '../svg/svgTitle.js';
import { diagramFrame } from './frame.js';

type PctData = BlockDataMap['percentiles'];
type Row = PctData['rows'][number];

const PLOT_W = 440;
const ROW_H = 34;
const PAD_R = 24;
/** Approximate width of one `.t-sub` (10px mono) character. */
const SUB_CH = 6.2;
/** Approximate width of one 11px mono row-label character. */
const LABEL_CH = 6.8;
/** Gap between a dot and the value printed beside it. */
const VAL_GAP = 7;

/** A nice tick step (1 / 2 / 2.5 / 5 × 10^n) whose tick count over `span` lands near 5. */
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

const round6 = (v: number): number => Math.round(v * 1e6) / 1e6;

/** Compact number: integers as-is, else up to two decimals. */
function fmt(v: number): string {
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
}

interface Scale {
  readonly lo: number;
  readonly hi: number;
  readonly ticks: readonly number[];
  readonly x: (v: number) => number;
  readonly log: boolean;
}

/** The shared axis: linear (nice-stepped from the smallest p50) or log10 (decade ticks, 2× and 5× when few). */
function scaleFor(min: number, max: number, log: boolean, x0: number, w: number): Scale {
  if (log && min > 0 && max > 0) {
    const d0 = Math.floor(Math.log10(min));
    const d1 = Math.ceil(Math.log10(max) - 1e-9);
    const lo = Math.pow(10, d0);
    const hi = Math.pow(10, Math.max(d1, d0 + 1));
    const decades = Math.max(1, Math.log10(hi) - Math.log10(lo));
    const ticks: number[] = [];
    for (let d = d0; d <= Math.log10(hi) + 1e-9; d++) {
      const base = Math.pow(10, d);
      ticks.push(round6(base));
      if (decades <= 3 && base * 10 <= hi + 1e-9) {
        ticks.push(round6(base * 2), round6(base * 5));
      }
    }
    const l0 = Math.log10(lo);
    const span = Math.log10(hi) - l0;
    return { lo, hi, ticks, log: true, x: (v) => x0 + ((Math.log10(Math.max(v, lo)) - l0) / span) * w };
  }
  const span0 = Math.max(max - min, 1e-9);
  const step = niceStep(span0);
  const lo = round6(Math.floor(min / step) * step);
  const hi = round6(Math.max(Math.ceil(max / step) * step, lo + step));
  const ticks: number[] = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(round6(v));
  const span = hi - lo;
  return { lo, hi, ticks, log: false, x: (v) => x0 + ((v - lo) / span) * w };
}

/** The last value on a row's whisker: max, else p999, else p99. */
function tailOf(r: Row): number {
  return r.max ?? r.p999 ?? r.p99;
}

export function renderPercentiles(data: PctData): string {
  const rows = data.rows;
  const unit = data.unit ?? '';
  const marks = marksOf(rows.map((r) => r.accent));
  const sloOf = (r: Row): number | undefined => r.slo ?? data.slo;
  const labelW = Math.max(96, ...rows.map((r) => r.label.length * LABEL_CH + 12));
  const padL = 12;
  const x0 = padL + labelW;
  const minV = Math.min(...rows.map((r) => r.p50));
  const maxV = Math.max(...rows.map(tailOf), ...rows.map((r) => sloOf(r) ?? -Infinity));
  const sc = scaleFor(minV, maxV, data.scale === 'log', x0, PLOT_W);
  const x1 = x0 + PLOT_W;
  const sloLabelH = data.slo !== undefined ? 16 : 0;
  const top = 12 + sloLabelH;
  const axisY = top + rows.length * ROW_H + 8;
  const height = axisY + 26;
  // The widest p99 value printed right of its dot can run past the plot; the
  // viewBox grows to hold it rather than clipping.
  const tailText = Math.max(0, ...rows.map((r) => (fmt(r.p99).length + 1) * SUB_CH));
  const width = x1 + PAD_R + Math.max(0, tailText - PAD_R + 8);

  const a11y = svgName('Latency percentiles', data.title, [countPhrase(rows.length, 'row')]);
  let s = `<svg viewBox="0 0 ${width} ${height}"${a11y.attrs}>${a11y.title}`;

  // Gridlines and the axis.
  s += `<g${DECORATIVE}>`;
  for (const t of sc.ticks) {
    const x = sc.x(t);
    s += `<line x1="${x}" y1="${top}" x2="${x}" y2="${axisY}" stroke="var(--rule)" stroke-width="1"/>`;
  }
  s += `</g>`;
  s += `<line x1="${x0}" y1="${axisY}" x2="${x1}" y2="${axisY}" stroke="var(--rule-solid)" stroke-width="1"/>`;
  // Tick labels: skip any that would print over its neighbour.
  let lastTickEnd = -Infinity;
  for (const t of sc.ticks) {
    const label = `${fmt(t)}${unit}`;
    const w = label.length * SUB_CH;
    const x = sc.x(t);
    if (x - w / 2 < lastTickEnd + 6) continue;
    s += `<text x="${x}" y="${axisY + 14}" class="t-sub c-soft" text-anchor="middle">${escapeHtml(label)}</text>`;
    lastTickEnd = x + w / 2;
  }

  // The block SLO: one dashed rule through every row, named at the top.
  if (data.slo !== undefined) {
    const x = sc.x(data.slo);
    s +=
      `<g${bp('slo')}>` +
      `<line x1="${x}" y1="${top - 4}" x2="${x}" y2="${axisY}" stroke="var(--ink)" stroke-width="1" stroke-dasharray="4 3"/>` +
      `<text x="${x}" y="${top - 8}" class="t-eyebrow" text-anchor="middle">SLO ${escapeHtml(fmt(data.slo))}${escapeHtml(unit)}</text>` +
      `</g>`;
  }

  let anyOver = false;
  let anyP9x = false;
  let anyMax = false;
  s += `<g${bl('rows')}>`;
  rows.forEach((r, i) => {
    const y = top + i * ROW_H;
    const cy = y + ROW_H / 2;
    const slo = sloOf(r);
    const over = slo !== undefined && r.p99 > slo;
    if (over) anyOver = true;
    const negRow = marks[i] === 'negative';
    const xs = {
      p50: sc.x(r.p50),
      p90: r.p90 !== undefined ? sc.x(r.p90) : undefined,
      p95: r.p95 !== undefined ? sc.x(r.p95) : undefined,
      p99: sc.x(r.p99),
      p999: r.p999 !== undefined ? sc.x(r.p999) : undefined,
      max: r.max !== undefined ? sc.x(r.max) : undefined,
    };
    const tailX = sc.x(tailOf(r));
    let g = `<g${bp(`rows.${i}`)}${over ? ' data-over="1"' : ''}>`;
    if (i > 0) g += `<line x1="${padL}" y1="${y}" x2="${width - 8}" y2="${y}" stroke="var(--rule)" stroke-width="1"${DECORATIVE}/>`;
    g += `<text x="${padL}" y="${cy + 4}" class="pc-label${negRow ? ' c-negative' : ''}"${bp(`rows.${i}.label`)}>${escapeHtml(r.label)}</text>`;
    // A row's own SLO: a short dashed rule across this row only.
    if (r.slo !== undefined) {
      const x = sc.x(r.slo);
      g +=
        `<line x1="${x}" y1="${y + 3}" x2="${x}" y2="${y + ROW_H - 3}" stroke="var(--ink)" stroke-width="1" stroke-dasharray="4 3"${bp(`rows.${i}.slo`)}/>` +
        `<text x="${x + 4}" y="${y + 10}" class="t-eyebrow">SLO ${escapeHtml(fmt(r.slo))}${escapeHtml(unit)}</text>`;
    }
    // Whisker: p50 → tail.
    g += `<line x1="${xs.p50}" y1="${cy}" x2="${tailX}" y2="${cy}" stroke="var(--muted)" stroke-width="1.25"/>`;
    // Dots, tail first so the p50 / p99 dots sit on top of overlapping small ones.
    if (xs.max !== undefined) {
      anyMax = true;
      g +=
        `<g${bp(`rows.${i}.max`)}><circle cx="${xs.max}" cy="${cy}" r="3.5" fill="var(--paper)" stroke="var(--soft)" stroke-width="1.25"/>` +
        `<path d="M${xs.max - 2} ${cy - 2} l 4 4 M${xs.max + 2} ${cy - 2} l -4 4" stroke="var(--soft)" stroke-width="1" fill="none"/></g>`;
    }
    if (xs.p999 !== undefined) {
      g += `<circle cx="${xs.p999}" cy="${cy}" r="2.5" fill="var(--paper)" stroke="var(--muted)" stroke-width="1.25"${bp(`rows.${i}.p999`)}/>`;
    }
    for (const k of ['p90', 'p95'] as const) {
      const x = xs[k];
      if (x === undefined) continue;
      anyP9x = true;
      g += `<circle cx="${x}" cy="${cy}" r="2.5" fill="var(--paper)" stroke="var(--muted)" stroke-width="1.25"${bp(`rows.${i}.${k}`)}/>`;
    }
    const p99Fill = over ? 'var(--negative)' : 'var(--accent)';
    g += `<circle cx="${xs.p99}" cy="${cy}" r="4" fill="${p99Fill}"${bp(`rows.${i}.p99`)}/>`;
    g += `<circle cx="${xs.p50}" cy="${cy}" r="4" fill="var(--ink)"${bp(`rows.${i}.p50`)}/>`;
    // Values: p50 left of its dot, p99 right of its dot — only where they do
    // not run into another dot, the label gutter or the row's neighbours.
    const p50Text = fmt(r.p50);
    const p50W = p50Text.length * SUB_CH;
    if (xs.p50 - VAL_GAP - p50W >= x0 - 2) {
      g += `<text x="${xs.p50 - VAL_GAP}" y="${cy + 3.5}" class="t-sub c-muted" text-anchor="end">${escapeHtml(p50Text)}</text>`;
    }
    const p99Text = fmt(r.p99);
    const p99W = p99Text.length * SUB_CH;
    const p99L = xs.p99 + VAL_GAP;
    const p99R = p99L + p99W;
    const rightDots = [xs.p999, xs.max].filter((x): x is number => x !== undefined);
    const clear = rightDots.every((x) => x - 4 > p99R + 2 || x + 4 < p99L - 2);
    if (clear) {
      g += `<text x="${p99L}" y="${cy + 3.5}" class="t-sub${over ? ' c-negative' : ' c-muted'}">${escapeHtml(p99Text)}</text>`;
    }
    g += `</g>`;
    s += g;
  });
  s += `</g></svg>`;

  const items: LegendItem[] = [{ swatch: 'node-dot', fill: 'var(--ink)', stroke: 'var(--ink)', label: 'p50' }];
  if (anyP9x) items.push({ swatch: 'node-dot', fill: 'var(--paper)', stroke: 'var(--muted)', label: 'p90 · p95' });
  items.push({ swatch: 'node-dot', fill: 'var(--accent)', stroke: 'var(--accent)', label: 'p99' });
  if (anyOver) items.push({ swatch: 'node-dot', fill: 'var(--negative)', stroke: 'var(--negative)', label: 'p99 over the SLO' });
  if (anyMax) items.push({ swatch: 'node-dot', fill: 'var(--paper)', stroke: 'var(--soft)', label: 'max' });
  if (rows.some((r) => sloOf(r) !== undefined)) items.push({ swatch: 'line-dashed', stroke: 'var(--ink)', label: 'SLO' });
  const legend = renderLegend(items);

  return diagramFrame(
    {
      tag: 'PERCENTILES',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legend.length > 0 ? { legendHtml: legend } : {}),
    },
    s,
  );
}
