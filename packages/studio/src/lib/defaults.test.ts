import { describe, expect, it } from 'vitest';
import { describeBlockSchema, blockSchemas } from '@avodado/core';
import { defaultObject, defaultValue } from './defaults.js';

describe('defaultValue', () => {
  it('produces zero values for scalars', () => {
    expect(defaultValue({ kind: 'string', optional: false })).toBe('');
    expect(defaultValue({ kind: 'number', optional: false })).toBe(0);
    expect(defaultValue({ kind: 'boolean', optional: false })).toBe(false);
    expect(defaultValue({ kind: 'array', optional: false, element: { kind: 'string', optional: false } })).toEqual([]);
  });

  it('picks the first enum option', () => {
    expect(defaultValue({ kind: 'enum', optional: false, options: ['sync', 'async'] })).toBe('sync');
  });

  it('fills only required fields of an object', () => {
    const node = {
      kind: 'object',
      optional: false,
      fields: [
        { name: 'label', node: { kind: 'string', optional: false } },
        { name: 'desc', node: { kind: 'string', optional: true } },
        { name: 'count', node: { kind: 'number', optional: false } },
      ],
    } as const;
    expect(defaultObject(node)).toEqual({ label: '', count: 0 });
  });

  it('seeds the first string/number/enum field when every field is optional', () => {
    // Booleans are skipped as seeds — `flag: false` says nothing visible.
    const node = {
      kind: 'object',
      optional: false,
      fields: [
        { name: 'flag', node: { kind: 'boolean', optional: true } },
        { name: 'title', node: { kind: 'string', optional: true } },
      ],
    } as const;
    expect(defaultObject(node)).toEqual({ title: '' });
    const onlyBool = {
      kind: 'object',
      optional: false,
      fields: [{ name: 'flag', node: { kind: 'boolean', optional: true } }],
    } as const;
    expect(defaultObject(onlyBool)).toEqual({});
  });

  it('builds a schema-valid item for a real block (sequence.messages)', () => {
    const root = describeBlockSchema('sequence');
    expect(root.kind).toBe('object');
    if (root.kind !== 'object') return;
    const messages = root.fields.find((f) => f.name === 'messages');
    expect(messages?.node.kind).toBe('array');
    if (messages?.node.kind !== 'array' || messages.node.element.kind !== 'object') return;
    const item = defaultObject(messages.node.element);
    // A sequence with the generated message must pass the zod schema.
    const parsed = blockSchemas.sequence.safeParse({
      actors: [{ id: 'a', name: 'A' }],
      messages: [{ ...item, from: 'a', to: 'a', label: 'x' }],
    });
    expect(parsed.success).toBe(true);
  });
});
