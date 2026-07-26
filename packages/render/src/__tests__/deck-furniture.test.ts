import { describe, expect, it } from 'vitest';
import { parse } from 'node-html-parser';
import { parseDocument } from '@avodado/core';
import { toSlides } from '../deck.js';
import { renderDocumentSegments } from '../parts.js';
import { renderScenarios } from '../blocks/scenarios.js';
import { renderTree } from '../blocks/tree.js';

const DECK = [
  '```meta',
  'title: Programme',
  '```',
  '',
  '```divider',
  'kicker: PART 1',
  'title: Where the time goes',
  '```',
  '',
  '## p95 is three systems {source: production traces, 14 Oct 2026}',
  '',
  '```stats',
  'stats:',
  '  - { value: "2.4s", label: p95 }',
  '```',
  '',
  '```divider',
  'kicker: PART 2',
  'title: What it is worth',
  '```',
  '',
  '## The plan holds up',
  '',
  '```stats',
  'stats:',
  '  - { value: "$24M", label: FY27 }',
  '```',
].join('\n');

describe('slide furniture', () => {
  it('puts a {source: …} marker in the footer, not in the title', () => {
    const html = toSlides(parseDocument(DECK, 'deck'));
    const root = parse(html);
    const titles = root.querySelectorAll('.slide-hd-l').map((t) => t.text);
    expect(titles.some((t) => t.includes('p95 is three systems'))).toBe(true);
    expect(titles.some((t) => t.includes('{source'))).toBe(false);
    expect(html).toContain('Source: production traces, 14 Oct 2026');
    expect(root.querySelectorAll('.slide-ft-src').length).toBe(1);
  });

  it('tracks the deck parts, lighting the current one', () => {
    const root = parse(toSlides(parseDocument(DECK, 'deck')));
    const trackers = root.querySelectorAll('.slide-track');
    expect(trackers.length).toBeGreaterThan(0);
    // Both parts listed on every tracked slide, exactly one lit.
    for (const t of trackers) {
      expect(t.querySelectorAll('.slide-track-part')).toHaveLength(2);
      expect(t.querySelectorAll('.slide-track-part.on').length).toBeLessThanOrEqual(1);
    }
    const lit = root.querySelectorAll('.slide-track-part.on').map((p) => p.text);
    expect(lit).toContain('Where the time goes');
    expect(lit).toContain('What it is worth');
  });

  it('draws no tracker for a deck with fewer than two parts', () => {
    const one = [
      '```meta',
      'title: One',
      '```',
      '',
      '```divider',
      'title: Only part',
      '```',
      '',
      '## A slide',
      '',
      'Text.',
    ].join('\n');
    expect(toSlides(parseDocument(one, 'one'))).not.toContain('<span class="slide-track-part');
  });
});

describe('scenarios', () => {
  const PLAN = {
    drivers: ['Async capture', 'Conversion', 'Volume'],
    cases: [
      { label: 'Downside', values: ['Q4 slip', '+0.8pp', '5%'], outcome: '$18M', tone: 'neg' as const },
      { label: 'Base', values: ['Q3', '+2.1pp', '8%'], outcome: '$24M', tone: 'base' as const },
      { label: 'Upside', values: ['Q3', '+3.4pp'], outcome: '$31M', tone: 'pos' as const },
    ],
  };

  it('puts cases in columns and drivers in rows', () => {
    const root = parse(renderScenarios(PLAN));
    expect(root.querySelectorAll('thead th')).toHaveLength(4); // driver + 3 cases
    expect(root.querySelectorAll('tbody tr')).toHaveLength(4); // 3 drivers + outcome
  });

  it('badges the base case and tones the others', () => {
    const html = renderScenarios(PLAN);
    expect(html).toContain('BASE CASE');
    expect(html).toContain('sc-neg');
    expect(html).toContain('sc-pos');
  });

  it('shows a missing assumption as silence, not as no change', () => {
    const root = parse(renderScenarios(PLAN));
    const blanks = root.querySelectorAll('.sn-blank');
    expect(blanks).toHaveLength(1); // Upside states nothing for Volume
    expect(blanks[0]?.text).toBe('·');
  });

  it('gives the outcome its own row, under its own label', () => {
    const html = renderScenarios({ ...PLAN, outcomeLabel: 'FY27 revenue' });
    const row = parse(html).querySelector('.sn-outcome');
    expect(row?.text).toContain('FY27 revenue');
    expect(row?.text).toContain('$24M');
  });
});

describe('tree with values — the driver tree', () => {
  const P95 = {
    unit: 'ms',
    nodes: [
      { id: 'p95', label: 'Checkout p95', value: 2400 },
      { id: 'cap', parent: 'p95', label: 'Payment capture', value: 1780 },
      { id: 'psp', parent: 'cap', label: 'PSP round trip', value: 1520 },
      { id: 'db', parent: 'p95', label: 'Order write', value: 380 },
    ],
  };

  it('prints each value with its unit', () => {
    const html = renderTree(P95);
    expect(html).toContain('2400ms');
    expect(html).toContain('1780ms');
  });

  it('computes each node’s share of its parent, not of the root', () => {
    const shares = parse(renderTree(P95))
      .querySelectorAll('.tshare')
      .map((s) => s.text);
    // capture 1780/2400 = 74% · PSP 1520/1780 = 85% (of capture) · write 380/2400 = 16%
    expect(shares).toEqual(['74%', '85%', '16%']);
  });

  it('leaves a value-less tree exactly as it was', () => {
    const plain = renderTree({ nodes: [{ id: 'a', label: 'A' }, { id: 'b', parent: 'a', label: 'B' }] });
    expect(plain).not.toContain('tvalue');
    expect(plain).not.toContain('tshare');
  });
});

describe('heading markers never reach the reader', () => {
  it('strips {source: …} from the page heading and prints it as provenance', () => {
    const html = renderDocumentSegments(parseDocument(DECK, 'deck'))
      .segments.map((s) => s.html)
      .join('');
    expect(html).toContain('p95 is three systems');
    expect(html).not.toContain('{source');
    expect(html).toContain('Source: production traces, 14 Oct 2026');
  });

  it('strips the alignment markers on the page too', () => {
    const doc = ['## Message {split}', '', 'Text.'].join('\n');
    const html = renderDocumentSegments(parseDocument(doc, 'm'))
      .segments.map((s) => s.html)
      .join('');
    expect(html).toContain('>Message<');
    expect(html).not.toContain('{split}');
  });

  it('handles both markers on one heading, in either order', () => {
    const both = ['## Title {top} {source: a study, 2026}', '', 'Text.'].join('\n');
    const html = renderDocumentSegments(parseDocument(both, 'b'))
      .segments.map((s) => s.html)
      .join('');
    expect(html).toContain('>Title<');
    expect(html).not.toContain('{');
    expect(html).toContain('Source: a study, 2026');
  });
});
