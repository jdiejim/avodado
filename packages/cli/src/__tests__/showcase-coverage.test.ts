/**
 * The showcase is the product's own claim: "one rendered example of every
 * block type the renderer supports." That claim silently went stale twice —
 * four blocks were added without it, then a fifth (`cycle`) was found missing
 * long after. This test is the guard: a new block type in the registry fails
 * here until it has an example in the showcase.
 *
 * `docs/reference/showcase.md` and `packages/cli/templates/demo.md` are a
 * byte-identical pair (the template the CLI ships IS the showcase), so the
 * pairing is asserted here too — an example added to one and not the other is
 * the same bug wearing a different hat.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BLOCK_TYPES } from '@avodado/core';

const ROOT = join(import.meta.dirname, '../../../..');
const SHOWCASE = join(ROOT, 'docs/reference/showcase.md');
const DEMO = join(ROOT, 'packages/cli/templates/demo.md');

/** Every fence tag that opens a typed block, in document order. */
function fenceTags(md: string): string[] {
  return [...md.matchAll(/^```([A-Za-z][\w-]*)\s*$/gm)].map((m) => m[1] as string);
}

describe('showcase coverage', () => {
  const showcase = readFileSync(SHOWCASE, 'utf8');

  it('renders an example of every block type', () => {
    const present = new Set(fenceTags(showcase));
    const missing = BLOCK_TYPES.filter((t) => !present.has(t));
    expect(missing, 'block types with no showcase example').toEqual([]);
  });

  it('is byte-identical to the demo template the CLI ships', () => {
    expect(readFileSync(DEMO)).toEqual(readFileSync(SHOWCASE));
  });

  it('states its own block count truthfully', () => {
    // Any "<n> blocks" / "<n> typed blocks" / "<n> block types" claim in the
    // document must name the real total — these went stale at 76 while the
    // registry grew to 94.
    const claims = [...showcase.matchAll(/(\d+)\s+(?:typed\s+)?blocks?(?:\s+types?)?\b/gi)]
      .map((m) => Number(m[1]))
      // Counts under 20 are always local ("2–5 structural blocks"), never the total.
      .filter((n) => n >= 20);
    for (const n of claims) expect(n, 'block-count claim in showcase.md').toBe(BLOCK_TYPES.length);
  });
});
