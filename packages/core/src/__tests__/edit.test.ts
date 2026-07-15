import { describe, expect, it } from 'vitest';
import { parseDocument } from '../parser.js';
import {
  segmentSpan,
  replaceBlockBody,
  replaceProse,
  insertBlock,
  insertProse,
  removeSegment,
  moveSegment,
  serializeBlockData,
  setYamlPath,
  deleteYamlPath,
} from '../edit.js';
import type { Document, Segment } from '../types.js';

/**
 * Fixture layout (1-based lines):
 *  1-4   meta block
 *  5-9   prose (blank, ## Intro, blank, Some prose., blank)
 * 10-13  callout block
 * 14     blank gap (belongs to no segment)
 * 15-19  table block
 * 20-22  prose (blank, Closing prose., trailing empty line)
 */
const FIXTURE = [
  '```meta',
  'title: Fixture',
  'tag: TEST',
  '```',
  '',
  '## Intro',
  '',
  'Some prose.',
  '',
  '```callout',
  'tone: note',
  'title: Heads up',
  '```',
  '',
  '```table',
  'columns: [A, B]',
  'rows:',
  '  - [1, 2]',
  '```',
  '',
  'Closing prose.',
  '',
].join('\n');

function fixtureDoc(): Document {
  return parseDocument(FIXTURE, 'fixture');
}

/** Segment kinds of a parsed source — the structural fingerprint. */
function kinds(source: string): string[] {
  return parseDocument(source, 'check').segments.map((s) => s.kind);
}

const FIXTURE_KINDS = ['meta', 'markdown', 'callout', 'table', 'markdown'];

describe('segmentSpan', () => {
  const doc = fixtureDoc();
  const seg = (i: number): Segment => doc.segments[i] as Segment;

  it('spans closed fenced blocks including both fences', () => {
    expect(segmentSpan(FIXTURE, seg(0))).toEqual({ startLine: 1, endLine: 4 });
    expect(segmentSpan(FIXTURE, seg(2))).toEqual({ startLine: 10, endLine: 13 });
    expect(segmentSpan(FIXTURE, seg(3))).toEqual({ startLine: 15, endLine: 19 });
  });

  it('spans prose runs including the blank lines they own', () => {
    expect(segmentSpan(FIXTURE, seg(1))).toEqual({ startLine: 5, endLine: 9 });
    expect(segmentSpan(FIXTURE, seg(4))).toEqual({ startLine: 20, endLine: 22 });
  });

  it('extends an unclosed fence to EOF', () => {
    const src = 'Intro.\n\n```callout\ntone: note';
    const doc2 = parseDocument(src, 'unclosed');
    expect(segmentSpan(src, doc2.segments[1] as Segment)).toEqual({ startLine: 3, endLine: 4 });
  });

  it('distinguishes an empty body from a one-blank-line body (raw is "" for both)', () => {
    const empty = '```callout\n```\n';
    const emptyDoc = parseDocument(empty, 'empty');
    expect((emptyDoc.segments[0] as Segment & { raw: string }).raw).toBe('');
    expect(segmentSpan(empty, emptyDoc.segments[0] as Segment)).toEqual({
      startLine: 1,
      endLine: 2,
    });

    const blank = '```callout\n\n```\n';
    const blankDoc = parseDocument(blank, 'blank');
    expect((blankDoc.segments[0] as Segment & { raw: string }).raw).toBe('');
    expect(segmentSpan(blank, blankDoc.segments[0] as Segment)).toEqual({
      startLine: 1,
      endLine: 3,
    });
  });

  it('handles a closing fence at EOF without a trailing newline', () => {
    const src = 'Intro.\n\n```callout\ntone: note\n```';
    const doc2 = parseDocument(src, 'eof');
    expect(segmentSpan(src, doc2.segments[1] as Segment)).toEqual({ startLine: 3, endLine: 5 });
  });

  it('spans a prose run with interior blank lines', () => {
    const src = 'para one\n\npara two\n';
    const doc2 = parseDocument(src, 'prose');
    expect(doc2.segments).toHaveLength(1);
    expect(segmentSpan(src, doc2.segments[0] as Segment)).toEqual({ startLine: 1, endLine: 4 });
  });
});

