/**
 * `list_block_types` payload: every canonical type appears, and every
 * permanent alias appears with its canonical target + injected patch — so an
 * MCP client can both write canonical names and recognise old spellings.
 */

import { describe, expect, it } from 'vitest';
import { BLOCK_ALIASES, BLOCK_TYPES } from '@avodado/core';
import { blockTypesListing } from '../blockTypes.js';

describe('blockTypesListing', () => {
  const text = blockTypesListing();
  const lines = text.split('\n');

  it('lists every canonical block type once, with the count in the header', () => {
    expect(text).toContain(`Canonical block types (${BLOCK_TYPES.length}):`);
    for (const t of BLOCK_TYPES) {
      expect(lines, `canonical line for ${t}`).toContain(t);
    }
  });

  it('maps every permanent alias to its canonical type and patch', () => {
    for (const [alias, def] of Object.entries(BLOCK_ALIASES)) {
      const patch = Object.entries(def.patch ?? {})
        .map(([k, v]) => `${k}: ${String(v)}`)
        .join(', ');
      const expected =
        patch.length > 0 ? `${alias} -> ${def.type} (${patch})` : `${alias} -> ${def.type}`;
      expect(lines, `alias line for ${alias}`).toContain(expected);
    }
  });

  it('does not list an alias as a canonical type', () => {
    const canonicalSection = text.split('Permanent aliases')[0] ?? text;
    for (const alias of Object.keys(BLOCK_ALIASES)) {
      expect(canonicalSection.split('\n'), `alias ${alias} leaked`).not.toContain(alias);
    }
  });
});
