/**
 * Guards the reference/blocks/ split: every canonical block type in
 * @avodado/core's BLOCK_TYPES must be documented in exactly one family file
 * (its `#### \`name\`` heading), alias spellings may appear ONLY in the
 * INDEX.md / contract.md alias tables, and the skill's block-count strings
 * can't drift from BLOCK_TYPES.length.
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { BLOCK_ALIASES, BLOCK_TYPES } from '@avodado/core';
import { SKILL_REFERENCE_FILES, templatesDir } from '../commands/init.js';

const SKILL_DIR = join(templatesDir(), '.avodado/skill');
const BLOCKS_DIR = join(SKILL_DIR, 'reference/blocks');
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

  it('every BLOCK_TYPES name appears in exactly one family file — canonical only', () => {
    const owners = new Map<string, string[]>();
    for (const file of familyFiles) {
      const md = readFileSync(join(BLOCKS_DIR, file), 'utf8');
      for (const name of headingNames(md)) {
        owners.set(name, [...(owners.get(name) ?? []), file]);
      }
    }
    const missing = BLOCK_TYPES.filter((t) => !owners.has(t));
    const duplicated = BLOCK_TYPES.filter((t) => (owners.get(t)?.length ?? 0) > 1);
    // Canonical-only: alias spellings (the 12 merged names) must NOT own a
    // heading — they live solely in the INDEX/contract alias tables.
    const unknown = [...owners.keys()].filter(
      (n) => !(BLOCK_TYPES as readonly string[]).includes(n),
    );
    expect(missing, 'block types with no family file').toEqual([]);
    expect(duplicated, 'block types documented in two family files').toEqual([]);
    expect(unknown, 'family-file headings not in BLOCK_TYPES (aliases belong in the alias tables only)').toEqual([]);
  });

  it('INDEX.md maps every block type to an existing family file', () => {
    const index = readFileSync(join(BLOCKS_DIR, 'INDEX.md'), 'utf8');
    for (const t of BLOCK_TYPES) {
      expect(index, `INDEX.md row for \`${t}\``).toMatch(new RegExp(`^\\| \`${t}\` \\| \`[a-z-]+\\.md\` \\|`, 'm'));
    }
    for (const file of index.matchAll(/\| `([a-z-]+\.md)` \|/g)) {
      expect(familyFiles, `INDEX.md points at ${file[1]}`).toContain(file[1]);
    }
    // No family-file row for an alias spelling — aliases live in the alias table.
    for (const alias of Object.keys(BLOCK_ALIASES)) {
      expect(index, `INDEX.md must not map alias \`${alias}\` to a family file`).not.toMatch(
        new RegExp(`^\\| \`${alias}\` \\| \`[a-z-]+\\.md\` \\|`, 'm'),
      );
    }
  });

  it('INDEX.md and contract.md carry the alias → canonical table', () => {
    const index = readFileSync(join(BLOCKS_DIR, 'INDEX.md'), 'utf8');
    const contract = readFileSync(join(BLOCKS_DIR, 'contract.md'), 'utf8');
    for (const [alias, def] of Object.entries(BLOCK_ALIASES)) {
      const row = new RegExp(`^\\| \`${alias}\` \\| \`${def.type}\` \\|`, 'm');
      expect(index, `INDEX.md alias row for \`${alias}\` → \`${def.type}\``).toMatch(row);
      expect(contract, `contract.md alias row for \`${alias}\` → \`${def.type}\``).toMatch(row);
      // The injected patch is spelled out beside the alias (e.g. `preset: infra`).
      for (const [k, v] of Object.entries(def.patch ?? {})) {
        expect(contract, `contract.md alias patch for \`${alias}\``).toContain(`${k}: ${String(v)}`);
      }
    }
  });

  it('contract.md has exactly one row per canonical block type', () => {
    const contract = readFileSync(join(BLOCKS_DIR, 'contract.md'), 'utf8');
    const main = contract.split('## Alias table')[0] ?? contract;
    for (const t of BLOCK_TYPES) {
      const rows = main.match(new RegExp(`^\\| \`${t}\` \\|`, 'gm')) ?? [];
      expect(rows.length, `contract.md rows for \`${t}\``).toBe(1);
    }
  });

  it('skill count strings match BLOCK_TYPES.length (drift guard)', () => {
    const n = BLOCK_TYPES.length;
    const skill = readFileSync(join(SKILL_DIR, 'SKILL.md'), 'utf8');
    // The frontmatter lists 16 high-signal types, "and NN more".
    expect(skill).toContain(`and ${n - 16} more`);
    // The block-grammar rule names the full count.
    expect(skill).toContain(`**${n} block types**`);
    expect(skill, 'stale block count in SKILL.md').not.toMatch(/\b91 block/);
    const index = readFileSync(join(BLOCKS_DIR, 'INDEX.md'), 'utf8');
    expect(index).toContain(`# The ${n} block types`);
    const contract = readFileSync(join(BLOCKS_DIR, 'contract.md'), 'utf8');
    expect(contract).toContain(`all ${n} blocks`);
  });

  it('every family file (and INDEX/contract) is in the canonical stitch list', () => {
    const listed = SKILL_REFERENCE_FILES.filter((f) => f.includes('/reference/blocks/')).map((f) =>
      f.slice(f.lastIndexOf('/') + 1),
    );
    expect([...listed].sort()).toEqual([...familyFiles, 'INDEX.md', 'contract.md'].sort());
  });

  it('recipes.md and style-ste.md sit in the canonical stitch list, in order', () => {
    // recipes.md composes the family files, so it stitches immediately after them.
    const lastFamily = Math.max(
      ...SKILL_REFERENCE_FILES.flatMap((f, i) => (f.includes('/reference/blocks/') ? [i] : [])),
    );
    expect(SKILL_REFERENCE_FILES[lastFamily + 1]).toBe('.avodado/skill/reference/recipes.md');
    // style-ste.md is authoring guidance — it stitches beside intake/organizing.
    const idx = (f: string): number => SKILL_REFERENCE_FILES.indexOf(`.avodado/skill/reference/${f}`);
    expect(idx('style-ste.md')).toBeGreaterThan(idx('intake.md'));
    expect(idx('style-ste.md')).toBe(idx('organizing.md') + 1);
  });

  it('every listed reference file exists in the templates tree (stitch/embed input)', () => {
    for (const f of SKILL_REFERENCE_FILES) {
      expect(existsSync(join(templatesDir(), f)), `missing ${f}`).toBe(true);
    }
  });
});
