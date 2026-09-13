/**
 * Hints found necessary by the generation eval (evals/generate, 2026-09-13):
 * the two first-draft error shapes agents hit were an unquoted comma inside an
 * inline map and a string where a list has no terse form. Both diagnostics now
 * say what happened and what to write instead.
 */

import { describe, expect, it } from 'vitest';
import { parseDocument } from '../parser.js';
import { validateDocument } from '../validate.js';

const check = (kind: string, body: string) =>
  validateDocument(parseDocument('```' + kind + '\n' + body + '\n```\n', 't'), 't.md');

describe('E_SCHEMA hints', () => {
  it('repairs the unquoted-comma trap in a single-line map instead of reporting it', () => {
    const diags = check(
      'benchmark',
      'subjects:\n  - { label: Redis, sub: managed, 2 nodes }\n  - { label: LRU }\nrows:\n  - { label: p99, cells: [1, 2] }',
    );
    expect(diags.filter((d) => d.level === 'error')).toEqual([]);
  });

  it('names the unquoted-comma trap when the split survives in block style', () => {
    const diags = check(
      'benchmark',
      'subjects:\n  - label: Redis\n    sub: managed\n    2 nodes:\n  - { label: LRU }\nrows:\n  - { metric: p99, values: [1, 2] }',
    );
    const unknown = diags.find((d) => d.code === 'E_SCHEMA' && d.message.includes("'2 nodes'"));
    expect(unknown).toBeDefined();
    expect(unknown?.hint).toContain('unquoted comma');
    expect(unknown?.hint).toContain('quote the value');
  });

  it('does not blame a comma for an ordinary typo', () => {
    const diags = check('callout', 'tone: note\nbdy: hi');
    const unknown = diags.find((d) => d.code === 'E_SCHEMA');
    expect(unknown?.hint).not.toContain('unquoted comma');
    expect(unknown?.hint).toContain('Did you mean `body`?');
  });

  it('points a string-in-a-list at the terse forms that exist', () => {
    const diags = check(
      'sequence',
      'actors:\n  - { id: A, name: A }\n  - { id: B, name: B }\nmessages:\n  - A -> B: hi\n  - "note: B removes the pod"',
    );
    const bad = diags.find((d) => d.code === 'E_SCHEMA' && d.message.includes('expected object, got string'));
    expect(bad).toBeDefined();
    expect(bad?.hint).toContain('`from -> to: label`');
    expect(bad?.hint).toContain('avo block sequence');
  });
});

describe('terse lines with a colon in their text', () => {
  it('a single-pair map whose key carries spaces is rescued as the terse line YAML split', () => {
    const diags = check(
      'eventcontract',
      'name: order.placed\nschema:\n  - order_id uuid required — The order this event is about\n  - total_cents integer required — Sum: lines plus tax\n',
    );
    expect(diags.filter((d) => d.level === 'error')).toEqual([]);
    const doc = parseDocument(
      '```eventcontract\nname: order.placed\nschema:\n  - total_cents integer required — Sum: lines plus tax\n```\n',
      't',
    );
    const seg = doc.segments[0] as { data: { schema: Array<{ name: string; desc?: string }> } };
    expect(seg.data.schema[0]?.name).toBe('total_cents');
    expect(seg.data.schema[0]?.desc).toBe('Sum: lines plus tax');
  });
});
