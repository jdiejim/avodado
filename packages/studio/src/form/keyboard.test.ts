/**
 * Keyboard-first rules: tab-order builder (skip rules), enter-per-row
 * decisions, pristine-row detection, combobox filtering, contextual hints.
 */

import { describe, expect, it } from 'vitest';
import { describeBlockSchema } from '@avodado/core';
import {
  filterComboOptions,
  isPristineRow,
  nextPrimaryField,
  rowEnterAction,
  shortcutsFor,
  tabOrderPaths,
} from './keyboard.js';

function objectRoot(kind: 'sequence' | 'block' | 'meta') {
  const root = describeBlockSchema(kind);
  if (root.kind !== 'object') throw new Error('expected object root');
  return root;
}

describe('tabOrderPaths', () => {
  const seqData = {
    actors: [
      { id: 'client', name: 'Client' },
      { id: 'server', name: 'Server' },
    ],
    messages: [{ from: 'client', to: 'server', label: 'request' }],
  };

  it('walks primary scalars then each array item’s primary scalars, in order', () => {
    expect(tabOrderPaths(objectRoot('sequence'), seqData)).toEqual([
      'title',
      'description',
      'actors.0.name',
      'actors.1.name',
      'messages.0.from',
      'messages.0.to',
      'messages.0.label',
      'messages.0.summary',
    ]);
  });

  it('never includes id or collapsed (More/Advanced) fields', () => {
    const paths = tabOrderPaths(objectRoot('block'), {
      nodes: [{ id: 'api', name: 'API' }],
      edges: [],
    });
    expect(paths.some((p) => p.endsWith('.id'))).toBe(false);
    expect(paths.some((p) => p.includes('.col'))).toBe(false); // advanced when empty
    expect(paths).toContain('nodes.0.name');
  });

  it('empty arrays contribute no item paths', () => {
    const paths = tabOrderPaths(objectRoot('sequence'), {});
    expect(paths).toEqual(['title', 'description']);
  });
});

describe('nextPrimaryField', () => {
  const root = objectRoot('sequence');
  const data = { actors: [{ id: 'a', name: 'A' }], messages: [] };

  it('actors → messages → foot → null', () => {
    expect(nextPrimaryField(root, data, 'actors')?.name).toBe('messages');
    expect(nextPrimaryField(root, data, 'messages')?.name).toBe('foot');
    expect(nextPrimaryField(root, data, 'foot')).toBeNull();
  });

  it('unknown field → null', () => {
    expect(nextPrimaryField(root, data, 'nope')).toBeNull();
  });
});

describe('rowEnterAction', () => {
  it('pristine row always exits, regardless of position', () => {
    expect(rowEnterAction({ isLastField: true, pristine: true })).toBe('exit');
    expect(rowEnterAction({ isLastField: false, pristine: true })).toBe('exit');
  });

  it('filled row: last field appends, others advance', () => {
    expect(rowEnterAction({ isLastField: true, pristine: false })).toBe('append');
    expect(rowEnterAction({ isLastField: false, pristine: false })).toBe('advance');
  });
});

describe('isPristineRow', () => {
  it('deep-equals its seed → pristine (order-insensitive keys)', () => {
    expect(isPristineRow({ id: 'actor3', name: 'New actor' }, { name: 'New actor', id: 'actor3' })).toBe(true);
    expect(isPristineRow({ from: 'a', to: 'b' }, { from: 'a', to: 'b' })).toBe(true);
  });

  it('all-empty rows are pristine even when they diverged from the seed', () => {
    expect(isPristineRow({ id: '', name: '' }, { id: 'actor3', name: 'New actor' })).toBe(true);
    expect(isPristineRow({}, { id: 'x' })).toBe(true);
  });

  it('any typed value makes the row real', () => {
    expect(isPristineRow({ id: 'actor3', name: 'Postgres' }, { id: 'actor3', name: 'New actor' })).toBe(false);
    expect(isPristineRow({ n: 2 }, { n: 1 })).toBe(false);
    expect(isPristineRow({ done: true }, {})).toBe(false);
  });
});

describe('filterComboOptions', () => {
  const opts = [
    { value: 'web', label: 'Web App' },
    { value: 'api', label: 'API Gateway' },
    { value: 'db', label: 'Postgres' },
  ];

  it('empty query or query == committed value shows everything', () => {
    expect(filterComboOptions(opts, '', '')).toEqual(opts);
    expect(filterComboOptions(opts, 'web', 'web')).toEqual(opts);
    expect(filterComboOptions(opts, ' Web ', 'web')).toEqual(opts);
  });

  it('substring-matches value and label, case-insensitively', () => {
    expect(filterComboOptions(opts, 'app', '').map((o) => o.value)).toEqual(['web']); // label hit
    expect(filterComboOptions(opts, 'gate', '').map((o) => o.value)).toEqual(['api']);
    expect(filterComboOptions(opts, 'POST', '').map((o) => o.value)).toEqual(['db']);
    expect(filterComboOptions(opts, 'zzz', '')).toEqual([]);
  });
});

describe('shortcutsFor', () => {
  it('each context gets 4-5 hints, tuned to its verbs', () => {
    for (const ctx of ['canvas', 'canvas-selected', 'sheet'] as const) {
      const hints = shortcutsFor(ctx);
      expect(hints.length).toBeGreaterThanOrEqual(4);
      expect(hints.length).toBeLessThanOrEqual(5);
    }
    expect(shortcutsFor('sheet').some((h) => h.keys === '⌘⏎')).toBe(true);
    expect(shortcutsFor('canvas-selected').some((h) => h.keys === '⌘D')).toBe(true);
  });

  it("the 'part' context leads with move/edit and offers the way back", () => {
    const part = shortcutsFor('part');
    expect(part.some((h) => h.keys === '←↑↓→' && h.label === 'move')).toBe(true);
    expect(part.some((h) => h.keys === '⏎')).toBe(true);
    expect(part.some((h) => h.keys === 'esc')).toBe(true);
  });

  it('canvas-selected gains a "drag → move parts" hint when the block supports it', () => {
    const withDrag = shortcutsFor('canvas-selected', { dragParts: true });
    expect(withDrag.some((h) => h.keys === 'drag')).toBe(true);
    expect(withDrag[1]).toEqual({ keys: 'drag', label: 'move parts' }); // right after Edit
    // Everything else keeps the hint out.
    expect(shortcutsFor('canvas-selected').some((h) => h.keys === 'drag')).toBe(false);
    expect(shortcutsFor('canvas-selected', { dragParts: false }).some((h) => h.keys === 'drag')).toBe(false);
    expect(shortcutsFor('canvas', { dragParts: true }).some((h) => h.keys === 'drag')).toBe(false);
  });

  it('part gains a "drag a dot → connect" hint when the selected node connects', () => {
    const withDots = shortcutsFor('part', { connectDots: true });
    expect(withDots[2]).toEqual({ keys: 'drag a dot', label: 'connect' }); // right after Move
    // Everything else keeps the hint out.
    expect(shortcutsFor('part').some((h) => h.keys === 'drag a dot')).toBe(false);
    expect(shortcutsFor('part', { connectDots: false }).some((h) => h.keys === 'drag a dot')).toBe(false);
    expect(shortcutsFor('canvas-selected', { connectDots: true }).some((h) => h.keys === 'drag a dot')).toBe(false);
  });
});
