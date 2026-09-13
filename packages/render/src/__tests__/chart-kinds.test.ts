/**
 * The statistical `chart` kinds — pie, histogram, bell, boxplot, pareto,
 * bullet. Structure (counts of marks), derived values (bins, z-scores, the
 * cumulative line, the vital few), and the skin rules (tokens only, titles
 * on every mark).
 */

import { describe, expect, it } from 'vitest';
import { parse } from 'node-html-parser';
import { renderChart } from '../blocks/chart.js';
import { binValues, zScore } from '../blocks/chartKinds.js';

const NO_HEX = /#[0-9a-f]{3,6}\b/i;

/** The (x, y) pairs of a `M x,y L x,y …` path. */
function pathPoints(d: string): Array<{ x: number; y: number }> {
  return d
    .replace(/[MLZ]/g, ' ')
    .trim()
    .split(/\s+/)
    .map((pair) => {
      const [x, y] = pair.split(',').map(Number);
      return { x: x ?? NaN, y: y ?? NaN };
    });
}

describe('chart: pie', () => {
  const html = renderChart({
    kind: 'pie',
    unit: '%',
    items: [
      { label: 'Web', value: 62 },
      { label: 'iOS', value: 23 },
      { label: 'Android', value: 15 },
    ],
  });

  it('draws one filled wedge per item, from the centre, and no hole', () => {
    const root = parse(html);
    const wedges = root.querySelectorAll('g[data-bl="items"] path');
    expect(wedges).toHaveLength(3);
    for (const w of wedges) {
      expect(w.getAttribute('d')).toMatch(/^M 240 118 L /); // starts at the centre
      expect(w.getAttribute('fill')).not.toBe('none');
    }
    // A donut has two ring edges (outer + inner); a pie only the rim.
    expect(root.querySelectorAll('circle[stroke="var(--rule-solid)"]')).toHaveLength(1);
    expect(html).not.toContain('chart-total');
    expect(html).not.toContain('TOTAL');
  });

  it('keeps the donut legend and titles the wedges with value and share', () => {
    expect(html).toContain('Web — 62%');
    expect(html).toContain('<title>Web — 62% (62%)</title>');
    expect(html).not.toMatch(NO_HEX);
  });

  it('the donut still has its hole and centre total', () => {
    const donut = renderChart({ kind: 'donut', items: [{ label: 'A', value: 1 }, { label: 'B', value: 1 }] });
    expect(donut).toContain('chart-total');
    expect(parse(donut).querySelectorAll('circle[stroke="var(--rule-solid)"]')).toHaveLength(2);
  });
});

describe('chart: histogram', () => {
  const values = Array.from({ length: 100 }, (_, i) => i * 0.8); // 0 … 79.2

  it('bins 100 values into the Sturges count (8) on nice edges', () => {
    const b = binValues(values, undefined);
    expect(b.bins).toHaveLength(8);
    expect(b.width).toBe(10);
    expect(b.bins.map((x) => x.lo)).toEqual([0, 10, 20, 30, 40, 50, 60, 70]);
    expect(b.bins.reduce((a, x) => a + x.count, 0)).toBe(100);
    expect(b.bins[7]?.count).toBe(12); // 70 … 79.2 inclusive of the max
  });

  it('honours an explicit bin count and keeps the edges nice', () => {
    const b = binValues(values, 4);
    expect(b.width).toBe(20);
    expect(b.bins).toHaveLength(4);
  });

  it('draws one bar per bin, touching, with the mean as a dashed accent rule', () => {
    const html = renderChart({ kind: 'histogram', unit: 'ms', values });
    const root = parse(html);
    const bars = root.querySelectorAll('g[data-bp="values"] rect');
    expect(bars).toHaveLength(8);
    const xs = bars.map((r) => Number(r.getAttribute('x')));
    const ws = bars.map((r) => Number(r.getAttribute('width')));
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeCloseTo((xs[i - 1] ?? 0) + (ws[i - 1] ?? 0), 0);
    expect(html).toContain('mean 39.6ms');
    expect(html).toContain('stroke-dasharray="5 4"');
    expect(html).toContain('<title>0ms – 10ms: 13</title>');
    expect(html).not.toContain('NaN');
    expect(html).not.toMatch(NO_HEX);
  });

  it('accepts pre-binned labels + one series', () => {
    const html = renderChart({
      kind: 'histogram',
      labels: ['0–10', '10–20', '20–30'],
      series: [{ label: 'count', values: [3, 9, 4] }],
    });
    const root = parse(html);
    expect(root.querySelectorAll('g[data-bl="series"] rect')).toHaveLength(3);
    expect(root.querySelectorAll('g[data-bl="labels"] text').map((t) => t.text)).toEqual(['0–10', '10–20', '20–30']);
    expect(html).not.toContain('mean');
  });
});

