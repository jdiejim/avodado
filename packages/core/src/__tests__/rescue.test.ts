/**
 * The comma trap is repaired at parse time: an unquoted comma inside an inline
 * map folds its fragment back onto the field before it. Only the unambiguous
 * shape (a non-field key with no value, right after a scalar field) is
 * touched; a fragment with a value still surfaces as an unknown field.
 */

import { describe, expect, it } from 'vitest';
import { parseDocument } from '../parser.js';
import { validateDocument } from '../validate.js';
import { rescueInlineCommas } from '../blocks/rescue.js';

const parse = (kind: string, body: string) => parseDocument('```' + kind + '\n' + body + '\n```\n', 't');
const errors = (kind: string, body: string) =>
  validateDocument(parse(kind, body), 't.md').filter((d) => d.level === 'error');

describe('rescueInlineCommas', () => {
  it('folds a comma-split label back together', () => {
    const body = 'nodes:\n  - { id: hold, col: 1, row: 1, kind: process, label: Hold as BACKORDERED, email ETA }\n  - { id: done, col: 2, row: 1, kind: end, label: Done }\nedges:\n  - hold -> done';
    expect(errors('flow', body)).toEqual([]);
    const seg = parse('flow', body).segments[0] as { data: { nodes: Array<{ label: string }> } };
    expect(seg.data.nodes[0]?.label).toBe('Hold as BACKORDERED, email ETA');
  });

  it('rejoins digits with a bare comma and words with a comma-space, across several fragments', () => {
    const body = 'title: Fan-out\nassumptions:\n  - { label: Followers of one account, value: 1,000,000 followers }\n  - { label: Feed cache write throughput, whole fleet, value: "30,000 writes/s" }\nsteps:\n  - { label: Writes, calc: "2M × 300", result: 600M/day }\nresult: { label: Threshold, value: "10,000 followers" }';
    expect(errors('envelope', body)).toEqual([]);
    const seg = parse('envelope', body).segments[0] as { data: { assumptions: Array<{ label: string; value: string }> } };
    expect(seg.data.assumptions[0]?.value).toBe('1,000,000 followers');
    expect(seg.data.assumptions[1]?.label).toBe('Feed cache write throughput, whole fleet');
  });

  it('leaves a fragment that carries a value to the unknown-field diagnostic', () => {
    const body = 'nodes:\n  - { id: a, col: 1, row: 1, label: A, colour: red }';
    const errs = errors('flow', body);
    expect(errs.some((d) => d.message.includes("unknown field 'colour'"))).toBe(true);
    expect(errs[0]?.hint).toContain('Did you mean');
  });

  it('leaves quoted text, nested flow collections, and multi-line maps as written', () => {
    const lines = [
      '  - { id: a, label: "x, y", tags: [a, b], meta: { k: v } }',
      "  - { id: b, label: 'p, q' }",
      '  - { id: c, col: 1,',
      '      row: 2 }',
      'body: |',
      '  plain prose, with commas',
    ];
    for (const line of lines) expect(rescueInlineCommas(line)).toBe(line);
    expect(rescueInlineCommas(lines.join('\n'))).toBe(lines.join('\n'));
  });

  it('never touches a valid inline map', () => {
    const body = 'nodes:\n  - { id: a, col: 1, row: 1, label: A }\n  - { id: b, col: 2, row: 1, label: "B, with comma" }\nedges:\n  - a -> b: go';
    expect(errors('flow', body)).toEqual([]);
    const seg = parse('flow', body).segments[0] as { data: { nodes: Array<{ label: string }> } };
    expect(seg.data.nodes[1]?.label).toBe('B, with comma');
  });
});

describe('YAML parse hints', () => {
  it('names a terse line that carries a key: value pair, and a value that starts with a quote', () => {
    const mixed = validateDocument(parse('spans', 'spans:\n  - api/order: POST /orders · 1780, duration: 90'), 't.md');
    expect(mixed[0]?.code).toBe('E_PARSE_YAML');
    expect(mixed[0]?.hint).toContain('object form');
    const field = validateDocument(parse('steps', 'items:\n  - title: Migrate\n    note: A call must pass retryOn: () => true'), 't.md');
    expect(field[0]?.code).toBe('E_PARSE_YAML');
    expect(field[0]?.hint).toContain('must be quoted');
    const quoted = validateDocument(parse('table', 'columns: [A]\nrows:\n  - [x]\nnote: "Needs" lists direct dependencies only'), 't.md');
    expect(quoted[0]?.code).toBe('E_PARSE_YAML');
    expect(quoted[0]?.hint).toContain('quoted whole');
  });

  it('names the bracket-in-a-row and unclosed-map shapes', () => {
    const row = validateDocument(parse('table', 'columns: [A, B]\nrows:\n  - [product_variants, variants[], x]'), 't.md');
    expect(row[0]?.code).toBe('E_PARSE_YAML');
    expect(row[0]?.hint).toContain('quote any cell');
    const open = validateDocument(parse('flow', 'nodes:\n  - { id: a, col: 1, row: 1, label: A\n  - { id: b, col: 2, row: 1, label: B }'), 't.md');
    expect(open[0]?.code).toBe('E_PARSE_YAML');
    expect(open[0]?.hint).toContain('close with `}`');
  });
});
