/**
 * Guards the skill's reference/blocks/ split: every canonical block type in
 * chiltepin-core's BLOCK_TYPES is documented in exactly one family file (its
 * `#### \`name\`` heading), alias spellings appear only in the INDEX alias
 * table, and the block-count strings cannot drift from BLOCK_TYPES.length.
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { BLOCK_ALIASES, BLOCK_TYPES } from 'chiltepin-core';
import { SKILL_REFERENCE_FILES, skillDir } from '../commands/init.js';

const SKILL_DIR = skillDir();
const BLOCKS_DIR = join(SKILL_DIR, 'reference/blocks');
const NON_FAMILY = new Set(['INDEX.md']);

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
    const unknown = [...owners.keys()].filter(
      (n) => !(BLOCK_TYPES as readonly string[]).includes(n),
    );
    expect(missing, 'block types with no family file').toEqual([]);
    expect(duplicated, 'block types documented in two family files').toEqual([]);
    expect(unknown, 'family-file headings not in BLOCK_TYPES').toEqual([]);
  });

  it('family files are selection sheets, not field references', () => {
    // The CLI prints the contract; the files stay short enough to read whole.
    for (const file of familyFiles) {
      const lines = readFileSync(join(BLOCKS_DIR, file), 'utf8').split('\n').length;
      const cap = file === 'architecture.md' ? 95 : 75;
      expect(lines, `${file} is ${lines} lines; cap ${cap}`).toBeLessThanOrEqual(cap);
    }
  });

  it('INDEX.md maps every block type to an existing family file', () => {
    const index = readFileSync(join(BLOCKS_DIR, 'INDEX.md'), 'utf8');
    for (const t of BLOCK_TYPES) {
      expect(index, `INDEX.md row for \`${t}\``).toMatch(
        new RegExp(`^\\| \`${t}\` \\| \`[a-z-]+\\.md\` \\|`, 'm'),
      );
    }
    for (const file of index.matchAll(/\| `([a-z-]+\.md)` \|/g)) {
      expect(familyFiles, `INDEX.md points at ${file[1]}`).toContain(file[1]);
    }
    for (const alias of Object.keys(BLOCK_ALIASES)) {
      expect(index, `INDEX.md must not map alias \`${alias}\` to a family file`).not.toMatch(
        new RegExp(`^\\| \`${alias}\` \\| \`[a-z-]+\\.md\` \\|`, 'm'),
      );
    }
  });

  it('INDEX.md carries the alias → canonical table', () => {
    const index = readFileSync(join(BLOCKS_DIR, 'INDEX.md'), 'utf8');
    for (const [alias, def] of Object.entries(BLOCK_ALIASES)) {
      expect(index, `INDEX.md alias row for \`${alias}\` → \`${def.type}\``).toMatch(
        new RegExp(`^\\| \`${alias}\` \\| \`${def.type}\` \\|`, 'm'),
      );
    }
  });

  it('skill count strings match BLOCK_TYPES.length (drift guard)', () => {
    const n = BLOCK_TYPES.length;
    const skill = readFileSync(join(SKILL_DIR, 'SKILL.md'), 'utf8');
    expect(skill).toContain(`${n} block types`);
    expect(skill).toContain(`lists all ${n}`);
    const index = readFileSync(join(BLOCKS_DIR, 'INDEX.md'), 'utf8');
    expect(index).toContain(`# The ${n} block types`);
  });

  it('no skill file points at the deleted contract.md or the old install paths', () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory()
          ? walk(join(dir, e.name))
          : e.name.endsWith('.md')
            ? [join(dir, e.name)]
            : [],
      );
    for (const f of walk(SKILL_DIR)) {
      const md = readFileSync(f, 'utf8');
      expect(md, `${f} mentions contract.md`).not.toContain('contract.md');
      expect(md, `${f} mentions .chiltepin/skill`).not.toContain('.chiltepin/skill');
      expect(md, `${f} mentions chiltepin install`).not.toContain('chiltepin install');
      expect(md, `${f} mentions chiltepin template`).not.toContain('chiltepin template');
    }
  });

  it('every family file and INDEX is in the canonical stitch list', () => {
    const listed = SKILL_REFERENCE_FILES.filter((f) => f.includes('reference/blocks/')).map((f) =>
      f.slice(f.lastIndexOf('/') + 1),
    );
    expect([...listed].sort()).toEqual([...familyFiles, 'INDEX.md'].sort());
  });

  it('recipes.md and style-ste.md sit in the stitch list, in order', () => {
    const lastFamily = Math.max(
      ...SKILL_REFERENCE_FILES.flatMap((f, i) => (f.includes('reference/blocks/') ? [i] : [])),
    );
    expect(SKILL_REFERENCE_FILES[lastFamily + 1]).toBe('reference/recipes.md');
    const idx = (f: string): number => SKILL_REFERENCE_FILES.indexOf(`reference/${f}`);
    expect(idx('style-ste.md')).toBeGreaterThan(idx('intake.md'));
    expect(idx('style-ste.md')).toBe(idx('organizing.md') + 1);
  });

  it('every listed reference file exists', () => {
    for (const f of SKILL_REFERENCE_FILES) {
      expect(existsSync(join(SKILL_DIR, f)), `missing ${f}`).toBe(true);
    }
  });
});
