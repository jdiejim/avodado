/**
 * Delete-confirm predicates: destructive content confirms, pristine
 * scaffolding (template blocks, still-seeded array items) does not.
 */

import { describe, expect, it } from 'vitest';
import { describeBlockSchema, parseDocument, templateBody, type Segment } from '@avodado/core';
import { newItemForList } from '../direct/paths.js';
import { needsBlockDeleteConfirm, needsPartDeleteConfirm } from './confirmDelete.js';

function seg(src: string): Segment {
  return parseDocument(src, 'd').segments[0] as Segment;
}

describe('needsBlockDeleteConfirm', () => {
  it('empty or whitespace-only prose deletes without a confirm', () => {
    expect(needsBlockDeleteConfirm({ kind: 'markdown', text: '', line: 1 })).toBe(false);
    expect(needsBlockDeleteConfirm({ kind: 'markdown', text: '  \n ', line: 1 })).toBe(false);
  });

  it('prose with content confirms', () => {
    expect(needsBlockDeleteConfirm(seg('Real words.\n'))).toBe(true);
  });

  it('a just-inserted block still equal to its template is pristine', () => {
    const raw = templateBody('callout');
    expect(needsBlockDeleteConfirm(seg('```callout\n' + raw + '\n```\n'))).toBe(false);
  });

  it('an empty-bodied block is pristine', () => {
    expect(needsBlockDeleteConfirm(seg('```callout\n```\n'))).toBe(false);
  });

  it('a touched block confirms', () => {
    expect(needsBlockDeleteConfirm(seg('```callout\ntone: note\ntitle: Mine\n```\n'))).toBe(true);
  });
});

describe('needsPartDeleteConfirm', () => {
  const actorsElement = (): Parameters<typeof newItemForList>[0] => {
    const root = describeBlockSchema('sequence');
    if (root.kind !== 'object') throw new Error('schema drift');
    const actors = root.fields.find((f) => f.name === 'actors');
    if (actors === undefined || actors.node.kind !== 'array') throw new Error('schema drift');
    return actors.node.element;
  };

  it('a still-seeded "+ Add" item deletes without a confirm', () => {
    const first = { id: 'a', name: 'API' };
    const seeded = newItemForList(actorsElement(), [first], 'actor');
    const data = { actors: [first, seeded], messages: [] };
    expect(needsPartDeleteConfirm('sequence', data, 'actors.1')).toBe(false);
  });

  it('the same item, once touched, confirms', () => {
    const first = { id: 'a', name: 'API' };
    const seeded = newItemForList(actorsElement(), [first], 'actor') as Record<string, unknown>;
    const data = { actors: [first, { ...seeded, name: 'Billing' }], messages: [] };
    expect(needsPartDeleteConfirm('sequence', data, 'actors.1')).toBe(true);
  });

  it('an all-empty row is pristine even when it never matched a seed', () => {
    const data = { actors: [{ id: '', name: '' }], messages: [] };
    expect(needsPartDeleteConfirm('sequence', data, 'actors.0')).toBe(false);
  });

  it('a filled item confirms', () => {
    const data = { actors: [{ id: 'a', name: 'API' }], messages: [] };
    expect(needsPartDeleteConfirm('sequence', data, 'actors.0')).toBe(true);
  });

  it('errs on the safe side for non-item or unresolvable paths', () => {
    const data = { actors: [{ id: 'a', name: 'API' }], messages: [] };
    expect(needsPartDeleteConfirm('sequence', data, 'title')).toBe(true);
    expect(needsPartDeleteConfirm('sequence', data, 'nonsense.3')).toBe(true);
    expect(needsPartDeleteConfirm('sequence', data, 'actors.9')).toBe(true);
  });
});
