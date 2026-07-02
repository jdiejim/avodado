/**
 * Guards the reference/blocks/ split: every block type in @avodado/core's
 * BLOCK_TYPES must be documented in exactly one family file (its `#### \`name\``
 * heading), so a type can never be dropped or double-homed when the skill's
 * reference files are edited.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { BLOCK_TYPES } from '@avodado/core';
import { SKILL_REFERENCE_FILES, templatesDir } from '../commands/init.js';

const BLOCKS_DIR = join(templatesDir(), '.avodado/skill/reference/blocks');
const NON_FAMILY = new Set(['INDEX.md', 'contract.md']);

/** Block names claimed by a family file = every `name` in its #### headings. */
function headingNames(md: string): string[] {
  const names: string[] = [];
  for (const heading of md.matchAll(/^####\s+(.+)$/gm)) {
    for (const name of (heading[1] ?? '').matchAll(/`([a-z0-9]+)`/g)) {
      if (name[1] !== undefined) names.push(name[1]);
    }
  }
  return names;
}

describe('reference/blocks family files', () => {
  const familyFiles = readdirSync(BLOCKS_DIR)
    .filter((f) => f.endsWith('.md') && !NON_FAMILY.has(f))
    .sort();

  it('every BLOCK_TYPES name appears in exactly one family file', () => {
    const owners = new Map<string, string[]>();
    for (const file of familyFiles) {
      const md = readFileSync(join(BLOCKS_DIR, file), 'utf8');
      for (const name of headingNames(md)) {
        owners.set(name, [...(owners.get(name) ?? []), file]);
      }
    }
    const missing = BLOCK_TYPES.filter((t) => !owners.has(t));
    const duplicated = BLOCK_TYPES.filter((t) => (owners.get(t)?.length ?? 0) > 1);
    const unknown = [...owners.keys()].filter((n) => !(BLOCK_TYPES as readonly string[]).includes(n));
    expect(missing, 'block types with no family file').toEqual([]);
    expect(duplicated, 'block types documented in two family files').toEqual([]);
    expect(unknown, 'family-file headings not in BLOCK_TYPES').toEqual([]);
  });

  it('INDEX.md maps every block type to an existing family file', () => {
    const index = readFileSync(join(BLOCKS_DIR, 'INDEX.md'), 'utf8');
    for (const t of BLOCK_TYPES) {
      expect(index, `INDEX.md row for \`${t}\``).toMatch(new RegExp(`^\\| \`${t}\` \\| \`[a-z-]+\\.md\` \\|`, 'm'));
    }
    for (const file of index.matchAll(/\| `([a-z-]+\.md)` \|/g)) {
      expect(familyFiles, `INDEX.md points at ${file[1]}`).toContain(file[1]);
    }
  });

  it('every family file (and INDEX/contract) is in the canonical stitch list', () => {
    const listed = SKILL_REFERENCE_FILES.filter((f) => f.includes('/reference/blocks/')).map((f) =>
      f.slice(f.lastIndexOf('/') + 1),
    );
    expect([...listed].sort()).toEqual([...familyFiles, 'INDEX.md', 'contract.md'].sort());
  });
});
