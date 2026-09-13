/**
 * `avo block [type]` — the reference an agent reads instead of a Markdown
 * contract. One block: fields, enums, terse forms, and a validating example,
 * all derived from the schema in `@avodado/core` (so nothing can drift). No
 * argument: every block type, one line each, grouped by family — the map an
 * agent scans to pick a block.
 *
 * Pure: returns text; the dispatcher prints it and sets the exit code.
 */

import {
  BLOCK_ALIASES,
  BLOCK_DESCRIPTIONS,
  BLOCK_FAMILIES,
  BLOCK_TYPES,
  blockContract,
  familyBlocks,
  formatBlockContract,
  type BlockType,
} from '@avodado/core';

/** Resolves a name — canonical or one of the permanent aliases. */
export function resolveBlockName(name: string): { type: BlockType; alias?: string } | undefined {
  if ((BLOCK_TYPES as readonly string[]).includes(name)) return { type: name as BlockType };
  const alias = BLOCK_ALIASES[name];
  if (alias !== undefined) return { type: alias.type, alias: name };
  return undefined;
}

/** Every block on one line, grouped by family — the selection map. */
export function blockIndex(): string {
  const out: string[] = [
    `${BLOCK_TYPES.length} block types — avo block <type> for fields + example`,
    '',
  ];
  for (const fam of BLOCK_FAMILIES) {
    const types = familyBlocks(fam.id);
    out.push(`${fam.label} (${types.length})`);
    for (const t of types) out.push(`  ${t.padEnd(14)}${BLOCK_DESCRIPTIONS[t]}`);
    out.push('');
  }
  const aliases = Object.entries(BLOCK_ALIASES).map(([a, d]) => `${a}→${d.type}`);
  out.push(`Old names still accepted: ${aliases.join('  ')}`);
  return out.join('\n') + '\n';
}

/** The text (or JSON) for `avo block <type>`. */
export function blockReference(type: BlockType, json: boolean): string {
  return json ? JSON.stringify(blockContract(type), null, 2) + '\n' : formatBlockContract(type);
}
