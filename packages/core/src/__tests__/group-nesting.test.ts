/**
 * `block` topology extensions: nested groups (`groups[].parent`), node
 * `replicas`, and `preset: k8s`. Nesting is linted — a child outside its
 * parent's cells, or a `parent` that resolves to nothing, is a
 * `W_GROUP_NESTING` warning that points at the `parent` key.
 */

import { describe, expect, it } from 'vitest';
import { parseDocument } from '../parser.js';
import { validateDocument } from '../validate.js';

function diagsFor(md: string): ReturnType<typeof validateDocument> {
  return validateDocument(parseDocument(md.trim() + '\n', 'tmp'), 'tmp.md');
}

const NESTED = `\`\`\`block
preset: k8s
groups:
  - { id: region, col: 1, row: 1, cols: 4, rows: 2, label: Region }
  - { id: zone, parent: region, col: 1, row: 1, cols: 2, rows: 2, label: Zone A }
  - { id: subnet, parent: zone, col: 1, row: 1, cols: 2, rows: 1, label: Public }
nodes:
  - { id: gw, col: 1, row: 1, kind: ingress, name: Ingress, replicas: 2 }
  - { id: api, col: 2, row: 2, kind: pod, name: api, replicas: 3 }
edges:
  - gw -> api
\`\`\``;

describe('block topology — schema', () => {
  it('accepts parent, replicas and preset: k8s', () => {
    expect(diagsFor(NESTED)).toEqual([]);
  });

  it('replicas must be a positive integer', () => {
    const d = diagsFor('```block\nnodes:\n  - { id: a, name: A, replicas: 0 }\n```');
    expect(d.some((x) => x.code === 'E_SCHEMA')).toBe(true);
    const f = diagsFor('```block\nnodes:\n  - { id: a, name: A, replicas: 1.5 }\n```');
    expect(f.some((x) => x.code === 'E_SCHEMA')).toBe(true);
  });

  it('rejects an unknown group field and an unknown preset', () => {
    const g = diagsFor('```block\ngroups:\n  - { id: r, col: 1, row: 1, label: R, nest: true }\n```');
    expect(g.some((x) => x.code === 'E_SCHEMA')).toBe(true);
    const p = diagsFor('```block\npreset: swarm\nnodes:\n  - { id: a, name: A }\n```');
    expect(p.some((x) => x.code === 'E_SCHEMA')).toBe(true);
  });

  it('parent is accepted on every grid diagram that shares the group shape', () => {
    for (const kind of ['flow', 'dfd', 'state', 'c4']) {
      const d = diagsFor(
        `\`\`\`${kind}\ngroups:\n  - { id: outer, col: 1, row: 1, cols: 2, rows: 1, label: Outer }\n  - { id: inner, parent: outer, col: 1, row: 1, label: Inner }\n\`\`\``,
      );
      expect(d, kind).toEqual([]);
    }
  });
});

describe('block topology — W_GROUP_NESTING', () => {
  it('warns when a child is not inside its parent, pointing at the parent key', () => {
    const d = diagsFor(`\`\`\`block
groups:
  - { id: region, col: 1, row: 1, cols: 2, rows: 1, label: Region }
  - { id: zone, parent: region, col: 2, row: 1, cols: 2, rows: 1, label: Zone }
\`\`\``);
    expect(d).toHaveLength(1);
    const w = d[0];
    expect(w?.code).toBe('W_GROUP_NESTING');
    expect(w?.level).toBe('warn');
    expect(w?.line).toBe(4);
    expect(w?.message).toContain('groups[1]');
    expect(w?.message).toContain('region');
    expect(w?.hint).toBeDefined();
  });

  it('warns when the parent id resolves to nothing', () => {
    const d = diagsFor(`\`\`\`block
groups:
  - { id: zone, parent: nowhere, col: 1, row: 1, label: Zone }
\`\`\``);
    expect(d.map((x) => x.code)).toEqual(['W_GROUP_NESTING']);
    expect(d[0]?.message).toContain('nowhere');
  });

  it('a group cannot be its own parent', () => {
    const d = diagsFor('```block\ngroups:\n  - { id: z, parent: z, col: 1, row: 1, label: Z }\n```');
    expect(d.map((x) => x.code)).toEqual(['W_GROUP_NESTING']);
  });

  it('stays silent for well-nested groups and for groups without parent', () => {
    expect(diagsFor(NESTED)).toEqual([]);
    const legacy = diagsFor(`\`\`\`block
groups:
  - { col: 1, row: 1, cols: 3, rows: 2, label: VPC }
  - { col: 1, row: 1, cols: 3, rows: 1, label: Public }
\`\`\``);
    expect(legacy).toEqual([]);
  });

  it('is a warning, never an error: the document still counts as valid', () => {
    const d = diagsFor(`\`\`\`block
groups:
  - { id: a, col: 1, row: 1, label: A }
  - { id: b, parent: a, col: 3, row: 3, label: B }
\`\`\``);
    expect(d.every((x) => x.level === 'warn')).toBe(true);
  });
});
