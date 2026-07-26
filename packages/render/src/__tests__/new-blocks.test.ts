import { describe, expect, it } from 'vitest';
import { parse } from 'node-html-parser';
import { renderGitgraph } from '../blocks/gitgraph.js';
import { renderTreemap } from '../blocks/treemap.js';
import { renderPacket } from '../blocks/packet.js';
import { renderVenn } from '../blocks/venn.js';
import { renderWardley } from '../blocks/wardley.js';
import { renderChart } from '../blocks/chart.js';

describe('gitgraph', () => {
  const RELEASE = {
    branches: [{ name: 'main' as const }, { name: 'release' as const }],
    commits: [
      { label: 'baseline' },
      { branch: 'release', label: 'cut' },
      { merge: 'release', label: 'ship', tag: 'v1.2.0', kind: 'release' as const },
    ],
  };

  it('gives every branch a lane and every commit a dot', () => {
    const root = parse(renderGitgraph(RELEASE));
    expect(root.querySelectorAll('.gg-branch').map((t) => t.text)).toEqual(['main', 'release']);
    expect(root.querySelectorAll('g[data-bl="commits"] > g')).toHaveLength(3);
  });

  it('steps commits rightward and puts each on its own branch line', () => {
    const root = parse(renderGitgraph(RELEASE));
    const dots = root.querySelectorAll('g[data-bl="commits"] circle');
    const xs = dots.map((c) => Number(c.getAttribute('cx')));
    expect(xs[0]).toBeLessThan(xs[1] ?? 0);
    expect(xs[1]).toBeLessThan(xs[2] ?? 0);
    // The release commit sits one lane below main, and the merge returns.
    const ys = dots.map((c) => Number(c.getAttribute('cy')));
    expect(ys[1]).toBeGreaterThan(ys[0] ?? 0);
    expect(ys[2]).toBe(ys[0]);
  });

  it('draws a fork as a solid curve and a merge as a dashed one', () => {
    const html = renderGitgraph(RELEASE);
    const curves = parse(html).querySelectorAll('path[d^="M"]');
    expect(curves.length).toBeGreaterThanOrEqual(2);
    expect(curves.some((p) => p.getAttribute('stroke-dasharray') === undefined)).toBe(true);
    expect(curves.some((p) => p.getAttribute('stroke-dasharray') === '5 3')).toBe(true);
  });

  it('marks a release with its tag', () => {
    expect(renderGitgraph(RELEASE)).toContain('>v1.2.0<');
  });

  it('opens a lane for a branch that was never declared', () => {
    const html = renderGitgraph({
      commits: [{ label: 'a' }, { branch: 'spike', label: 'b' }],
    });
    expect(parse(html).querySelectorAll('.gg-branch').map((t) => t.text)).toEqual(['main', 'spike']);
  });
});

describe('treemap', () => {
  const SPEND = {
    unit: 'k',
    items: [
      { label: 'Compute', value: 60 },
      { label: 'Storage', value: 30 },
      { label: 'Network', value: 10 },
    ],
  };

  it('sizes every tile by value and fills the canvas', () => {
    const rects = parse(renderTreemap(SPEND)).querySelectorAll('rect');
    expect(rects).toHaveLength(3);
    const areas = rects.map((r) => Number(r.getAttribute('width')) * Number(r.getAttribute('height')));
    // 60 / 30 / 10 — twice the value is twice the area (within the gutters).
    expect((areas[0] ?? 0) / (areas[1] ?? 1)).toBeGreaterThan(1.7);
    expect((areas[1] ?? 0) / (areas[2] ?? 1)).toBeGreaterThan(2.2);
  });

  it('labels tiles with their value and share of the total', () => {
    const html = renderTreemap(SPEND);
    expect(html).toContain('60k · 60%');
    expect(html).toContain('>Compute<');
  });

  it('keeps the authored index for click-to-edit after sorting by size', () => {
    // Smallest first in the source — the biggest tile must still address item 2.
    const html = renderTreemap({
      items: [
        { label: 'Small', value: 5 },
        { label: 'Mid', value: 20 },
        { label: 'Big', value: 75 },
      ],
    });
    const first = parse(html).querySelector('g[data-bl="items"] > g');
    expect(first?.getAttribute('data-bp')).toBe('items.2');
  });
});

describe('packet', () => {
  it('makes cell width the bit count', () => {
    const root = parse(
      renderPacket({
        width: 32,
        fields: [
          { label: 'A', bits: 8 },
          { label: 'B', bits: 24 },
        ],
      }),
    );
    const w = root.querySelectorAll('g[data-bl="fields"] rect').map((r) => Number(r.getAttribute('width')));
    expect((w[1] ?? 0) / (w[0] ?? 1)).toBeCloseTo(3, 0);
  });

  it('wraps a field that overflows its row and marks both halves', () => {
    const html = renderPacket({
      width: 32,
      fields: [
        { label: 'Head', bits: 24 },
        { label: 'Wide', bits: 40 },
      ],
    });
    // Wide spans 8 bits of row 1, all 32 of row 2 — three cells in total.
    expect(parse(html).querySelectorAll('g[data-bl="fields"] rect')).toHaveLength(3);
    expect(html).toContain('(cont.)');
    expect(html).toContain('64 bits · 8 bytes');
  });

  it('flags a partial last row', () => {
    const html = renderPacket({ width: 32, fields: [{ label: 'Only', bits: 12 }] });
    expect(html).toContain('last row is 12 of 32 bits');
  });
});

