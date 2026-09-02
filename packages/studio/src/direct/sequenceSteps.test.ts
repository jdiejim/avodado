/**
 * Frame markers in a sequence `messages` list are not messages: they get no
 * step number, and the step prompt ignores them.
 */

import { describe, expect, it } from 'vitest';
import { isSequenceMessage, needsStepPrompt, sequenceStepNumber } from './duals.js';

const messages = [
  { from: 'a', to: 'b', label: 'one' },
  { frame: 'alt', label: 'ok' },
  { from: 'b', to: 'a', label: 'two' },
  { else: 'fail' },
  { from: 'b', to: 'a', label: 'three' },
  { end: true },
];

describe('sequence frame markers in the studio', () => {
  it('isSequenceMessage tells markers from messages', () => {
    expect(messages.map(isSequenceMessage)).toEqual([true, false, true, false, true, false]);
    expect(isSequenceMessage('terse string')).toBe(true);
  });

  it('sequenceStepNumber skips markers so the hint matches the diagram badge', () => {
    expect(sequenceStepNumber(messages, 0)).toBe(1);
    expect(sequenceStepNumber(messages, 2)).toBe(2);
    expect(sequenceStepNumber(messages, 4)).toBe(3);
    expect(sequenceStepNumber('nope', 4)).toBe(5);
  });

  it('needsStepPrompt ignores markers: markers only → no prompt; messages without summaries → prompt', () => {
    expect(needsStepPrompt('sequence', { messages: [{ frame: 'alt' }, { end: true }] })).toBe(false);
    expect(needsStepPrompt('sequence', { messages })).toBe(true);
    expect(needsStepPrompt('sequence', { messages: [{ from: 'a', to: 'b', summary: 'done' }, { end: true }] })).toBe(false);
  });
});
