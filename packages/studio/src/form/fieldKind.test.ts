/**
 * The field-intelligence matrix: control resolution (color / kind / relational
 * dropdowns), the essential-first partition, and the micro-editor field pick.
 */

import { describe, expect, it } from 'vitest';
import { describeBlockSchema, type FieldNode } from '@avodado/core';
import { KNOWN_LOGIC_KINDS, KNOWN_NODE_KINDS } from '@avodado/render';
import {
  microVisibleFields,
  ownerArrayName,
  partitionFields,
  refOptionsFor,
  resolveControl,
} from './fieldKind.js';

const STR: FieldNode = { kind: 'string', optional: false };
const OPT_STR: FieldNode = { kind: 'string', optional: true };

function fieldOf(root: FieldNode, ...names: string[]): FieldNode {
  let cur = root;
  for (const name of names) {
    if (cur.kind === 'array') cur = cur.element;
    if (cur.kind !== 'object') throw new Error(`not an object at ${name}`);
    const f = cur.fields.find((x) => x.name === name);
    if (f === undefined) throw new Error(`no field ${name}`);
    cur = f.node;
  }
  // A trailing array field resolves to its ELEMENT (the item shape).
  return cur.kind === 'array' ? cur.element : cur;
}

describe('resolveControl — color fields', () => {
  it.each(['color', 'fill', 'stroke', 'accent', 'Color', 'STROKE'])(
    'string field named %s → color control',
    (name) => {
      const c = resolveControl({ blockKind: 'block', name, node: STR, value: undefined, data: {}, path: [name] });
      expect(c.kind).toBe('color');
    },
  );

  it('any string field currently holding a hex value → color control', () => {
    for (const hex of ['#0e54a1', '#FFF', '#0f766e88']) {
      const c = resolveControl({ blockKind: 'timeline', name: 'tint', node: OPT_STR, value: hex, data: {}, path: ['tint'] });
      expect(c.kind).toBe('color');
    }
  });

  it('a non-hex string named something else stays text', () => {
    const c = resolveControl({ blockKind: 'block', name: 'tech', node: OPT_STR, value: 'Go', data: {}, path: ['tech'] });
    expect(c).toEqual({ kind: 'text', multiline: false });
  });

  it('a SUPERSET of the accent enum (statustable status colors) still renders as swatches', () => {
    const node = fieldOf(describeBlockSchema('statustable'), 'statuses', 'color');
    expect(node.kind).toBe('enum');
    const c = resolveControl({
      blockKind: 'statustable',
      name: 'color',
      node,
      value: 'success',
      data: {},
      path: ['statuses', 0, 'color'],
    });
    expect(c.kind).toBe('accent');
    if (c.kind !== 'accent') return;
    expect(c.options).toContain('success');
    expect(c.options).toContain('purple');
  });

  it('the accent ENUM (callout family) renders as accent swatches, not color', () => {
    const node: FieldNode = {
      kind: 'enum',
      optional: true,
      options: ['navy', 'blue', 'teal', 'green', 'amber', 'purple', 'red', 'gray'],
    };
    const c = resolveControl({ blockKind: 'drivers', name: 'accent', node, value: 'teal', data: {}, path: ['items', 0, 'accent'] });
    expect(c.kind).toBe('accent');
  });
});

