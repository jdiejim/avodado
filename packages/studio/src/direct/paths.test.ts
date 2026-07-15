/**
 * Direct-edit path rules: path parsing, schema resolution (incl. array
 * descent + opaque), value coercion, singularization for add-chips, human
 * labels, and default-item building.
 */

import { describe, expect, it } from 'vitest';
import { describeBlockSchema } from '@avodado/core';
import {
  coerceValue,
  defaultItemFor,
  humanizePath,
  isItemPath,
  joinBlockPath,
  newItemForList,
  parseBlockPath,
  resolveFieldAt,
  singularize,
  valueAt,
} from './paths.js';

describe('parseBlockPath / joinBlockPath', () => {
  it('parses dot paths with numeric segments as indices', () => {
    expect(parseBlockPath('messages.2.text')).toEqual(['messages', 2, 'text']);
    expect(parseBlockPath('rows.1.2')).toEqual(['rows', 1, 2]);
    expect(parseBlockPath('title')).toEqual(['title']);
    expect(parseBlockPath('')).toEqual([]);
  });

  it('round-trips', () => {
    expect(joinBlockPath(parseBlockPath('entities.0.columns.3'))).toBe('entities.0.columns.3');
  });

  it('isItemPath — true only when the last segment is an index', () => {
    expect(isItemPath(parseBlockPath('actors.0'))).toBe(true);
    expect(isItemPath(parseBlockPath('rows.1.2'))).toBe(true);
    expect(isItemPath(parseBlockPath('actors.0.name'))).toBe(false);
    expect(isItemPath(parseBlockPath('title'))).toBe(false);
  });
});

describe('singularize', () => {
  it('handles regular plurals', () => {
    expect(singularize('actors')).toBe('actor');
    expect(singularize('series')).toBe('series'); // invariant plural (chart)
    expect(singularize('messages')).toBe('message');
    expect(singularize('rows')).toBe('row');
  });
  it('handles -ies (the v2 "boundarie" fix)', () => {
    expect(singularize('boundaries')).toBe('boundary');
    expect(singularize('entities')).toBe('entity');
  });
  it('handles -es sibilants and leaves non-plurals alone', () => {
    expect(singularize('statuses')).toBe('status');
    expect(singularize('boxes')).toBe('box');
    expect(singularize('foot')).toBe('foot');
    expect(singularize('progress')).toBe('progress');
  });
});

describe('resolveFieldAt', () => {
  const seq = describeBlockSchema('sequence');
  const table = describeBlockSchema('table');

  it('descends objects and arrays (numeric segment → element node)', () => {
    const actor = resolveFieldAt(seq, ['actors', 0]);
    expect(actor?.kind).toBe('object');
    const name = resolveFieldAt(seq, ['actors', 1, 'name']);
    expect(name?.kind).toBe('string');
    const kind = resolveFieldAt(seq, ['messages', 2, 'kind']);
    expect(kind?.kind).toBe('enum');
  });

  it('lands on union nodes (table cells) and descends their object arm', () => {
    const cell = resolveFieldAt(table, ['rows', 1, 2]);
    expect(cell?.kind).toBe('union');
    const row = resolveFieldAt(table, ['rows', 0]);
    expect(row?.kind).toBe('array');
    // Descending INTO a union resolves through its detailed (object) arm.
    const tone = resolveFieldAt(table, ['rows', 0, 0, 'tone']);
    expect(tone?.kind).toBe('enum');
  });

  it('returns null for unknown fields and impossible descents', () => {
    expect(resolveFieldAt(seq, ['nope'])).toBeNull();
    expect(resolveFieldAt(seq, ['title', 0])).toBeNull(); // index into a scalar
    expect(resolveFieldAt(seq, ['actors', 'x'])).toBeNull(); // key into an array
    expect(resolveFieldAt(table, ['rows', 0, 0, 'deep'])).toBeNull(); // not in the cell arm
  });
});

describe('valueAt', () => {
  const data = { actors: [{ id: 'a', name: 'A' }], rows: [['x', 1]] };
  it('reads nested values and tolerates missing paths', () => {
    expect(valueAt(data, ['actors', 0, 'name'])).toBe('A');
    expect(valueAt(data, ['rows', 0, 1])).toBe(1);
    expect(valueAt(data, ['actors', 3, 'name'])).toBeUndefined();
    expect(valueAt(data, ['missing'])).toBeUndefined();
  });
});