describe('venn', () => {
  it('draws one circle per set and names each in its own lobe', () => {
    const html = renderVenn({
      sets: [{ label: 'Platform' }, { label: 'Product' }],
      shared: [{ sets: ['Platform', 'Product'], label: 'Release process' }],
    });
    expect(parse(html).querySelectorAll('circle')).toHaveLength(2);
    expect(html).toContain('>Platform<');
    expect(html).toContain('>Release process<');
  });

  it('places a three-set overlap in the middle, matching labels case-insensitively', () => {
    const html = renderVenn({
      sets: [{ label: 'Backend' }, { label: 'Frontend' }, { label: 'Data' }],
      shared: [{ sets: ['backend', 'FRONTEND', 'data'], label: 'Event taxonomy' }],
    });
    expect(parse(html).querySelectorAll('circle')).toHaveLength(3);
    const centre = parse(html)
      .querySelectorAll('.vn-shared')
      .find((t) => t.text.includes('Event'));
    expect(centre?.getAttribute('x')).toBe('310'); // the middle region
  });

  it('ignores a shared region naming a set that does not exist', () => {
    const html = renderVenn({
      sets: [{ label: 'A' }, { label: 'B' }],
      shared: [{ sets: ['A', 'Nope'], label: 'ghost' }],
    });
    expect(html).not.toContain('ghost');
  });
});

describe('wardley', () => {
  const MAP = {
    components: [
      { id: 'user', label: 'Analyst', x: 0.7, y: 0.95, kind: 'user' as const },
      { id: 'db', label: 'Warehouse', x: 0.8, y: 0.3, kind: 'commodity' as const, movement: 0.1 },
    ],
    links: [{ from: 'user', to: 'db' }],
  };

  it('plots visibility up and evolution right', () => {
    const root = parse(renderWardley(MAP));
    const dots = root.querySelectorAll('g[data-bl="components"] circle');
    expect(dots).toHaveLength(2);
    const [analyst, warehouse] = dots.map((c) => ({
      x: Number(c.getAttribute('cx')),
      y: Number(c.getAttribute('cy')),
    }));
    expect(analyst?.y).toBeLessThan(warehouse?.y ?? 0); // more visible → higher
    expect(analyst?.x).toBeLessThan(warehouse?.x ?? 0); // less evolved → left
  });

  it('names the four evolution bands and joins the value chain', () => {
    const html = renderWardley(MAP);
    for (const band of ['GENESIS', 'CUSTOM-BUILT', 'PRODUCT', 'COMMODITY']) {
      expect(html).toContain(`>${band}<`);
    }
    expect(parse(html).querySelectorAll('g[data-bl="links"] line')).toHaveLength(1);
  });

  it('draws movement as a dashed arrow along the evolution axis', () => {
    const html = renderWardley(MAP);
    expect(html).toContain('stroke-dasharray="4 3"');
    expect(html).toContain('marker-end="url(#gArrow)"');
  });

  it('clamps positions outside 0–1 instead of drawing off-canvas', () => {
    const html = renderWardley({
      components: [{ label: 'Out', x: 3, y: -2 }],
    });
    const dot = parse(html).querySelector('g[data-bl="components"] circle');
    expect(Number(dot?.getAttribute('cx'))).toBeLessThanOrEqual(880);
    expect(Number(dot?.getAttribute('cy'))).toBeLessThanOrEqual(420);
  });
});

describe('chart kinds: stacked and scatter', () => {
  const SPEND = {
    labels: ['Q1', 'Q2'],
    series: [
      { label: 'Platform', values: [40, 50] },
      { label: 'Product', values: [20, 30] },
    ],
  };

  it('stacks columns and scales the axis to the totals, not the tallest bar', () => {
    const html = renderChart({ kind: 'stacked', unit: 'k', ...SPEND });
    // Column totals are labelled…
    expect(html).toContain('>60k<');
    expect(html).toContain('>80k<');
    // …and the top gridline is the biggest total, so the stack fits.
    expect(html).toContain('>80k</text>');
  });

  it('scatter plots points without joining them', () => {
    const html = renderChart({ kind: 'scatter', ...SPEND });
    expect(parse(html).querySelectorAll('g[data-bl="series"] circle')).toHaveLength(4);
    expect(html).not.toContain('<polyline');
  });
});
