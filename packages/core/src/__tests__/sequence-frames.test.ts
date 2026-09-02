/**
 * Sequence frames + activation: the terse sugar, the message-item union,
 * the `W_SEQ_FRAME` lint, the density budget (messages only), and the
 * string-coercion walk through the union.
 */

import { describe, expect, it } from 'vitest';
import { parseDocument } from '../parser.js';
import { validateDocument } from '../validate.js';
import { lintDensity } from '../density.js';
import { stringOnlyAt, fieldNamesAt } from '../blocks/schema-walk.js';

function seq(body: string): string {
  return '```sequence\nactors:\n  - { id: A, name: A }\n  - { id: B, name: B }\nmessages:\n' + body + '\n```\n';
}

function dataOf(md: string): { messages: unknown[] } {
  const seg = parseDocument(md, 'doc').segments.find((s) => s.kind !== 'markdown') as
    | { data: unknown }
    | undefined;
  if (seg === undefined) throw new Error('no block');
  return seg.data as { messages: unknown[] };
}

function diagsOf(md: string) {
  return validateDocument(parseDocument(md, 'doc'), 'doc.md');
}

describe('sequence.messages sugar — frame markers', () => {
  it('expands every terse frame form (unquoted single-pair maps and quoted strings)', () => {
    const d = dataOf(
      seq(
        '  - alt: token valid\n  - opt\n  - "loop: every 5s"\n  - par:\n  - break: give up\n  - critical: lock held\n  - else: expired\n  - end\n  - end: true',
      ),
    );
    expect(d.messages).toEqual([
      { frame: 'alt', label: 'token valid' },
      { frame: 'opt' },
      { frame: 'loop', label: 'every 5s' },
      { frame: 'par' },
      { frame: 'break', label: 'give up' },
      { frame: 'critical', label: 'lock held' },
      { else: 'expired' },
      { end: true },
      { end: true },
    ]);
  });

  it('expands the +/- activation signs and strips them from `to`', () => {
    const d = dataOf(seq('  - A -> +B: call\n  - B --> -A: reply\n  - A -x-> -B: boom\n  - A -> B: plain'));
    expect(d.messages).toEqual([
      { from: 'A', to: 'B', label: 'call', activate: true },
      { from: 'B', to: 'A', label: 'reply', kind: 'response', deactivate: true },
      { from: 'A', to: 'B', label: 'boom', kind: 'error', deactivate: true },
      { from: 'A', to: 'B', label: 'plain' },
    ]);
  });

  it('an `else` with no label stays as written so the schema explains it', () => {
    const d = dataOf(seq('  - alt: x\n  - else:\n  - end'));
    expect(d.messages[1]).toEqual({ else: null });
    expect(diagsOf(seq('  - alt: x\n  - else:\n  - end')).some((x) => x.code === 'E_SCHEMA')).toBe(true);
  });

  it('object forms pass through untouched', () => {
    const d = dataOf(seq('  - { frame: alt, label: hit }\n  - { else: miss }\n  - { end: true }'));
    expect(d.messages).toEqual([{ frame: 'alt', label: 'hit' }, { else: 'miss' }, { end: true }]);
  });

  it('state transitions never see the frame grammar', () => {
    const md = '```state\nstates: [a, b]\ntransitions:\n  - a -> b: go\n```\n';
    const seg = parseDocument(md, 'doc').segments[0];
    expect(seg?.kind).toBe('state');
    expect((seg as { data: { transitions: unknown[] } }).data.transitions).toEqual([{ from: 'a', to: 'b', event: 'go' }]);
  });
});