describe('resolveControl — kind dropdowns', () => {
  const kindNode = fieldOf(describeBlockSchema('block'), 'nodes', 'kind');

  it('block node kind → dropdown of KNOWN_NODE_KINDS (canonical kind covers every preset)', () => {
    const c = resolveControl({ blockKind: 'block', name: 'kind', node: kindNode, value: 'service', data: {}, path: ['nodes', 0, 'kind'] });
    expect(c.kind).toBe('options');
    if (c.kind === 'options') {
      expect(c.options.map((o) => o.value)).toEqual([...KNOWN_NODE_KINDS]);
    }
  });

  it('cluster service kind → KNOWN_NODE_KINDS; felogic → KNOWN_LOGIC_KINDS', () => {
    const cluster = resolveControl({ blockKind: 'cluster', name: 'kind', node: OPT_STR, value: undefined, data: {}, path: ['services', 0, 'kind'] });
    expect(cluster.kind).toBe('options');
    const fe = resolveControl({ blockKind: 'felogic', name: 'kind', node: OPT_STR, value: 'repo', data: {}, path: ['nodes', 1, 'kind'] });
    expect(fe.kind).toBe('options');
    if (fe.kind === 'options') expect(fe.options.map((o) => o.value)).toEqual([...KNOWN_LOGIC_KINDS]);
  });

  it('enum kinds (sequence message, c4 node) stay enums untouched', () => {
    const seqKind = fieldOf(describeBlockSchema('sequence'), 'messages', 'kind');
    const c = resolveControl({ blockKind: 'sequence', name: 'kind', node: seqKind, value: 'sync', data: {}, path: ['messages', 0, 'kind'] });
    expect(c.kind).toBe('enum');
    if (c.kind === 'enum') expect(c.options).toContain('async');
  });

  it('a kind field on a non-graph block stays free text', () => {
    const c = resolveControl({ blockKind: 'prose', name: 'kind', node: OPT_STR, value: undefined, data: {}, path: ['kind'] });
    expect(c.kind).toBe('text');
  });
});

describe('resolveControl — relational dropdowns', () => {
  const seqData = {
    actors: [
      { id: 'web', name: 'Web App' },
      { id: 'api', name: 'API' },
    ],
    messages: [{ from: 'web', to: 'api' }],
  };

  it('sequence message from/to → dropdown of actor ids with names as labels', () => {
    const node = fieldOf(describeBlockSchema('sequence'), 'messages', 'from');
    const c = resolveControl({ blockKind: 'sequence', name: 'from', node, value: 'web', data: seqData, path: ['messages', 0, 'from'] });
    expect(c).toEqual({
      kind: 'options',
      options: [
        { value: 'web', label: 'Web App' },
        { value: 'api', label: 'API' },
      ],
    });
  });

  it('flow edge from/to → node ids (labels from label field)', () => {
    const data = {
      nodes: [
        { id: 'a', label: 'Start' },
        { id: 'b', label: 'End' },
      ],
      edges: [{ from: 'a', to: 'b' }],
    };
    const c = resolveControl({ blockKind: 'flow', name: 'to', node: STR, value: 'b', data, path: ['edges', 0, 'to'] });
    expect(c.kind).toBe('options');
    if (c.kind === 'options') {
      expect(c.options).toEqual([
        { value: 'a', label: 'Start' },
        { value: 'b', label: 'End' },
      ]);
    }
  });

  it('cluster edges see clusters AND services; the edges array never offers itself', () => {
    const data = {
      clusters: [{ id: 'k8s', label: 'Cluster' }],
      services: [
        { id: 'web', cluster: 'k8s', label: 'Web' },
        { id: 'db', cluster: 'k8s', label: 'DB' },
      ],
      edges: [{ from: 'web', to: 'db' }],
    };
    const c = resolveControl({ blockKind: 'cluster', name: 'from', node: STR, value: 'web', data, path: ['edges', 0, 'from'] });
    expect(c.kind).toBe('options');
    if (c.kind === 'options') {
      expect(c.options.map((o) => o.value)).toEqual(['k8s', 'web', 'db']);
    }
  });

  it('erd relations reference entities by NAME (no id field)', () => {
    const data = {
      entities: [{ name: 'users', columns: [] }, { name: 'orders' }],
      relations: [{ from: 'users', to: 'orders' }],
    };
    const c = resolveControl({ blockKind: 'erd', name: 'from', node: STR, value: 'users', data, path: ['relations', 0, 'from'] });
    expect(c.kind).toBe('options');
    if (c.kind === 'options') expect(c.options.map((o) => o.value)).toEqual(['users', 'orders']);
  });

  it('arrays of plain strings act as id lists', () => {
    const data = { actors: ['web', 'api'], messages: [{ from: 'web', to: 'api' }] };
    const opts = refOptionsFor('from', data, ['messages', 0, 'from']);
    expect(opts).toEqual([{ value: 'web' }, { value: 'api' }]);
  });

  it('cluster field on a service → dropdown of clusters only', () => {
    const data = {
      clusters: [{ id: 'east', label: 'East' }],
      services: [{ id: 'web', cluster: 'east', label: 'Web' }],
    };
    const opts = refOptionsFor('cluster', data, ['services', 0, 'cluster']);
    expect(opts).toEqual([{ value: 'east', label: 'East' }]);
  });

  it('parent points into the item\'s OWN array (tree blocks)', () => {
    const data = {
      nodes: [
        { id: 'root', name: 'App' },
        { id: 'child', name: 'Sidebar', parent: 'root' },
      ],
    };
    const opts = refOptionsFor('parent', data, ['nodes', 1, 'parent']);
    expect(opts?.map((o) => o.value)).toEqual(['root', 'child']);
  });

  it('no id-bearing siblings → null (free text, never an empty dropdown)', () => {
    expect(refOptionsFor('from', { messages: [{ from: 'x', to: 'y' }] }, ['messages', 0, 'from'])).toBeNull();
    expect(refOptionsFor('from', {}, ['messages', 0, 'from'])).toBeNull();
    expect(refOptionsFor('label', seqData, ['messages', 0, 'label'])).toBeNull();
  });

  it('half-filled items are skipped, table-style nested arrays disqualify', () => {
    const data = {
      actors: [{ id: 'web', name: 'Web' }, { id: '', name: 'New' }],
      rows: [['a', 'b']],
      messages: [{ from: 'web', to: 'web' }],
    };
    const opts = refOptionsFor('to', data, ['messages', 0, 'to']);
    expect(opts).toEqual([{ value: 'web', label: 'Web' }]);
  });

  it('status → dropdown of the sibling statuses vocabulary by LABEL (statustable)', () => {
    const data = {
      statuses: [
        { label: 'on track', color: 'green' },
        { label: 'at risk', color: 'amber' },
      ],
      rows: [{ cells: ['T', 'U'], status: 'on track' }],
    };
    const opts = refOptionsFor('status', data, ['rows', 0, 'status']);
    expect(opts?.map((o) => o.value)).toEqual(['on track', 'at risk']);
    const c = resolveControl({
      blockKind: 'statustable',
      name: 'status',
      node: STR,
      value: 'on track',
      data,
      path: ['rows', 0, 'status'],
    });
    expect(c.kind).toBe('options');
  });

  it('status dropdown applies at SUBTASK depth too; without a statuses array it stays free text', () => {
    const data = {
      statuses: [{ label: 'in review', color: 'purple' }],
      rows: [
        { cells: ['T'], status: 'in review', subtasks: [{ cells: ['S'], status: 'in review' }] },
      ],
    };
    const opts = refOptionsFor('status', data, ['rows', 0, 'subtasks', 0, 'status']);
    expect(opts?.map((o) => o.value)).toEqual(['in review']);
    // No sibling statuses array (defaults-only statustable, tracker, …) → free text.
    expect(
      refOptionsFor('status', { rows: [{ cells: ['T'], status: 'done' }] }, ['rows', 0, 'status']),
    ).toBeNull();
  });
});

