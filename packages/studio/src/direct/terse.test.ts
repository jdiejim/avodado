/**
 * The diff a MENU gesture leaves on disk.
 *
 * `terse-preservation.test.ts` in core proves the write path keeps terse lines
 * intact. This proves the studio's own ops go through that path: a delete and
 * a reorder from the context menu, committed exactly as `DirectLayer` commits
 * them, must leave every line they did not touch byte-identical.
 */

import { describe, expect, it } from 'vitest';
import { parseDocument, validateDocument, type Document } from '@avodado/core';
import { deletePathInSegment, setPathInSegment, setPathsInSegment } from './host.js';
import { flattenMenu, isRemoveOp, menuFor, targetFor, type MenuCtx, type Op } from './menu.js';

const SEQUENCE = [
  '```sequence',
  'actors:',
  '  - { id: App, name: App }',
  '  - { id: Auth, name: Auth }',
  'messages:',
  '  - App -> Auth: POST /token',
  '  - Auth --> App: 200 ok',
  '  - App -> Auth: retry',
  '```',
].join('\n');

const SAGA = [
  '```saga',
  'title: Place order',
  'steps:',
  '  - reserve: Reserve stock · inventory · release stock',
  '  - charge: Charge card · payments · refund card',
  '  - notify: Send confirmation · notifications',
  '```',
].join('\n');

interface Fixture {
  readonly source: string;
  readonly doc: Document;
  readonly idx: number;
  readonly data: unknown;
}

function fixture(fence: string): Fixture {
  const source = `# T\n\n${fence}\n`;
  const doc = parseDocument(source, 't');
  const idx = doc.segments.findIndex((s) => s.kind !== 'markdown');
  const seg = doc.segments[idx];
  if (seg === undefined || seg.kind === 'markdown') throw new Error('fixture segment missing');
  return { source, doc, idx, data: seg.data };
}

/** Commits homogeneous ops the way the canvas host does — one step. */
function apply(f: Fixture, ops: readonly Op[]): string {
  const first = ops[0] as Op;
  if (ops.length === 1 && isRemoveOp(first)) {
    return deletePathInSegment(f.source, f.doc, f.idx, first.path);
  }
  return setPathsInSegment(f.source, f.doc, f.idx, ops.map((o) => ({ path: o.path, value: o.value })));
}

function errorsOf(source: string): string[] {
  return validateDocument(parseDocument(source, 't'), 't.md')
    .filter((d) => d.level === 'error')
    .map((d) => `${d.code}: ${d.message}`);
}

function ctxFor(kind: string, f: Fixture): MenuCtx {
  return { kind, data: f.data, placements: null, grid: null, quick: false, selected: null };
}

/** The item the menu's `label` names, for a right-click on `path`. */
function opsFor(kind: string, f: Fixture, path: string, label: string): Op[] {
  const items = flattenMenu(menuFor(targetFor(kind, path), ctxFor(kind, f)));
  const item = items.find((i) => i.label === label);
  if (item?.op === undefined) throw new Error(`no "${label}" item (${items.map((i) => i.label).join(', ')})`);
  return item.op();
}

describe('menu ops keep terse lines byte-identical', () => {
  it('sequence: Delete removes ONE message line and nothing else', () => {
    const f = fixture(SEQUENCE);
    const ops = opsFor('sequence', f, 'messages.1', 'Delete');
    expect(ops).toEqual([{ path: ['messages', 1], remove: true }]);
    const out = apply(f, ops);
    expect(errorsOf(out)).toEqual([]);
    expect(out).toContain('  - App -> Auth: POST /token\n  - App -> Auth: retry\n');
    expect(out).not.toContain('from:');
  });

  it('sequence: the whole-list wrap keeps the wrapped lines as written', () => {
    const f = fixture(SEQUENCE);
    const ops = opsFor('sequence', f, 'messages.0', 'alt');
    const out = apply(f, ops);
    expect(errorsOf(out)).toEqual([]);
    expect(out).toContain('  - App -> Auth: POST /token\n');
    expect(out).toContain('  - Auth --> App: 200 ok\n');
    expect(out).toContain('  - App -> Auth: retry\n');
    expect(out).not.toContain('from:');
  });

  it('saga: Move right reorders the list without reserialising the steps', () => {
    const f = fixture(SAGA);
    const ops = opsFor('saga', f, 'steps.0', 'Move right');
    const out = apply(f, ops);
    expect(errorsOf(out)).toEqual([]);
    expect(out).toContain(
      [
        '  - charge: Charge card · payments · refund card',
        '  - reserve: Reserve stock · inventory · release stock',
        '  - notify: Send confirmation · notifications',
      ].join('\n'),
    );
  });

  it('saga: Delete drops one step line and leaves the others alone', () => {
    const f = fixture(SAGA);
    const ops = opsFor('saga', f, 'steps.1', 'Delete');
    const out = apply(f, ops);
    expect(errorsOf(out)).toEqual([]);
    expect(out).toContain(
      [
        '  - reserve: Reserve stock · inventory · release stock',
        '  - notify: Send confirmation · notifications',
      ].join('\n'),
    );
    expect(out).not.toContain('service:');
  });

  it('sequence: renaming a message label keeps it ONE terse line', () => {
    const f = fixture(SEQUENCE);
    // What the micro-editor commits: the item must expand for the deep path
    // to land, then folds back onto its line.
    const out = setPathInSegment(f.source, f.doc, f.idx, ['messages', 1, 'label'], '201 created');
    expect(errorsOf(out)).toEqual([]);
    expect(out).toContain('  - App -> Auth: POST /token\n  - Auth --> App: 201 created\n  - App -> Auth: retry\n');
  });

  it('sequence: a field the arrow cannot say keeps the expanded form', () => {
    const f = fixture(SEQUENCE);
    const out = setPathInSegment(f.source, f.doc, f.idx, ['messages', 1, 'summary'], 'the reply');
    expect(errorsOf(out)).toEqual([]);
    // Only the edited message expands; the other two keep their exact lines.
    expect(out).toContain('  - App -> Auth: POST /token\n');
    expect(out).toContain('  - App -> Auth: retry\n');
    expect(out).toContain('summary: the reply');
  });

  it('saga: clearing the failure point rewrites the body but not the steps', () => {
    const f = fixture(['```saga', 'title: Place order', 'failAt: charge', 'steps:',
      '  - reserve: Reserve stock · inventory · release stock',
      '  - charge: Charge card · payments · refund card',
      '  - notify: Send confirmation · notifications',
      '```'].join('\n'));
    // Deleting the step `failAt` names must drop the key too — one whole-body
    // set, which is exactly where the terse-aware write has to hold.
    const ops = opsFor('saga', f, 'steps.1', 'Delete');
    const out = apply(f, ops);
    expect(errorsOf(out)).toEqual([]);
    expect(out).not.toContain('failAt');
    expect(out).toContain('  - reserve: Reserve stock · inventory · release stock');
    expect(out).toContain('  - notify: Send confirmation · notifications');
  });
});
