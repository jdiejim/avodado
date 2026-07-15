/**
 * The shared `groups` field (gridGroupSchema) on the coordinate-grid diagram
 * blocks: flow / dfd / state / c4 gained the exact shape `block` and
 * `felogic` already had — dashed zone wrappers anchored by col/row.
 */

import { describe, expect, it } from 'vitest';
import { parseDocument } from '../parser.js';
import { validateDocument } from '../validate.js';

function diagsFor(md: string): ReturnType<typeof validateDocument> {
  return validateDocument(parseDocument(md.trim() + '\n', 'tmp'), 'tmp.md');
}

const GROUPS_YAML = [
  'groups:',
  '  - { col: 1, row: 1, cols: 2, rows: 1, label: Zone A }',
  '  - { id: z2, col: 2, row: 1, label: Zone B, color: "#9c4a2f" }',
].join('\n');

const HAPPY: Readonly<Record<string, string>> = {
  flow: `\`\`\`flow\n${GROUPS_YAML}\nnodes:\n  - { id: a, label: Start, col: 1, row: 1 }\n\`\`\``,
  dfd: `\`\`\`dfd\n${GROUPS_YAML}\nnodes:\n  - { id: a, name: Client, col: 1, row: 1 }\n\`\`\``,
  state: `\`\`\`state\n${GROUPS_YAML}\nstates:\n  - { id: a, name: Draft, col: 1, row: 1 }\n\`\`\``,
  c4: `\`\`\`c4\n${GROUPS_YAML}\nnodes:\n  - { id: a, kind: person, name: User, col: 1, row: 1 }\n\`\`\``,
  block: `\`\`\`block\n${GROUPS_YAML}\nnodes:\n  - { id: a, name: API, col: 1, row: 1 }\n\`\`\``,
};

describe('shared grid groups — schema parity across the grid diagrams', () => {
  for (const [kind, md] of Object.entries(HAPPY)) {
    it(`${kind}: groups with the full field set validate clean`, () => {
      expect(diagsFor(md), kind).toEqual([]);
    });
  }

  it('group col/row are required (anchored by explicit coordinates)', () => {
    const d = diagsFor('```flow\ngroups:\n  - { label: Floating }\n```');
    expect(d.some((x) => x.code === 'E_SCHEMA')).toBe(true);
  });

  it('group label is required', () => {
    const d = diagsFor('```dfd\ngroups:\n  - { col: 1, row: 1 }\n```');
    expect(d.some((x) => x.code === 'E_SCHEMA')).toBe(true);
  });

  it('unknown group fields are rejected (strict schema)', () => {
    for (const kind of ['flow', 'dfd', 'state', 'c4', 'block']) {
      const d = diagsFor(
        `\`\`\`${kind}\ngroups:\n  - { col: 1, row: 1, label: Zone, sparkle: true }\n\`\`\``,
      );
      expect(d.some((x) => x.code === 'E_SCHEMA'), kind).toBe(true);
    }
  });
});