describe('ownerArrayName', () => {
  it('finds the array the item lives in', () => {
    expect(ownerArrayName(['messages', 2, 'from'])).toBe('messages');
    expect(ownerArrayName(['messages', 2])).toBe('messages');
    expect(ownerArrayName(['title'])).toBeNull();
    expect(ownerArrayName([])).toBeNull();
  });
});

describe('partitionFields', () => {
  const message = fieldOf(describeBlockSchema('sequence'), 'messages');

  it('sequence message: required from/to primary; empty extras collapse', () => {
    if (message.kind !== 'object') throw new Error('expected object');
    const p = partitionFields(message.fields, { from: 'web', to: 'api' });
    expect(p.primary.map((f) => f.name)).toEqual(['from', 'to', 'label', 'summary']);
    expect(p.more.map((f) => f.name)).toEqual(['kind', 'code', 'note']);
    expect(p.advanced).toEqual([]);
  });

  it('optional fields that HAVE values surface in primary', () => {
    if (message.kind !== 'object') throw new Error('expected object');
    const p = partitionFields(message.fields, { from: 'a', to: 'b', kind: 'async', note: 'x' });
    expect(p.primary.map((f) => f.name)).toEqual(['from', 'to', 'label', 'kind', 'summary', 'note']);
    expect(p.more.map((f) => f.name)).toEqual(['code']);
  });

  it('id always lands in advanced; empty layout fields too', () => {
    const c4node = fieldOf(describeBlockSchema('c4'), 'nodes');
    if (c4node.kind !== 'object') throw new Error('expected object');
    const p = partitionFields(c4node.fields, { id: 'api', kind: 'system', name: 'API' });
    expect(p.advanced.map((f) => f.name)).toEqual(['id', 'col', 'row', 'w', 'family']);
    expect(p.primary.map((f) => f.name)).toEqual(['kind', 'name', 'desc']);
    expect(p.more.map((f) => f.name)).toEqual(['tech']);
  });

  it('valued layout fields stay primary (they are load-bearing)', () => {
    const node = fieldOf(describeBlockSchema('block'), 'nodes');
    if (node.kind !== 'object') throw new Error('expected object');
    const p = partitionFields(node.fields, { id: 'db', name: 'DB', col: 2, row: 1 });
    expect(p.primary.map((f) => f.name)).toContain('col');
    expect(p.primary.map((f) => f.name)).toContain('row');
    expect(p.advanced.map((f) => f.name)).toContain('id');
  });

  it('root partition keeps arrays primary even when empty', () => {
    const root = describeBlockSchema('sequence');
    if (root.kind !== 'object') throw new Error('expected object');
    const p = partitionFields(root.fields, {});
    expect(p.primary.map((f) => f.name)).toContain('actors');
    expect(p.primary.map((f) => f.name)).toContain('messages');
    expect(p.primary.map((f) => f.name)).toContain('title');
    // endpoint (empty optional object) and non-signature strings collapse.
    expect(p.more.map((f) => f.name)).toContain('endpoint');
  });

  it('at most 3 empty signature fields are pulled forward', () => {
    const fields = ['title', 'label', 'name', 'text', 'other'].map((name) => ({
      name,
      node: OPT_STR,
    }));
    const p = partitionFields(fields, {});
    expect(p.primary.map((f) => f.name)).toEqual(['title', 'label', 'name']);
    expect(p.more.map((f) => f.name)).toEqual(['text', 'other']);
  });
});

