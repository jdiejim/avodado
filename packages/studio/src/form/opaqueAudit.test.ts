/**
 * The ex-opaque audit: with union introspection landed, almost every field of
 * every block type has a real form control. This test enumerates
 * `describeBlockSchema` for ALL block types and asserts the set of remaining
 * `opaque` nodes is EXACTLY the curated allow-list below — adding a schema
 * construct the form can't represent fails here first, on purpose.
 */

import { describe, expect, it } from 'vitest';
import { BLOCK_TYPES, describeBlockSchema, type FieldNode } from '@avodado/core';

/**
 * The curated allow-list of legitimately-opaque paths (`type:path` form,
 * arrays spelled `[]`), each with its justification:
 *
 * - `gallery:items[].block` — a NESTED BLOCK body (`{ type: c4, …c4 data }`).
 *   The schema is a passthrough object because the real shape depends on the
 *   `type` value; the YAML-tab fallback is the correct editor for an
 *   arbitrary nested block.
 */
const OPAQUE_ALLOW_LIST: readonly string[] = ['gallery:items[].block'];

function collectOpaquePaths(node: FieldNode, prefix: string, out: string[]): void {
  switch (node.kind) {
    case 'opaque':
      out.push(prefix);
      return;
    case 'array':
      collectOpaquePaths(node.element, `${prefix}[]`, out);
      return;
    case 'object':
      for (const f of node.fields) {
        collectOpaquePaths(f.node, prefix === '' ? f.name : `${prefix}.${f.name}`, out);
      }
      return;
    case 'union':
      node.arms.forEach((arm, i) => collectOpaquePaths(arm, `${prefix}|arm${i}`, out));
      return;
    default:
      return; // scalars & enums always have controls
  }
}

describe('opaque audit across all block types', () => {
  it(`covers ${BLOCK_TYPES.length} block types`, () => {
    expect(BLOCK_TYPES.length).toBe(90);
  });

  it('every root schema introspects as an object (the form always renders)', () => {
    for (const type of BLOCK_TYPES) {
      expect(describeBlockSchema(type).kind, `root of ${type}`).toBe('object');
    }
  });

  it('the remaining opaque nodes are exactly the allow-list', () => {
    const found: string[] = [];
    for (const type of BLOCK_TYPES) {
      const paths: string[] = [];
      collectOpaquePaths(describeBlockSchema(type), '', paths);
      for (const p of paths) found.push(`${type}:${p}`);
    }
    expect(found.sort()).toEqual([...OPAQUE_ALLOW_LIST].sort());
  });
});
