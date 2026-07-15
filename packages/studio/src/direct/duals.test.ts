/**
 * Dual-representation rules: twin matching (diagram row ↔ step <li>) and the
 * zero-summaries "add step descriptions" prompt predicate.
 */

import { describe, expect, it } from 'vitest';
import { needsStepPrompt, twinIndices } from './duals.js';

describe('twinIndices', () => {
  // A sequence block's tag inventory: actor groups, message rows (diagram),
  // and the same message paths again as step <li>s.
  const paths = ['actors.0', 'actors.1', 'messages.0', 'messages.1', 'messages.0', 'messages.1'];

  it('hovering the diagram row finds the step <li> (and vice versa)', () => {
    expect(twinIndices(paths, 'messages.0', 2)).toEqual([4]);
    expect(twinIndices(paths, 'messages.0', 4)).toEqual([2]);
  });

  it('untwinned paths have no matches', () => {
    expect(twinIndices(paths, 'actors.0', 0)).toEqual([]);
  });

  it('selfIndex -1 returns every representation (editor-open highlight)', () => {
    expect(twinIndices(paths, 'messages.1', -1)).toEqual([3, 5]);
  });

  it('exact match only — no prefix bleed, empty target matches nothing', () => {
    expect(twinIndices(['messages.1', 'messages.10'], 'messages.1', -1)).toEqual([0]);
    expect(twinIndices(['', 'a'], '', -1)).toEqual([]);
  });
});

describe('needsStepPrompt', () => {
  const msg = (summary?: string): Record<string, unknown> =>
    summary === undefined ? { from: 'a', to: 'b' } : { from: 'a', to: 'b', summary };

  it('sequence with messages and zero summaries → prompt', () => {
    expect(needsStepPrompt('sequence', { messages: [msg(), msg()] })).toBe(true);
    expect(needsStepPrompt('sequence', { messages: [msg(''), msg()] })).toBe(true);
  });

  it('any non-empty summary → no prompt (the list already renders)', () => {
    expect(needsStepPrompt('sequence', { messages: [msg(), msg('Validates input')] })).toBe(false);
  });

  it('no messages, malformed data, or other block kinds → no prompt', () => {
    expect(needsStepPrompt('sequence', { messages: [] })).toBe(false);
    expect(needsStepPrompt('sequence', {})).toBe(false);
    expect(needsStepPrompt('sequence', null)).toBe(false);
    expect(needsStepPrompt('sequence', { messages: ['weird'] })).toBe(true); // string item: no summary
    expect(needsStepPrompt('flow', { messages: [msg()] })).toBe(false);
  });
});
