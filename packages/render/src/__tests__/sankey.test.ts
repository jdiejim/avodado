import { describe, expect, it } from 'vitest';
import { parse } from 'node-html-parser';
import { renderSankey } from '../blocks/sankey.js';
import { renderChart } from '../blocks/chart.js';

/**
 * Every ribbon's thickness at its target end, in link order.
 *
 * The path is `M x0 y0 C …, x1 y1 L x1 y1+t C …, x0 y0+t Z`, so the curve's
 * end point and the L that follows it are the two edges of the same end —
 * their gap is the ribbon's thickness.
 */
function ribbonHeights(html: string): number[] {
  return parse(html)
    .querySelectorAll('path[fill-opacity]')
    .map((p) => {
      const m = /,\s*[\d.]+ ([\d.]+) L [\d.]+ ([\d.]+)/.exec(p.getAttribute('d') ?? '');
      return m === null ? 0 : Math.round((Number(m[2]) - Number(m[1])) * 10) / 10;
    });
}

const SPEND = {
  unit: 'k',
  links: [
    { from: 'Bill', to: 'Compute', value: 60 },
    { from: 'Bill', to: 'Storage', value: 30 },
    { from: 'Compute', to: 'Serving', value: 40 },
    { from: 'Compute', to: 'Batch', value: 20 },
  ],
};

describe('sankey', () => {
  it('infers its nodes from the links, so a bare link list renders', () => {
    const html = renderSankey(SPEND);
    // Bill · Compute · Storage · Serving · Batch
    expect(parse(html).querySelectorAll('rect')).toHaveLength(5);
    expect(html).toContain('>Bill<');
    expect(html).toContain('>Serving<');
    const ribbons = ribbonHeights(html);
    expect(ribbons).toHaveLength(4);
    // Thickness IS the value, on the same scale as the bars: 60 / 30 / 40 / 20.
    expect(ribbons.every((t) => t > 0)).toBe(true);
    expect((ribbons[0] ?? 0) / (ribbons[1] ?? 1)).toBeCloseTo(2, 1);
    expect((ribbons[2] ?? 0) / (ribbons[3] ?? 1)).toBeCloseTo(2, 1);
  });

  it('scales node height by volume — the busier node is the taller bar', () => {
    const root = parse(renderSankey(SPEND));
    const heights = new Map(
      root.querySelectorAll('g[data-bl="nodes"] > g').map((g) => {
        const rect = g.querySelector('rect');
        const name = g.querySelector('.sk-name')?.text ?? '';
        return [name, Number(rect?.getAttribute('height') ?? 0)] as const;
      }),
    );
    const bill = heights.get('Bill') ?? 0;
    const compute = heights.get('Compute') ?? 0;
    const storage = heights.get('Storage') ?? 0;
    expect(bill).toBeGreaterThan(compute); // 90 vs 60
    expect(compute).toBeGreaterThan(storage); // 60 vs 30
    // Both scale off one number: twice the volume is twice the bar.
    expect(compute / storage).toBeCloseTo(2, 1);
  });

  it('puts a node right of everything feeding it', () => {
    const root = parse(renderSankey(SPEND));
    const x = new Map(
      root.querySelectorAll('g[data-bl="nodes"] > g').map((g) => {
        const name = g.querySelector('.sk-name')?.text ?? '';
        return [name, Number(g.querySelector('rect')?.getAttribute('x') ?? 0)] as const;
      }),
    );
    expect(x.get('Bill')).toBeLessThan(x.get('Compute') ?? 0);
    expect(x.get('Compute')).toBeLessThan(x.get('Serving') ?? 0);
    // Storage is fed by Bill only, so it shares Compute's column.
    expect(x.get('Storage')).toBe(x.get('Compute'));
  });

  it('honours declared labels, accents and a pinned column', () => {
    const html = renderSankey({
      nodes: [
        { id: 'a', label: 'Visits', accent: 'navy' },
        { id: 'b', label: 'Bounced', accent: 'red', col: 3 },
      ],
      links: [{ from: 'a', to: 'b', value: 10 }],
    });
    expect(html).toContain('>Visits<');
    expect(html).toContain('>Bounced<');
    expect(html).toContain('var(--negative)');
    const xs = parse(html)
      .querySelectorAll('rect')
      .map((r) => Number(r.getAttribute('x') ?? 0));
    // col: 3 pushes it to the far column rather than sitting next to Visits.
    expect(Math.max(...xs)).toBeGreaterThan(700);
  });

  it('drops self-links and non-positive values rather than drawing nothing', () => {
    const html = renderSankey({
      links: [
        { from: 'a', to: 'a', value: 5 },
        { from: 'a', to: 'b', value: 0 },
        { from: 'a', to: 'c', value: 7 },
      ],
    });
    expect(ribbonHeights(html)).toHaveLength(1);
    expect(html).toContain('>c<');
  });
});

describe('chart kind: gauge', () => {
  it('sweeps the arc by value / max, and names the ceiling', () => {
    const html = renderChart({
      kind: 'gauge',
      unit: '%',
      items: [{ label: 'Migrated', value: 68, desc: 'of 42 services' }],
    });
    // Track + fill for the one item.
    expect(parse(html).querySelectorAll('path[stroke-linecap="round"]')).toHaveLength(2);
    expect(html).toContain('68%'); // the value, in the middle
    expect(html).toContain('OF 42 SERVICES'); // desc becomes the caption
    expect(html).toContain('>100%<'); // default ceiling on the scale
  });

  it('takes a non-percentage ceiling from `max`', () => {
    const html = renderChart({
      kind: 'gauge',
      max: 30,
      unit: ' days',
      items: [{ label: 'Burned', value: 21, accent: 'red' }],
    });
    expect(html).toContain('21 days');
    expect(html).toContain('>30 days<');
    // `chart` paints accents as literal hex (its own palette), unlike the
    // diagram blocks, which use the theme's CSS variables.
    expect(html).toContain('#991b1b');
  });

  it('draws several items as concentric rings with a legend', () => {
    const html = renderChart({
      kind: 'gauge',
      items: [
        { label: 'Adoption', value: 82 },
        { label: 'Retention', value: 64 },
        { label: 'Expansion', value: 38 },
      ],
    });
    const rings = parse(html).querySelectorAll('path[stroke-linecap="round"]');
    expect(rings.length).toBe(6); // track + fill per item
    expect(html).toContain('class="legend"');
    expect(html).toContain('Adoption — 82');
  });
});