describe('replaceBlockBody', () => {
  it('round-trips every typed block: replacing raw with itself is identity', () => {
    const doc = fixtureDoc();
    for (const [i, seg] of doc.segments.entries()) {
      if (seg.kind === 'markdown') continue;
      expect(replaceBlockBody(FIXTURE, doc, i, seg.raw)).toBe(FIXTURE);
    }
  });

  it('round-trips empty and one-blank-line bodies (the ambiguous raw === "" case)', () => {
    for (const src of ['```callout\n```\n', '```callout\n\n```\n']) {
      const doc = parseDocument(src, 'ambiguous');
      expect(replaceBlockBody(src, doc, 0, '')).toBe(src);
    }
  });

  it('swaps the body verbatim and leaves everything else untouched', () => {
    const doc = fixtureDoc();
    const result = replaceBlockBody(FIXTURE, doc, 2, 'tone: tip\ntitle: Updated');
    const after = parseDocument(result, 'after');
    expect(after.segments.map((s) => s.kind)).toEqual(FIXTURE_KINDS);
    const callout = after.segments[2] as Segment & { raw: string; data: unknown };
    expect(callout.raw).toBe('tone: tip\ntitle: Updated');
    expect(callout.data).toEqual({ tone: 'tip', title: 'Updated' });
    // Neighbours byte-identical.
    expect((after.segments[3] as Segment & { raw: string }).raw).toBe(
      (doc.segments[3] as Segment & { raw: string }).raw,
    );
    expect((after.segments[1] as Segment & { text: string }).text).toBe(
      (doc.segments[1] as Segment & { text: string }).text,
    );
  });

  it('an empty newRaw produces a zero-line body', () => {
    const doc = fixtureDoc();
    const result = replaceBlockBody(FIXTURE, doc, 2, '');
    expect(result).toContain('```callout\n```');
    const after = parseDocument(result, 'after');
    expect(after.segments.map((s) => s.kind)).toEqual(FIXTURE_KINDS);
    expect((after.segments[2] as Segment & { raw: string }).raw).toBe('');
  });

  it('replaces the body of an unclosed block (still unclosed after)', () => {
    const src = 'Intro.\n\n```callout\ntone: note';
    const doc = parseDocument(src, 'unclosed');
    const result = replaceBlockBody(src, doc, 1, 'tone: tip');
    expect(result).toBe('Intro.\n\n```callout\ntone: tip');
    const after = parseDocument(result, 'after');
    expect((after.segments[1] as Segment & { raw: string }).raw).toBe('tone: tip');
  });

  it('throws TypeError on a prose segment and RangeError on a bad index', () => {
    const doc = fixtureDoc();
    expect(() => replaceBlockBody(FIXTURE, doc, 1, 'x')).toThrow(TypeError);
    expect(() => replaceBlockBody(FIXTURE, doc, 99, 'x')).toThrow(RangeError);
    expect(() => replaceBlockBody(FIXTURE, doc, -1, 'x')).toThrow(RangeError);
  });
});

describe('replaceProse', () => {
  it('round-trips: replacing text with itself is identity', () => {
    const doc = fixtureDoc();
    for (const [i, seg] of doc.segments.entries()) {
      if (seg.kind !== 'markdown') continue;
      expect(replaceProse(FIXTURE, doc, i, seg.text)).toBe(FIXTURE);
    }
  });

  it('replaces a prose run verbatim', () => {
    const doc = fixtureDoc();
    const result = replaceProse(FIXTURE, doc, 1, '## Changed\n\nNew prose here.');
    const after = parseDocument(result, 'after');
    expect(after.segments.map((s) => s.kind)).toEqual(FIXTURE_KINDS);
    expect((after.segments[1] as Segment & { text: string }).text).toBe(
      '## Changed\n\nNew prose here.',
    );
    expect((after.segments[2] as Segment & { raw: string }).raw).toBe(
      'tone: note\ntitle: Heads up',
    );
  });

  it('throws TypeError on a typed segment', () => {
    const doc = fixtureDoc();
    expect(() => replaceProse(FIXTURE, doc, 0, 'x')).toThrow(TypeError);
  });
});

describe('CRLF input', () => {
  const CRLF = FIXTURE.replace(/\n/g, '\r\n');

  it('segmentSpan works against CRLF sources', () => {
    const doc = parseDocument(CRLF, 'crlf');
    expect(segmentSpan(CRLF, doc.segments[3] as Segment)).toEqual({ startLine: 15, endLine: 19 });
  });

  it('ops normalise the output to LF', () => {
    const doc = parseDocument(CRLF, 'crlf');
    const roundtrip = replaceBlockBody(CRLF, doc, 2, 'tone: note\ntitle: Heads up');
    expect(roundtrip).toBe(FIXTURE);
    expect(roundtrip).not.toContain('\r');
    const inserted = insertBlock(CRLF, doc, 0, 'callout', 'tone: tip');
    expect(inserted).not.toContain('\r');
    expect(kinds(inserted)).toEqual(['callout', ...FIXTURE_KINDS]);
  });
});