describe('sequence.messages union — validation', () => {
  it('a balanced mix of messages, frames and activation validates clean', () => {
    const md = seq(
      '  - A -> +B: call\n  - alt: ok\n  - B --> -A: 200\n  - else: fail\n  - B -x-> A: 500\n  - end\n  - loop: retry\n  - A -> A: tick\n  - end\n  - { from: A, to: B, kind: note, label: over both }',
    );
    expect(diagsOf(md)).toEqual([]);
  });

  it('a typo in a message field is reported against the message arm, with a did-you-mean', () => {
    const diags = diagsOf(seq('  - { from: A, to: B, kindd: sync }'));
    expect(diags).toHaveLength(1);
    expect(diags[0]?.code).toBe('E_SCHEMA');
    expect(diags[0]?.message).toContain("unknown field 'kindd'");
    expect(diags[0]?.hint).toContain('`kind`');
  });

  it('an unknown frame kind is reported against the frame arm', () => {
    const diags = diagsOf(seq('  - { frame: maybe }\n  - end'));
    expect(diags).toHaveLength(1);
    expect(diags[0]?.message).toContain('invalid value "maybe"');
    expect(diags[0]?.hint).toContain('alt | opt | loop | par | break | critical');
  });

  it('activate/deactivate must be booleans', () => {
    expect(diagsOf(seq('  - { from: A, to: B, activate: yes }')).some((d) => d.code === 'E_SCHEMA')).toBe(true);
    expect(diagsOf(seq('  - { from: A, to: B, activate: true, deactivate: true }'))).toEqual([]);
  });

  it('the schema walk sees through the union: labels coerce, field names merge', () => {
    expect(stringOnlyAt('sequence', ['messages', 0, 'label'])).toBe(true);
    expect(stringOnlyAt('sequence', ['messages', 0, 'from'])).toBe(true);
    expect(stringOnlyAt('sequence', ['messages', 0, 'else'])).toBe(true);
    expect(stringOnlyAt('sequence', ['messages', 0, 'activate'])).toBe(false);
    expect(stringOnlyAt('sequence', ['messages', 0, 'end'])).toBe(false);
    expect(fieldNamesAt('sequence', ['messages', 0])).toEqual([
      'from', 'to', 'label', 'kind', 'summary', 'code', 'note', 'activate', 'deactivate', 'frame', 'else', 'end',
    ]);
    // `label: 200` in the object form is still a string label.
    const d = dataOf(seq('  - { from: A, to: B, label: 200 }\n  - { frame: alt, label: 1 }\n  - { else: 2 }\n  - end'));
    expect(d.messages[0]).toEqual({ from: 'A', to: 'B', label: '200' });
    expect(d.messages[1]).toEqual({ frame: 'alt', label: '1' });
    expect(d.messages[2]).toEqual({ else: '2' });
  });
});

describe('W_SEQ_FRAME', () => {
  it('warns on an `else` with no open frame, pointing at the item line', () => {
    const diags = diagsOf(seq('  - A -> B: x\n  - else: nope'));
    expect(diags).toHaveLength(1);
    expect(diags[0]).toMatchObject({ level: 'warn', code: 'W_SEQ_FRAME', value: 'else', file: 'doc.md' });
    expect(diags[0]?.message).toContain('messages[1]');
    expect(diags[0]?.hint).toContain('- alt:');
    // messages[1] is the 7th body line: fence(1) actors(3) messages:(1) item0(1) → line 7
    expect(diags[0]?.line).toBe(7);
  });

  it('warns on an `end` with no open frame', () => {
    const diags = diagsOf(seq('  - end\n  - A -> B: x'));
    expect(diags).toHaveLength(1);
    expect(diags[0]).toMatchObject({ level: 'warn', code: 'W_SEQ_FRAME', value: 'end' });
    expect(diags[0]?.message).toContain('messages[0]');
  });

  it('warns on a frame never closed — once per open frame, naming its kind', () => {
    const diags = diagsOf(seq('  - alt: a\n  - loop: b\n  - A -> B: x\n  - end'));
    expect(diags).toHaveLength(1);
    expect(diags[0]).toMatchObject({ level: 'warn', code: 'W_SEQ_FRAME', value: 'alt' });
    expect(diags[0]?.message).toContain('`alt` frame at messages[0] is never closed');
    expect(diags[0]?.hint).toContain('- end');
  });

  it('never fires on balanced nesting, and never when the schema already failed', () => {
    expect(diagsOf(seq('  - alt: a\n  - par: b\n  - A -> B: x\n  - else: c\n  - end\n  - end'))).toEqual([]);
    const broken = diagsOf(seq('  - alt: a\n  - { frame: nope }'));
    expect(broken.every((d) => d.code === 'E_SCHEMA')).toBe(true);
  });

  it('a mermaid body positions the warning on the fence', () => {
    const md = '```mermaid\nsequenceDiagram\n  alt x\n  A->>B: y\n```\n';
    const diags = diagsOf(md);
    expect(diags).toHaveLength(1);
    expect(diags[0]).toMatchObject({ code: 'W_SEQ_FRAME', line: 1 });
  });
});

describe('density counts messages, not frame markers', () => {
  function doc(messages: number, markers: number): string {
    const m = Array.from({ length: messages }, (_, i) => `  - A -> B: m${i}`);
    const f = Array.from({ length: markers }, () => '  - alt: x\n  - end').join('\n');
    return seq([...m, f].join('\n'));
  }
  it('24 messages plus 12 markers is under budget; 25 messages warns with the message count', () => {
    expect(lintDensity(parseDocument(doc(24, 6), 'doc'), 'doc.md')).toEqual([]);
    const diags = lintDensity(parseDocument(doc(25, 6), 'doc'), 'doc.md');
    expect(diags).toHaveLength(1);
    expect(diags[0]?.message).toContain('25 messages');
  });
});