describe('chart: bell', () => {
  const html = renderChart({
    kind: 'bell',
    mean: 50,
    sd: 10,
    markers: [{ at: 66, label: 'SLO' }],
  });

  it('places the marker at z = 1.6 and prints μ and σ', () => {
    expect(zScore(66, 50, 10)).toBe(1.6);
    expect(html).toContain('z = 1.6');
    expect(html).toContain('μ = 50');
    expect(html).toContain('σ = 10');
    expect(html).toContain('<title>SLO at 66 · z = 1.6</title>');
  });

  it('peaks at the mean, with the ±1σ and ±2σ bands under the curve', () => {
    const root = parse(html);
    const curve = root.querySelector('path.chart-bell');
    expect(curve).not.toBeNull();
    const pts = pathPoints(curve?.getAttribute('d') ?? '');
    const peak = pts.reduce((a, p) => (p.y < a.y ? p : a));
    const meanLine = root.querySelector('line.chart-bell-mean');
    expect(peak.x).toBeCloseTo(Number(meanLine?.getAttribute('x1')), 0);
    // The marker rule sits at 1.6 σ to the right of the mean (3.5 σ = half the plot).
    const marker = root.querySelector('g[data-bp="markers.0"] line');
    const half = (560 - 48) / 2;
    expect(Number(marker?.getAttribute('x1')) - peak.x).toBeCloseTo((half * 1.6) / 3.5, 0);
    expect(root.querySelectorAll('path[fill="var(--accent)"]')).toHaveLength(2);
    expect(html).not.toContain('NaN');
    expect(html).not.toMatch(NO_HEX);
  });

  it('fits μ / σ from values and draws the sample histogram behind the curve', () => {
    const values = [40, 45, 48, 50, 50, 52, 55, 60, 42, 58, 47, 53, 49, 51, 44, 56, 46, 54, 50, 50];
    const fitted = renderChart({ kind: 'bell', values });
    expect(fitted).toContain('μ = 50');
    expect(fitted).toContain('n = 20');
    const root = parse(fitted);
    expect(root.querySelectorAll('g[data-bp="values"] rect').length).toBeGreaterThan(1);
    // Fewer than 20 values and no `bins`: no bars.
    const small = parse(renderChart({ kind: 'bell', values: values.slice(0, 10) }));
    expect(small.querySelectorAll('g[data-bp="values"] rect')).toHaveLength(0);
  });
});

describe('chart: boxplot', () => {
  const html = renderChart({
    kind: 'boxplot',
    unit: 'ms',
    boxes: [
      { label: 'Web', min: 4, q1: 5, median: 6, q3: 7, max: 8, outliers: [11] },
      { label: 'API', min: 2, q1: 3, median: 4, q3: 5, max: 6 },
      { label: 'Mobile', min: 9, q1: 12, median: 14, q3: 17, max: 21, outliers: [26, 28], accent: 'amber' },
    ],
  });

  it('draws one median line per box and a hollow circle per outlier', () => {
    const root = parse(html);
    expect(root.querySelectorAll('line.chart-median')).toHaveLength(3);
    expect(root.querySelectorAll('circle.chart-outlier')).toHaveLength(3);
    expect(root.querySelectorAll('g[data-bl="boxes"] > g rect')).toHaveLength(3);
    // The box spans q1 → q3 and the median falls inside it.
    const box = root.querySelector('g[data-bp="boxes.0"] rect');
    const median = root.querySelector('g[data-bp="boxes.0"] line.chart-median');
    const top = Number(box?.getAttribute('y'));
    const bottom = top + Number(box?.getAttribute('height'));
    const my = Number(median?.getAttribute('y1'));
    expect(my).toBeGreaterThan(top);
    expect(my).toBeLessThan(bottom);
  });

  it('titles each box with its five numbers and accents the marked box', () => {
    expect(html).toContain('Web — min 4ms · q1 5ms · median 6ms · q3 7ms · max 8ms');
    expect(html).toContain('fill="var(--accent-tint)"');
    expect(html).toContain('Mobile outlier 28ms');
    expect(html).not.toContain('NaN');
    expect(html).not.toMatch(NO_HEX);
  });
});

