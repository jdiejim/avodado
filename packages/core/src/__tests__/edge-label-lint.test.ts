import { describe, expect, it } from 'vitest';
import { parseDocument } from '../parser.js';
import { validateDocument } from '../validate.js';

const check = (body: string) =>
  validateDocument(parseDocument('```c4\n' + body + '\n```\n', 't'), 't.md');

describe('W_EDGE_LABEL (C4: every relationship names its intent)', () => {
  it('warns on an unlabelled c4 edge and names both ends', () => {
    const diags = check(
      'level: container\nnodes:\n  - { id: a, col: 1, row: 1, kind: container, name: Web }\n  - { id: b, col: 2, row: 1, kind: store, name: DB }\nedges:\n  - { from: a, to: b }\n  - { from: b, to: a, label: returns rows }',
    );
    const warn = diags.filter((d) => d.code === 'W_EDGE_LABEL');
    expect(warn).toHaveLength(1);
    expect(warn[0]?.level).toBe('warn');
    expect(warn[0]?.message).toContain('a → b');
    expect(warn[0]?.hint).toContain('tech');
    expect(diags.filter((d) => d.level === 'error')).toEqual([]);
  });

  it('stays quiet when every edge is labelled, including the terse form', () => {
    const diags = check(
      'nodes:\n  - { id: a, col: 1, row: 1, kind: person, name: User }\n  - { id: b, col: 2, row: 1, kind: system, name: Shop }\nedges:\n  - a -> b: places orders',
    );
    expect(diags.filter((d) => d.code === 'W_EDGE_LABEL')).toEqual([]);
  });
});