describe('insertBlock', () => {
  it('inserts at index 0 with one blank line before the old first segment', () => {
    const doc = fixtureDoc();
    const result = insertBlock(FIXTURE, doc, 0, 'callout', 'tone: tip');
    expect(result.startsWith('```callout\ntone: tip\n```\n\n```meta\n')).toBe(true);
    expect(result).not.toContain('\n\n\n');
    const after = parseDocument(result, 'after');
    expect(after.segments.map((s) => s.kind)).toEqual(['callout', ...FIXTURE_KINDS]);
    expect((after.segments[0] as Segment & { raw: string }).raw).toBe('tone: tip');
  });

  it('inserts in the middle, absorbing the blank gap into exactly one blank line each side', () => {
    const doc = fixtureDoc();
    const result = insertBlock(FIXTURE, doc, 3, 'callout', 'tone: warn');
    expect(result).toContain('```\n\n```callout\ntone: warn\n```\n\n```table\n');
    expect(result).not.toContain('\n\n\n');
    expect(kinds(result)).toEqual(['meta', 'markdown', 'callout', 'callout', 'table', 'markdown']);
  });

  it('appends when index === segments.length, ending with a trailing newline', () => {
    const doc = fixtureDoc();
    const result = insertBlock(FIXTURE, doc, doc.segments.length, 'callout', 'tone: danger');
    expect(result.endsWith('Closing prose.\n\n```callout\ntone: danger\n```\n')).toBe(true);
    expect(result).not.toContain('\n\n\n');
    expect(kinds(result)).toEqual([...FIXTURE_KINDS, 'callout']);
  });

  it('inserts into an empty document', () => {
    for (const src of ['', '\n\n']) {
      const doc = parseDocument(src, 'empty');
      expect(doc.segments).toHaveLength(0);
      const result = insertBlock(src, doc, 0, 'callout', 'tone: note');
      expect(result).toBe('```callout\ntone: note\n```\n');
    }
  });

  it('an empty body produces adjacent fences', () => {
    const doc = parseDocument('', 'empty');
    expect(insertBlock('', doc, 0, 'callout', '')).toBe('```callout\n```\n');
  });

  it('throws RangeError for an out-of-range index', () => {
    const doc = fixtureDoc();
    expect(() => insertBlock(FIXTURE, doc, doc.segments.length + 1, 'callout', '')).toThrow(
      RangeError,
    );
    expect(() => insertBlock(FIXTURE, doc, -1, 'callout', '')).toThrow(RangeError);
  });
});

describe('insertProse', () => {
  it('inserts a prose run between two blocks', () => {
    const doc = fixtureDoc();
    const result = insertProse(FIXTURE, doc, 3, '### A note between blocks');
    expect(result).toContain('```\n\n### A note between blocks\n\n```table\n');
    const after = parseDocument(result, 'after');
    expect(after.segments.map((s) => s.kind)).toEqual([
      'meta',
      'markdown',
      'callout',
      'markdown',
      'table',
      'markdown',
    ]);
    expect((after.segments[3] as Segment & { text: string }).text.trim()).toBe(
      '### A note between blocks',
    );
  });

  it('appends prose at the end', () => {
    const doc = fixtureDoc();
    const result = insertProse(FIXTURE, doc, doc.segments.length, 'The end.');
    expect(result.endsWith('Closing prose.\n\nThe end.\n')).toBe(true);
    // The appended text merges into the trailing prose run on re-parse.
    expect(kinds(result)).toEqual(FIXTURE_KINDS);
  });
});