describe('microVisibleFields', () => {
  it('shows at most 4 scalar primary fields and counts the rest', () => {
    const message = fieldOf(describeBlockSchema('sequence'), 'messages');
    if (message.kind !== 'object') throw new Error('expected object');
    const { visible, hidden } = microVisibleFields(message.fields, { from: 'a', to: 'b' });
    expect(visible.map((f) => f.name)).toEqual(['from', 'to', 'label', 'summary']);
    expect(hidden).toBe(3); // kind, code, note
  });

  it('never shows id in the popover', () => {
    const node = fieldOf(describeBlockSchema('block'), 'nodes');
    if (node.kind !== 'object') throw new Error('expected object');
    const { visible } = microVisibleFields(node.fields, { id: 'db', name: 'DB' });
    expect(visible.map((f) => f.name)).not.toContain('id');
    expect(visible.map((f) => f.name)).toContain('name');
  });

  it('summary is among the visible fields for sequence messages', () => {
    const message = fieldOf(describeBlockSchema('sequence'), 'messages');
    if (message.kind !== 'object') throw new Error('expected object');
    const { visible } = microVisibleFields(message.fields, { from: 'a', to: 'b' });
    expect(visible.map((f) => f.name)).toContain('summary');
  });

  it('ensure forces a field into view even past the cap', () => {
    const message = fieldOf(describeBlockSchema('sequence'), 'messages');
    if (message.kind !== 'object') throw new Error('expected object');
    // With all extras valued, the cap of 4 would normally exclude `note`.
    const value = { from: 'a', to: 'b', label: 'L', kind: 'sync', summary: 'S', note: 'N' };
    const base = microVisibleFields(message.fields, value);
    expect(base.visible.map((f) => f.name)).not.toContain('note');
    const ensured = microVisibleFields(message.fields, value, 4, 'note');
    expect(ensured.visible.map((f) => f.name)).toContain('note');
    // Unknown/non-scalar ensure names are ignored.
    expect(microVisibleFields(message.fields, value, 4, 'nope').visible.length).toBe(4);
  });
});
