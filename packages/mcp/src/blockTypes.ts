/**
 * The `list_block_types` payload — the canonical block-type list plus the
 * permanent alias map (old spelling → canonical type + injected patch), so an
 * MCP client sees both what to write and what older docs may contain.
 */

import { BLOCK_ALIASES, BLOCK_TYPES } from '@avodado/core';

/** One `alias -> canonical (patch)` line per permanent alias. */
function aliasLines(): string[] {
  return Object.entries(BLOCK_ALIASES).map(([alias, def]) => {
    const patch = Object.entries(def.patch ?? {})
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join(', ');
    return patch.length > 0 ? `${alias} -> ${def.type} (${patch})` : `${alias} -> ${def.type}`;
  });
}

/** The full text listing: canonical types, then the alias table. */
export function blockTypesListing(): string {
  return [
    `Canonical block types (${BLOCK_TYPES.length}):`,
    ...BLOCK_TYPES,
    '',
    'Permanent aliases (old spellings — still valid; they parse to the canonical type with the listed fields injected):',
    ...aliasLines(),
  ].join('\n');
}
