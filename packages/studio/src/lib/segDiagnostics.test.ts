import { describe, expect, it } from 'vitest';
import { parseDocument, validateDocument } from '@avodado/core';
import { countLevels, diagnosticsForSegment } from './segDiagnostics.js';

const SOURCE = [
  '```meta',
  'title: Test doc',
  '```',
  '',
  'Some prose.',
  '',
  '```callout',
  'tone: nope', // invalid enum → E_SCHEMA on this block
  'body: hi',
  '```',
  '',
  '```table',
  'columns: [A]',
  'rows:',
  '  - [x]',
  '```',
  '',
].join('\n');

describe('diagnosticsForSegment', () => {
  const doc = parseDocument(SOURCE, 'test');
  const diags = validateDocument(doc, 'test.md');

  it('attributes the schema error to the callout segment only', () => {
    expect(diags.length).toBeGreaterThan(0);
    // segments: 0 = meta, 1 = prose, 2 = callout, 3 = table
    const callout = diagnosticsForSegment(diags, SOURCE, doc, 2);
    expect(callout.length).toBeGreaterThan(0);
    expect(callout.every((d) => d.code === 'E_SCHEMA')).toBe(true);
    expect(diagnosticsForSegment(diags, SOURCE, doc, 0)).toEqual([]);
    expect(diagnosticsForSegment(diags, SOURCE, doc, 1)).toEqual([]);
    expect(diagnosticsForSegment(diags, SOURCE, doc, 3)).toEqual([]);
  });

  it('returns [] for an out-of-range segment index', () => {
    expect(diagnosticsForSegment(diags, SOURCE, doc, 99)).toEqual([]);
  });

  it('counts levels', () => {
    const callout = diagnosticsForSegment(diags, SOURCE, doc, 2);
    const { errors, warnings } = countLevels(callout);
    expect(errors).toBeGreaterThan(0);
    expect(errors + warnings).toBe(callout.length);
  });
});
