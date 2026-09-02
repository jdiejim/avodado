/**
 * `unionArmFor` — value-aware arm selection for unions with SEVERAL object
 * arms (a sequence `messages` item: message | frame open | else | end).
 */

import { describe, expect, it } from 'vitest';
import { describeBlockSchema, type FieldNode } from '@avodado/core';
import { unionArmFor, unionObjectArms } from './union.js';

function messagesElement(): Extract<FieldNode, { kind: 'union' }> {
  const root = describeBlockSchema('sequence');
  if (root.kind !== 'object') throw new Error('root');
  const messages = root.fields.find((f) => f.name === 'messages')?.node;
  if (messages?.kind !== 'array' || messages.element.kind !== 'union') throw new Error('messages');
  return messages.element;
}

const names = (arm: Extract<FieldNode, { kind: 'object' }> | null): string[] =>
  arm === null ? [] : arm.fields.map((f) => f.name);

describe('unionArmFor', () => {
  const el = messagesElement();

  it('lists every object arm in order', () => {
    expect(unionObjectArms(el).map((a) => a.fields[0]?.name)).toEqual(['from', 'frame', 'else', 'end']);
  });

  it('picks the arm whose required fields the value carries', () => {
    expect(names(unionArmFor(el, { from: 'a', to: 'b', label: 'x' }))).toContain('summary');
    expect(names(unionArmFor(el, { frame: 'alt', label: 'ok' }))).toEqual(['frame', 'label']);
    expect(names(unionArmFor(el, { else: 'miss' }))).toEqual(['else']);
    expect(names(unionArmFor(el, { end: true }))).toEqual(['end']);
  });

  it('falls back to the first object arm for scalars, empties and unmatched objects', () => {
    expect(names(unionArmFor(el, undefined))[0]).toBe('from');
    expect(names(unionArmFor(el, 'text'))[0]).toBe('from');
    expect(names(unionArmFor(el, { label: 'only' }))[0]).toBe('from');
  });
});