describe('removeSegment', () => {
  it('removes a block and leaves exactly one blank line between the new neighbours', () => {
    const doc = fixtureDoc();
    const result = removeSegment(FIXTURE, doc, 3);
    expect(result).not.toContain('```table');
    expect(result).not.toContain('\n\n\n');
    expect(result).toContain('title: Heads up\n```\n\nClosing prose.\n');
    expect(kinds(result)).toEqual(['meta', 'markdown', 'callout', 'markdown']);
  });

  it('removes the first segment, preserving the rest verbatim', () => {
    const doc = fixtureDoc();
    const result = removeSegment(FIXTURE, doc, 0);
    expect(result.startsWith('## Intro\n')).toBe(true);
    expect(result.endsWith('Closing prose.\n')).toBe(true);
    expect(kinds(result)).toEqual(['markdown', 'callout', 'table', 'markdown']);
  });

  it('removes the last segment, keeping a trailing newline', () => {
    const doc = fixtureDoc();
    const result = removeSegment(FIXTURE, doc, 4);
    expect(result.endsWith('  - [1, 2]\n```\n')).toBe(true);
    expect(result).not.toContain('Closing prose.');
    expect(kinds(result)).toEqual(['meta', 'markdown', 'callout', 'table']);
  });

  it('removing between two blocks does not fuse their fences', () => {
    const src = '```callout\ntone: note\n```\n\n```callout\ntone: tip\n```\n\n```callout\ntone: warn\n```\n';
    const doc = parseDocument(src, 'three');
    const result = removeSegment(src, doc, 1);
    expect(result).toBe('```callout\ntone: note\n```\n\n```callout\ntone: warn\n```\n');
    expect(kinds(result)).toEqual(['callout', 'callout']);
  });

  it('removing the only segment yields an empty string', () => {
    const src = '```callout\ntone: note\n```\n';
    const doc = parseDocument(src, 'solo');
    expect(removeSegment(src, doc, 0)).toBe('');
  });

  it('throws RangeError for an out-of-range index', () => {
    const doc = fixtureDoc();
    expect(() => removeSegment(FIXTURE, doc, 5)).toThrow(RangeError);
  });
});

describe('moveSegment', () => {
  const THREE = '```callout\ntone: note\n```\n\n```table\ncolumns: [A]\n```\n\n```divider\ntitle: End\n```\n';

  it('moves a segment up (to < from): new index is `to`', () => {
    const doc = parseDocument(THREE, 'three');
    const result = moveSegment(THREE, doc, 2, 0);
    expect(kinds(result)).toEqual(['divider', 'callout', 'table']);
    expect((parseDocument(result, 'r').segments[0] as Segment & { raw: string }).raw).toBe(
      'title: End',
    );
  });

  it('moves a segment down (to > from): lands before the segment originally at `to`', () => {
    const doc = parseDocument(THREE, 'three');
    // Move A before the segment originally at index 2 (divider) → [B, A, C].
    const result = moveSegment(THREE, doc, 0, 2);
    expect(kinds(result)).toEqual(['table', 'callout', 'divider']);
  });

  it('moves first → last and last → first', () => {
    const doc = parseDocument(THREE, 'three');
    const toEnd = moveSegment(THREE, doc, 0, doc.segments.length);
    expect(kinds(toEnd)).toEqual(['table', 'divider', 'callout']);
    expect(toEnd).not.toContain('\n\n\n');

    const toEndDoc = parseDocument(toEnd, 'r');
    const back = moveSegment(toEnd, toEndDoc, 2, 0);
    expect(kinds(back)).toEqual(['callout', 'table', 'divider']);
    expect(back).toBe(THREE);
  });

  it('preserves the moved block byte-for-byte in a mixed document', () => {
    const doc = fixtureDoc();
    const result = moveSegment(FIXTURE, doc, 3, 2); // table before callout
    expect(kinds(result)).toEqual(['meta', 'markdown', 'table', 'callout', 'markdown']);
    const after = parseDocument(result, 'after');
    expect((after.segments[2] as Segment & { raw: string }).raw).toBe(
      'columns: [A, B]\nrows:\n  - [1, 2]',
    );
  });

  it('to === from and to === from + 1 are no-ops', () => {
    const doc = parseDocument(THREE, 'three');
    expect(moveSegment(THREE, doc, 1, 1)).toBe(THREE);
    expect(moveSegment(THREE, doc, 1, 2)).toBe(THREE);
  });

  it('throws RangeError for out-of-range indices', () => {
    const doc = parseDocument(THREE, 'three');
    expect(() => moveSegment(THREE, doc, 3, 0)).toThrow(RangeError);
    expect(() => moveSegment(THREE, doc, 0, 4)).toThrow(RangeError);
  });
});

describe('serializeBlockData', () => {
  it('stringifies without a trailing newline', () => {
    expect(serializeBlockData({ tone: 'note', title: 'Hi' })).toBe("tone: note\ntitle: Hi");
    expect(serializeBlockData({ a: 1, b: ['x', 'y'] })).toBe('a: 1\nb:\n  - x\n  - y');
  });

  it('does not wrap long lines (lineWidth: 0)', () => {
    const long = 'word '.repeat(40).trim();
    expect(serializeBlockData({ text: long })).toBe(`text: ${long}`);
  });
});