describe('chart: pareto', () => {
  const html = renderChart({
    kind: 'pareto',
    items: [
      { label: 'Search', value: 23 },
      { label: 'Login', value: 142 },
      { label: 'Billing', value: 96 },
      { label: 'Export', value: 41 },
      { label: 'Other', value: 9 },
    ],
  });

  it('orders the bars by value, descending, keeping the original data paths', () => {
    const root = parse(html);
    const groups = root.querySelectorAll('g[data-bl="items"] > g');
    expect(groups.map((g) => g.getAttribute('data-bp'))).toEqual(['items.1', 'items.2', 'items.3', 'items.0', 'items.4']);
    const heights = groups.map((g) => Number(g.querySelector('rect')?.getAttribute('height')));
    for (let i = 1; i < heights.length; i++) expect(heights[i]).toBeLessThanOrEqual(heights[i - 1] ?? 0);
  });

  it('ends the cumulative line at 100% and accents the bars up to the 80% crossing', () => {
    const root = parse(html);
    const dots = root.querySelectorAll('circle.chart-cum');
    expect(dots).toHaveLength(5);
    expect(dots[4]?.querySelector('title')?.text).toBe('cumulative 100% after Other');
    // 142 + 96 = 238 of 311 = 76.5%; + 41 = 89.7% → three vital bars.
    expect(root.querySelectorAll('g.chart-vital')).toHaveLength(3);
    expect(root.querySelectorAll('g.chart-rest')).toHaveLength(2);
    const line = root.querySelector('polyline.chart-cum-line');
    const pts = (line?.getAttribute('points') ?? '').split(' ').map((p) => Number(p.split(',')[1]));
    for (let i = 1; i < pts.length; i++) expect(pts[i]).toBeLessThanOrEqual(pts[i - 1] ?? 0); // rises
    expect(html).toContain('80% of the total');
    expect(html).toContain('line = cumulative %');
    expect(html).not.toMatch(NO_HEX);
  });
});

describe('chart: bullet', () => {
  const html = renderChart({
    kind: 'bullet',
    unit: '%',
    bullets: [
      { label: 'Uptime', value: 99.7, target: 99.9, ranges: [99, 99.5, 100] },
      { label: 'Coverage', value: 72, target: 80, ranges: [50, 70, 100] },
      { label: 'No target', value: 40 },
    ],
  });

  it('draws bands, a measure and a target per row on one shared scale', () => {
    const root = parse(html);
    const rows = root.querySelectorAll('g[data-bl="bullets"] > g');
    expect(rows).toHaveLength(3);
    expect(rows[0]?.querySelectorAll('rect.chart-band')).toHaveLength(3);
    expect(rows[0]?.querySelectorAll('rect.chart-measure')).toHaveLength(1);
    expect(rows[0]?.querySelectorAll('rect.chart-target')).toHaveLength(1);
    expect(rows[2]?.querySelectorAll('rect.chart-band')).toHaveLength(0);
    expect(rows[2]?.querySelectorAll('rect.chart-target')).toHaveLength(0);
    // Rows are 28px apart and the measure is thinner than the bands.
    const ys = rows.map((g) => Number(g.querySelector('rect.chart-measure')?.getAttribute('y')));
    expect((ys[1] ?? 0) - (ys[0] ?? 0)).toBe(28);
    // Shared scale: 100% is the ceiling, so 40 is 40% of the 99.7 bar's width ÷ 0.997.
    const w = (g: (typeof rows)[number] | undefined): number => Number(g?.querySelector('rect.chart-measure')?.getAttribute('width'));
    expect(w(rows[2]) / w(rows[0])).toBeCloseTo(40 / 99.7, 1);
  });

  it('prints the value at the bar end and titles every mark', () => {
    expect(html).toContain('>99.7%<');
    expect(html).toContain('<title>Uptime target 99.9%</title>');
    expect(html).toContain('<title>Coverage range 1: up to 50%</title>');
    expect(html).not.toContain('NaN');
    expect(html).not.toMatch(NO_HEX);
  });
});
