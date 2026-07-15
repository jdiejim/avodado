/**
 * Long node labels must wrap INSIDE their shape instead of overflowing it or
 * colliding with neighbouring nodes (the `dfd` overlap bug):
 *
 * - `dfd` node names wrap word-aware to ≤3 lines of ≤20 chars; the cell grows
 *   14px per extra line so the tallest label still sits inside its shape.
 * - `state` pills clamp their width to the grid cell (they used to grow
 *   unbounded and overlap the next pill) and wrap to ≤3 lines of ≤23 chars,
 *   gaining 15px of height per extra line.
 *
 * Short labels must render byte-identically to the pre-wrap output — the
 * single-line path is pinned here so normal docs (e.g. the demo template)
 * don't shift by a pixel.
 */

import { describe, expect, it } from 'vitest';
import { renderDfd } from '../blocks/dfd.js';
import { renderState } from '../blocks/state.js';

const LONG = 'Customer support ticket triage service';

describe('dfd long-label wrapping', () => {
  const html = renderDfd({
    nodes: [
      { id: 'p', name: LONG, col: 1, row: 1, kind: 'process' },
      { id: 's', name: 'Long-term ticket archive datastore', col: 2, row: 1, kind: 'store' },
    ],
    edges: [{ from: 'p', to: 's' }],
  });

  it('splits a long name across multiple text lines inside a data-bp group', () => {
    const group = /<g data-bp="nodes\.0\.name">((?:<text [^>]*class="dfd-name"[^>]*>[^<]*<\/text>)+)<\/g>/.exec(html);
    expect(group).not.toBeNull();
    const lines = [...(group?.[1] ?? '').matchAll(/<text [^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
    expect(lines).toEqual(['Customer support', 'ticket triage', 'service']);
    // Word-aware budget: every line fits the 148px cell (~20 chars at 12px).
    for (const ln of lines) expect((ln ?? '').length).toBeLessThanOrEqual(20);
  });

  it('grows the cell height so wrapped lines stay inside the shape', () => {
    // 3 lines -> cellH 66 + 2*14 = 94; viewBox height = padTop + cellH + padBot.
    expect(html).toContain('height="94"');
    expect(html).toContain(`viewBox="0 0 452 140"`);
    // Line baselines (63/77/91) sit within the shape's y-range 26..120.
    expect(html).toContain('y="63" class="dfd-name"');
    expect(html).toContain('y="91" class="dfd-name"');
  });

  it('keeps text centred within the shape width (no spill past the viewBox)', () => {
    // All name lines anchor at the cell centre; text-anchor middle + a ≤20
    // char budget keeps them within x 26..174 for the first cell.
    const xs = [...html.matchAll(/<text x="(\d+)" y="\d+" class="dfd-name"/g)].map((m) => Number(m[1]));
    expect(xs.length).toBeGreaterThan(1);
    for (const x of xs) expect(x === 100 || x === 352).toBe(true);
  });

  it('renders short names byte-identically to the pre-wrap single-line output', () => {
    const short = renderDfd({
      nodes: [{ id: 'c', name: 'Client', col: 1, row: 1, kind: 'external' }],
    });
    // Single <text>, carrying the data-bp itself, at the historical y (cy+4)
    // in an unchanged 66px cell.
    expect(short).toContain(
      '<text x="100" y="63" class="dfd-name" fill="#374151" data-bp="nodes.0.name">Client</text>',
    );
    expect(short).toContain('height="66"');
    expect(short).not.toContain('<g data-bp="nodes.0.name">');
  });
});

describe('state pill clamping + wrapping', () => {
  const html = renderState({
    states: [
      { id: 'a', name: 'Awaiting customer support triage assignment', col: 1, row: 1 },
      { id: 'b', name: 'Validating payment authorization request', col: 2, row: 1, kind: 'wait' },
    ],
    transitions: [{ from: 'a', to: 'b', event: 'assign' }],
  });

  it('splits a long name across multiple sm-name lines inside a data-bp group', () => {
    const group = /<g data-bp="states\.0\.name">((?:<text [^>]*class="sm-name"[^>]*>[^<]*<\/text>)+)<\/g>/.exec(html);
    expect(group).not.toBeNull();
    const lines = [...(group?.[1] ?? '').matchAll(/<text [^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
    expect(lines).toEqual(['Awaiting customer', 'support triage', 'assignment']);
  });

  it('clamps the pill inside its grid cell so neighbours cannot overlap', () => {
    const widths = [...html.matchAll(/<rect [^>]*width="(\d+)" height="\d+" rx="23"/g)].map((m) =>
      Number(m[1]),
    );
    expect(widths.length).toBe(2);
    // Cell pitch is cellW + gapX = 242; the clamp keeps every pill ≤ 216
    // (pre-fix these names produced 370px / 354px pills that overlapped).
    for (const w of widths) expect(w).toBeLessThanOrEqual(216);
    // The pill grows downward instead: 3 lines -> 46 + 2*15 = 76.
    expect(html).toContain('height="76" rx="23"');
  });

  it('renders short names byte-identically to the pre-wrap single-line output', () => {
    const short = renderState({
      states: [
        { id: 'a', name: 'Draft', col: 1, row: 1 },
        { id: 'b', name: 'Live', col: 2, row: 1 },
      ],
      transitions: [{ from: 'a', to: 'b', event: 'publish' }],
    });
    expect(short).toContain('width="96" height="46" rx="23"');
    expect(short).toContain(
      '<text x="114" y="66.5" class="sm-name" fill="var(--charcoal)" data-bp="states.0.name">Draft</text>',
    );
    expect(short).not.toContain('<g data-bp="states.0.name">');
  });
});
