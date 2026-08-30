import { describe, expect, it } from 'vitest';
import { parseDocument, validateDocument, type Diagnostic } from '@avodado/core';
import { buildCheckRows, docCheckStatus } from './checkView.js';

const SOURCE = [
  '```meta',
  'title: Test doc',
  '```',
  '',
  'Some prose.',
  '',
  '```callout',
  'title: Fine',
  'tone: nope', // invalid enum → E_SCHEMA, mapped to the `tone` field
  'body: hi',
  '```',
  '',
].join('\n');

describe('buildCheckRows', () => {
  const doc = parseDocument(SOURCE, 'test');
  const diags = validateDocument(doc, 'test.md');

  it('locates each diagnostic in its segment and top-level field', () => {
    const rows = buildCheckRows(SOURCE, doc, diags);
    expect(rows).toHaveLength(diags.length);
    const schema = rows.find((r) => r.code === 'E_SCHEMA');
    expect(schema).toBeDefined();
    // segments: 0 = meta, 1 = prose, 2 = callout
    expect(schema?.segIndex).toBe(2);
    expect(schema?.segKind).toBe('callout');
    expect(schema?.field).toBe('tone');
    expect(schema?.level).toBe('error');
    expect(schema?.line).toBeGreaterThan(0);
  });

  it('leaves line-less diagnostics unlocated (no segment, no field)', () => {
    const docLevel: Diagnostic = {
      file: 'test.md',
      level: 'warn',
      code: 'W_DOC_CONVENTION',
      message: 'no line on this one',
    };
    const rows = buildCheckRows(SOURCE, doc, [docLevel]);
    expect(rows[0]).toMatchObject({ segIndex: null, segKind: null, field: null, line: null });
  });

  it('locates a prose diagnostic without inventing a field', () => {
    const onProse: Diagnostic = {
      file: 'test.md',
      level: 'warn',
      code: 'W_PROSE_LONG_SENTENCE',
      message: 'x',
      line: 5, // "Some prose."
    };
    const rows = buildCheckRows(SOURCE, doc, [onProse]);
    expect(rows[0]?.segIndex).toBe(1);
    expect(rows[0]?.segKind).toBe('markdown');
    expect(rows[0]?.field).toBeNull();
  });
});

describe('docCheckStatus', () => {
  it('uses the live error count for the open doc', () => {
    expect(docCheckStatus({ slug: 'a', errorCount: 0 }, { slug: 'a', errors: 2 })).toEqual({
      kind: 'errors',
      count: 2,
    });
    expect(docCheckStatus({ slug: 'a', errorCount: 3 }, { slug: 'a', errors: 0 })).toEqual({
      kind: 'pass',
    });
  });

  it('uses the payload errorCount for every other doc', () => {
    expect(docCheckStatus({ slug: 'b', errorCount: 1 }, { slug: 'a', errors: 0 })).toEqual({
      kind: 'errors',
      count: 1,
    });
    expect(docCheckStatus({ slug: 'b', errorCount: 0 }, { slug: 'a', errors: 5 })).toEqual({
      kind: 'pass',
    });
  });

  it('is unknown when the payload carries no count (older server)', () => {
    expect(docCheckStatus({ slug: 'b' }, { slug: 'a', errors: 0 })).toEqual({ kind: 'unknown' });
    // …but never for the open doc, whose diagnostics are always live.
    expect(docCheckStatus({ slug: 'a' }, { slug: 'a', errors: 0 })).toEqual({ kind: 'pass' });
  });

  it('warnings never change status (errors-only vocabulary)', () => {
    // A doc with only warnings has errorCount 0 upstream — status is pass.
    expect(docCheckStatus({ slug: 'b', errorCount: 0 }, { slug: null, errors: 0 })).toEqual({
      kind: 'pass',
    });
  });
});