describe('humanizePath', () => {
  it('labels items, fields, and nested cells', () => {
    expect(humanizePath(parseBlockPath('actors.0'))).toBe('Actor 1');
    expect(humanizePath(parseBlockPath('messages.2.summary'))).toBe('Message 3 · Summary');
    expect(humanizePath(parseBlockPath('rows.1.2'))).toBe('Row 2 · Item 3');
    expect(humanizePath(parseBlockPath('title'))).toBe('Title');
    expect(humanizePath(parseBlockPath('entities.0.columns.3'))).toBe('Entity 1 · Column 4');
    expect(humanizePath(parseBlockPath('soThat'))).toBe('So that');
  });
});

describe('defaultItemFor', () => {
  it('builds a seeded object for object elements', () => {
    const seq = describeBlockSchema('sequence');
    const actors = resolveFieldAt(seq, ['actors']);
    if (actors?.kind !== 'array') throw new Error('expected array');
    const item = defaultItemFor(actors.element) as Record<string, unknown>;
    expect(item).toEqual({ id: '', name: '' }); // required fields only
  });

  it('builds zero values for scalar elements', () => {
    const story = describeBlockSchema('userstory');
    const tags = resolveFieldAt(story, ['tags']);
    if (tags?.kind !== 'array') throw new Error('expected array');
    expect(defaultItemFor(tags.element)).toBe('');
  });
});

describe('newItemForList (the "+ Add" builder)', () => {
  const seq = describeBlockSchema('sequence');
  const flow = describeBlockSchema('flow');
  const table = describeBlockSchema('table');

  function elementOf(root: Parameters<typeof resolveFieldAt>[0], path: string): Parameters<typeof newItemForList>[0] {
    const n = resolveFieldAt(root, parseBlockPath(path));
    if (n?.kind !== 'array') throw new Error('expected array');
    return n.element;
  }

  it('a new sequence message copies from/to off the last sibling (visible arrow)', () => {
    const siblings = [
      { from: 'client', to: 'api', label: 'POST /orders' },
      { from: 'api', to: 'client', label: '201', kind: 'response' },
    ];
    const item = newItemForList(elementOf(seq, 'messages'), siblings, 'message');
    expect(item).toEqual({ from: 'api', to: 'client' });
  });

  it('a new actor gets a fresh unique id and a visible name', () => {
    const siblings = [{ id: 'actor2', name: 'A' }, { id: 'b', name: 'B' }];
    const item = newItemForList(elementOf(seq, 'actors'), siblings, 'actor') as Record<string, unknown>;
    expect(item.name).toBe('New actor');
    expect(item.id).toBe('actor3'); // len+1 free
    const clash = newItemForList(elementOf(seq, 'actors'), [{ id: 'actor2' }], 'actor') as Record<string, unknown>;
    expect(clash.id).not.toBe('actor2');
  });

  it('a new flow node fills id + label; enum kinds keep their default', () => {
    const item = newItemForList(elementOf(flow, 'nodes'), [], 'node') as Record<string, unknown>;
    expect(item.id).toBe('node1');
    expect(item.label).toBe('New node');
  });

  it('a new table row mirrors the last row width with empty cells', () => {
    const el = elementOf(table, 'rows');
    expect(newItemForList(el, [['a', 'b', 'c']], 'row')).toEqual(['', '', '']);
    expect(newItemForList(el, [], 'row')).toEqual(['']);
  });

  it('scalar elements become a visible placeholder', () => {
    const story = describeBlockSchema('userstory');
    expect(newItemForList(elementOf(story, 'tags'), [], 'tag')).toBe('New tag');
  });
});

describe('coerceValue', () => {
  const num = { kind: 'number', optional: false } as const;
  const bool = { kind: 'boolean', optional: false } as const;
  const str = { kind: 'string', optional: false } as const;

  it('schema number: parses or rejects', () => {
    expect(coerceValue('42', undefined, num)).toEqual({ ok: true, value: 42 });
    expect(coerceValue('4.5', 1, num)).toEqual({ ok: true, value: 4.5 });
    expect(coerceValue('abc', 1, num)).toEqual({ ok: false });
    expect(coerceValue('', 1, num)).toEqual({ ok: false });
  });

  it('schema boolean: only true/false literals', () => {
    expect(coerceValue('true', false, bool)).toEqual({ ok: true, value: true });
    expect(coerceValue('yep', false, bool)).toEqual({ ok: false });
  });

  it('schema string stays a string even if numeric-looking', () => {
    expect(coerceValue('42', 'x', str)).toEqual({ ok: true, value: '42' });
  });

  it('no schema (opaque): the current value type wins', () => {
    expect(coerceValue('42', 7, null)).toEqual({ ok: true, value: 42 });
    expect(coerceValue('hi', 7, null)).toEqual({ ok: true, value: 'hi' }); // fall back
    expect(coerceValue('true', false, null)).toEqual({ ok: true, value: true });
    expect(coerceValue('42', 'seven', null)).toEqual({ ok: true, value: '42' });
  });
});