describe('setYamlPath / deleteYamlPath', () => {
  const RAW = [
    '# keep this comment',
    'tone: note',
    'title: "Quoted: title"',
    'items:',
    '  - label: one',
    '  - label: two',
  ].join('\n');

  it('sets a scalar while preserving comments and quoting elsewhere', () => {
    const result = setYamlPath(RAW, ['tone'], 'tip');
    expect(result).toContain('# keep this comment');
    expect(result).toContain('tone: tip');
    // Untouched quoted string keeps its exact quoting.
    expect(result).toContain('title: "Quoted: title"');
    expect(result.endsWith('\n')).toBe(false);
  });

  it('sets a nested array path', () => {
    const result = setYamlPath(RAW, ['items', 1, 'label'], 'three');
    expect(result).toContain('- label: one');
    expect(result).toContain('- label: three');
    expect(result).toContain('# keep this comment');
  });

  it('creates a missing key', () => {
    const result = setYamlPath(RAW, ['body'], 'New body');
    expect(result).toContain('body: New body');
    expect(result).toContain('tone: note');
  });

  it('deletes a key, preserving the rest', () => {
    const result = deleteYamlPath(RAW, ['title']);
    expect(result).not.toContain('Quoted: title');
    expect(result).toContain('# keep this comment');
    expect(result).toContain('tone: note');
    expect(result).toContain('- label: two');
  });

  it('throws TypeError on an unparsable body', () => {
    expect(() => setYamlPath('tone: [oops', ['tone'], 'x')).toThrow(TypeError);
    expect(() => deleteYamlPath('tone: [oops', ['tone'])).toThrow(TypeError);
  });

  it('edited bodies drop back into a block cleanly', () => {
    const doc = fixtureDoc();
    const seg = doc.segments[2] as Segment & { raw: string };
    const newRaw = setYamlPath(seg.raw, ['title'], 'Retitled');
    const result = replaceBlockBody(FIXTURE, doc, 2, newRaw);
    const after = parseDocument(result, 'after');
    expect(after.segments.map((s) => s.kind)).toEqual(FIXTURE_KINDS);
    expect((after.segments[2] as Segment & { data: unknown }).data).toEqual({
      tone: 'note',
      title: 'Retitled',
    });
  });
});

describe('editing aliased fences', () => {
  const ALIASED = [
    'Intro prose.',
    '',
    '```infra',
    'systemLabel: prod',
    'nodes:',
    '  - { id: cf, layer: 0, kind: cdn, name: CF }',
    '```',
    '',
    'Closing prose.',
    '',
  ].join('\n');

  it('replaceBlockBody keeps the alias fence line byte-identical; reparse keeps sourceType', () => {
    const doc = parseDocument(ALIASED, 'aliased');
    const seg = doc.segments[1];
    if (seg === undefined || seg.kind === 'markdown') throw new Error('expected a block');
    expect(seg.kind).toBe('block');
    expect(seg.sourceType).toBe('infra');

    const newBody = 'systemLabel: prod-eu\nnodes:\n  - { id: cf, layer: 0, kind: cdn, name: CF }';
    const edited = replaceBlockBody(ALIASED, doc, 1, newBody);
    // The opening fence survives as written — the alias spelling is never
    // rewritten by an edit (studio round-trip stays faithful).
    expect(edited.split('\n')[2]).toBe('```infra');
    const reparsed = parseDocument(edited, 'aliased');
    const reSeg = reparsed.segments[1];
    if (reSeg === undefined || reSeg.kind === 'markdown') throw new Error('expected a block');
    expect(reSeg.kind).toBe('block');
    expect(reSeg.sourceType).toBe('infra');
    expect(reSeg.raw).toBe(newBody);
    expect((reSeg.data as { preset?: unknown }).preset).toBe('infra');
  });

  it('the no-op round-trip is byte-identical for an aliased fence', () => {
    const doc = parseDocument(ALIASED, 'aliased');
    const seg = doc.segments[1];
    if (seg === undefined || seg.kind === 'markdown') throw new Error('expected a block');
    expect(replaceBlockBody(ALIASED, doc, 1, seg.raw)).toBe(ALIASED);
  });

  it('segmentSpan covers the aliased fence lines', () => {
    const doc = parseDocument(ALIASED, 'aliased');
    const seg = doc.segments[1];
    if (seg === undefined) throw new Error('expected a segment');
    expect(segmentSpan(ALIASED, seg)).toEqual({ startLine: 3, endLine: 7 });
  });
});
