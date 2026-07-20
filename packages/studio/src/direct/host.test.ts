/**
 * Commit routing for direct edits: the pure segment-body editors, and the
 * canvas-vs-sheet split — canvas commits are one applyOp/undo step against
 * the document source; sheet commits only touch a draft string.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { deleteYamlPath, parseDocument, setYamlPath } from '@avodado/core';
import { useStudio } from '../state/store.js';
import { canvasHost, deletePathInSegment, setPathInSegment, setPathsInSegment } from './host.js';

const DOC =
  '```meta\ntitle: T\n```\n\nProse.\n\n' +
  '```timeline\nitems:\n  - { label: Kickoff, status: done }\n  - { label: Launch }\n```\n';

function doc(source: string): ReturnType<typeof parseDocument> {
  return parseDocument(source, 'guide');
}

describe('pure segment-body editors', () => {
  it('setPathInSegment rewrites one value inside the block body', () => {
    const next = setPathInSegment(DOC, doc(DOC), 2, ['items', 1, 'label'], 'Ship');
    expect(next).toContain('label: Ship');
    expect(next).toContain('label: Kickoff'); // untouched sibling
    expect(next).toContain('Prose.'); // untouched prose
  });

  it('setPathInSegment appends when the index equals the array length', () => {
    const next = setPathInSegment(DOC, doc(DOC), 2, ['items', 2], { label: 'GA' });
    const d = doc(next);
    const seg = d.segments[2];
    if (seg === undefined || seg.kind === 'markdown') throw new Error('expected block');
    expect((seg.data as { items: unknown[] }).items).toHaveLength(3);
  });

  it('deletePathInSegment removes one item', () => {
    const next = deletePathInSegment(DOC, doc(DOC), 2, ['items', 0]);
    expect(next).not.toContain('Kickoff');
    expect(next).toContain('Launch');
  });

  it('throws on prose segments', () => {
    expect(() => setPathInSegment(DOC, doc(DOC), 1, ['x'], 1)).toThrow(TypeError);
  });

  it('annotating a TERSE sequence message materializes it and lands the summary', () => {
    // The message is arrow-sugar in the raw YAML — a scalar item. Setting
    // messages.1.summary must expand it to the object form first.
    const src =
      '```sequence\nactors:\n  - { id: a, name: A }\n  - { id: b, name: B }\nmessages:\n  - a -> b: request\n  - b --> a: response\n```\n';
    const next = setPathInSegment(src, doc(src), 0, ['messages', 1, 'summary'], 'The reply is cached.');
    const d = doc(next);
    const seg = d.segments[0];
    if (seg === undefined || seg.kind === 'markdown') throw new Error('expected block');
    const msgs = (seg.data as { messages: Array<Record<string, unknown>> }).messages;
    expect(msgs[1]).toMatchObject({ from: 'b', to: 'a', kind: 'response', summary: 'The reply is cached.' });
    // The untouched terse sibling keeps its one-line spelling in the source.
    expect(next).toContain('a -> b: request');
  });

  it('structured edits on a BARE-TEXT callout canonicalize instead of throwing', () => {
    // The body is plain prose (core's text-body sugar) — no YAML fields at all.
    const src = '```callout\nHeads up: the rate limit is 100 req/min.\n```\n';
    const next = setPathInSegment(src, doc(src), 0, ['tone'], 'warn');
    const d = doc(next);
    const seg = d.segments[0];
    if (seg === undefined || seg.kind === 'markdown') throw new Error('expected block');
    // The edit landed AND the original text survived as the body field.
    expect(seg.data).toMatchObject({
      tone: 'warn',
      body: 'Heads up: the rate limit is 100 req/min.',
    });
  });

  it('setPathsInSegment composes several writes into ONE body replacement', () => {
    const next = setPathsInSegment(DOC, doc(DOC), 2, [
      { path: ['items', 0, 'label'], value: 'Start' },
      { path: ['items', 1, 'label'], value: 'Ship' },
    ]);
    expect(next).toContain('label: Start');
    expect(next).toContain('label: Ship');
    expect(next).not.toContain('Kickoff');
  });

  it('setPathsInSegment preserves comments OUTSIDE the rewritten paths', () => {
    const src =
      '```table\n# widths tuned by hand\ncolumns: [A, B]\nrows:\n  - [a1, b1]\n  - [a2, b2]\n```\n';
    const next = setPathsInSegment(src, doc(src), 0, [
      { path: ['columns'], value: ['B', 'A'] },
      { path: ['rows', 0], value: ['b1', 'a1'] },
      { path: ['rows', 1], value: ['b2', 'a2'] },
    ]);
    expect(next).toContain('# widths tuned by hand');
    const d = doc(next);
    const seg = d.segments[0];
    if (seg === undefined || seg.kind === 'markdown') throw new Error('expected block');
    expect((seg.data as { columns: unknown[] }).columns).toEqual(['B', 'A']);
    expect((seg.data as { rows: unknown[][] }).rows).toEqual([
      ['b1', 'a1'],
      ['b2', 'a2'],
    ]);
  });

  it('setPathsInSegment throws on prose segments', () => {
    expect(() => setPathsInSegment(DOC, doc(DOC), 1, [{ path: ['x'], value: 1 }])).toThrow(
      TypeError,
    );
  });
});

describe('canvas host routing', () => {
  beforeEach(() => {
    useStudio.setState({
      currentSlug: 'guide',
      source: DOC,
      baseHash: 'h1',
      dirty: false,
      autosave: false,
      selection: null,
      undoStack: [],
      redoStack: [],
      toasts: [],
      sheet: null,
      sheetDirty: false,
      loaded: true,
    });
  });

  it('commitPath lands in the document source as ONE undo step and selects the block', () => {
    const host = canvasHost(2, 'timeline');
    host.commitPath(['items', 0, 'label'], 'Kickoff v2');
    const s = useStudio.getState();
    expect(s.source).toContain('Kickoff v2');
    expect(s.dirty).toBe(true);
    expect(s.undoStack).toEqual([DOC]); // exactly one snapshot
    expect(s.selection).toBe(2);
    s.undo();
    expect(useStudio.getState().source).toBe(DOC);
  });

  it('deletePath removes the item from the source', () => {
    canvasHost(2, 'timeline').deletePath(['items', 1]);
    expect(useStudio.getState().source).not.toContain('Launch');
  });

  it('commitPaths lands a COMPOUND move as ONE undo step', () => {
    const host = canvasHost(2, 'timeline');
    host.commitPaths([
      { path: ['items', 0, 'label'], value: 'One' },
      { path: ['items', 1, 'label'], value: 'Two' },
    ]);
    const s = useStudio.getState();
    expect(s.source).toContain('label: One');
    expect(s.source).toContain('label: Two');
    expect(s.undoStack).toEqual([DOC]); // both writes, one snapshot
    s.undo();
    expect(useStudio.getState().source).toBe(DOC);
  });

  it('notify routes to a toast', () => {
    canvasHost(2, 'timeline').notify?.('Auto-layout pinned');
    expect(useStudio.getState().toasts.some((t) => t.message === 'Auto-layout pinned')).toBe(true);
  });

  it('openFull opens the Edit Sheet on the block', () => {
    canvasHost(2, 'timeline').openFull();
    expect(useStudio.getState().sheet).toBe(2);
  });
});

describe('sheet host routing (draft-only)', () => {
  it('a sheet-style commit edits the draft, never the document source', () => {
    // The sheet host is a closure over the sheet's draft ops — model it the
    // way EditSheet builds it, and verify the split.
    let draft = 'items:\n  - { label: Kickoff, status: done }';
    const sheetHost = {
      kind: 'timeline' as const,
      commitPath: (path: ReadonlyArray<string | number>, value: unknown) => {
        draft = setYamlPath(draft, path, value);
      },
      deletePath: (path: ReadonlyArray<string | number>) => {
        draft = deleteYamlPath(draft, path);
      },
      openFull: () => undefined,
    };
    const before = useStudio.getState().source;
    sheetHost.commitPath(['items', 0, 'label'], 'Drafted');
    expect(draft).toContain('Drafted');
    expect(useStudio.getState().source).toBe(before); // document untouched
    sheetHost.deletePath(['items', 0]);
    expect(draft).not.toContain('Drafted');
  });
});
