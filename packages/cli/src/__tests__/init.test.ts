import { describe, expect, it } from 'vitest';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import fg from 'fast-glob';
import { parseDocument, validateDocument, type Diagnostic } from '@avodado/core';
import {
  runInit,
  installTool,
  stubSkill,
  stitchSkill,
  annotateIndex,
  templatesDir,
  EXEMPLAR_FILES,
} from '../commands/init.js';

async function tempDir(): Promise<{ root: string; cleanup: () => Promise<void> }> {
  const root = join(tmpdir(), `avo-init-${randomBytes(6).toString('hex')}`);
  await mkdir(root, { recursive: true });
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) };
}

/** Extracts the YAML frontmatter block (`---\n…\n---\n`) from a skill file. */
function frontmatterOf(md: string): string {
  const m = /^---\n[\s\S]*?\n---\n/.exec(md);
  expect(m, 'file should start with YAML frontmatter').not.toBeNull();
  return (m as RegExpExecArray)[0];
}

/**
 * Diagnostics that should fail a "validates clean" gate. Alias spellings are
 * valid forever and emit only the informational `W_ALIAS_TYPE` warning
 * (warnings never fail `avo check`) — everything else still counts.
 */
const failing = (diags: readonly Diagnostic[]): readonly Diagnostic[] =>
  diags.filter((d) => !(d.code === 'W_ALIAS_TYPE' && d.level === 'warn'));

describe('runInit', () => {
  it('scaffolds the diet tree: one canonical skill + pointer stubs, ≤43 files for all tools', async () => {
    const { root, cleanup } = await tempDir();
    try {
      const result = await runInit({ cwd: root });

      // base files — the whole skill folder lives ONCE, at .avodado/skill/
      for (const f of [
        'avodado.config.json',
        'docs/getting-started.md',
        'docs/tutorial.md',
        '.avodado/skill/SKILL.md',
        '.avodado/skill/reference/blocks/INDEX.md',
        '.avodado/skill/reference/blocks/contract.md',
        '.avodado/skill/reference/blocks/flows.md',
        '.avodado/skill/reference/blocks/agentic.md',
        '.avodado/skill/reference/system-design.md',
        '.avodado/skill/reference/decks.md',
        '.avodado/skill/reference/intake.md',
        '.avodado/skill/reference/organizing.md',
      ]) {
        expect(result.created).toContain(f);
      }

      // per-tool adapters: pointer stubs / rule pointers, no skill copies
      for (const f of [
        'CLAUDE.md',
        '.claude/skills/avodado-docs/SKILL.md',
        '.claude/agents/avodado-doc-writer.md',
        '.claude/commands/avo.md',
        '.cursor/rules/avodado.mdc',
        '.github/copilot-instructions.md',
        '.github/skills/avodado-docs/SKILL.md',
        '.github/agents/avodado-doc-writer.agent.md',
        '.windsurfrules',
      ]) {
        expect(result.created).toContain(f);
      }

      // the skill is NOT duplicated into any tool dir anymore
      expect(result.created).not.toContain('.claude/skills/avodado-docs/reference/blocks/INDEX.md');
      expect(result.created).not.toContain('.cursor/skills/avodado-docs/SKILL.md');
      expect(result.created).not.toContain('.github/skills/avodado-docs/reference/intake.md');
      expect(result.created).not.toContain('.windsurf/skills/avodado-docs/SKILL.md');
      expect(result.created).not.toContain('.github/prompts/avodado-docs.prompt.md');

      // the 10 exemplars ride along with the skill
      for (const f of EXEMPLAR_FILES) expect(result.created).toContain(f);

      // init diet: all four tools land in at most 43 files, none skipped
      // (base 24 + 10 exemplars + 9 adapter files)
      expect(result.created.length).toBeLessThanOrEqual(43);
      expect(result.skipped).toEqual([]);

      // exactly ONE contract.md exists on disk — the canonical one
      const contracts = await fg('**/contract.md', { cwd: root, dot: true });
      expect(contracts).toEqual(['.avodado/skill/reference/blocks/contract.md']);
      // …and exactly three SKILL.md files: canonical + the two stubs
      const skills = (await fg('**/SKILL.md', { cwd: root, dot: true })).sort();
      expect(skills).toEqual([
        '.avodado/skill/SKILL.md',
        '.claude/skills/avodado-docs/SKILL.md',
        '.github/skills/avodado-docs/SKILL.md',
      ]);

      // config has no dead $schema URL
      const config = await readFile(join(root, 'avodado.config.json'), 'utf8');
      expect(config).not.toContain('$schema');
      expect(JSON.parse(config)).toMatchObject({ docsDir: 'docs', outDir: 'dist' });

      // agent frontmatter
      const claudeAgent = await readFile(join(root, '.claude/agents/avodado-doc-writer.md'), 'utf8');
      expect(claudeAgent).toContain('name: avodado-doc-writer');
      expect(existsSync(join(root, 'avodado.theme.json'))).toBe(false);
    } finally {
      await cleanup();
    }
  });

  it('stub frontmatter is pinned verbatim to the canonical skill (mcp-vendoring pattern)', async () => {
    const { root, cleanup } = await tempDir();
    try {
      await runInit({ cwd: root, tools: ['claude', 'copilot'] });
      const canonical = await readFile(join(root, '.avodado/skill/SKILL.md'), 'utf8');
      for (const stubPath of [
        '.claude/skills/avodado-docs/SKILL.md',
        '.github/skills/avodado-docs/SKILL.md',
      ]) {
        const stub = await readFile(join(root, stubPath), 'utf8');
        // Frontmatter byte-identical (both stamped with the same version) —
        // discovery/trigger text can never drift from the canonical skill.
        expect(frontmatterOf(stub), stubPath).toBe(frontmatterOf(canonical));
        // The 5-line pointer body sends the agent to the single on-disk skill.
        expect(stub).toContain('.avodado/skill/SKILL.md');
        expect(stub).toContain('reference/');
        // A stub is a pointer, not a copy — no authoring grammar inside.
        expect(stub).not.toContain('The one rule');
      }
      // the generator itself pins to the template's frontmatter
      const generated = await stubSkill();
      expect(generated.startsWith('---\n')).toBe(true);
      expect(generated).toContain('.avodado/skill/SKILL.md');
    } finally {
      await cleanup();
    }
  });

  it('writes only the selected tools (cursor/windsurf are single pointer files)', async () => {
    const { root, cleanup } = await tempDir();
    try {
      const result = await runInit({ cwd: root, tools: ['claude'] });
      expect(result.created).toContain('CLAUDE.md');
      expect(result.created).toContain('.claude/skills/avodado-docs/SKILL.md');
      expect(result.created).toContain('.claude/agents/avodado-doc-writer.md');
      expect(result.created).toContain('.claude/commands/avo.md');
      expect(result.created).not.toContain('.cursor/rules/avodado.mdc');
      // one tool: base (24 + 10 exemplars = 34) + claude (4) = 38 files
      expect(result.created.length).toBe(38);
      // the /avo slash command installs and opens with YAML frontmatter
      const avoCmd = await readFile(join(root, '.claude/commands/avo.md'), 'utf8');
      expect(avoCmd.startsWith('---')).toBe(true);
      expect(existsSync(join(root, '.github/agents/avodado-doc-writer.agent.md'))).toBe(false);
      expect(existsSync(join(root, '.windsurfrules'))).toBe(false);

      const { root: root2, cleanup: cleanup2 } = await tempDir();
      try {
        const r2 = await runInit({ cwd: root2, tools: ['cursor', 'windsurf'] });
        // rule-file tools get exactly one pointer file each — no skill dirs
        expect(r2.created).toContain('.cursor/rules/avodado.mdc');
        expect(r2.created).toContain('.windsurfrules');
        expect(r2.created.length).toBe(36); // base 34 + 1 + 1
        expect(existsSync(join(root2, '.cursor/skills'))).toBe(false);
        expect(existsSync(join(root2, '.windsurf'))).toBe(false);
      } finally {
        await cleanup2();
      }
    } finally {
      await cleanup();
    }
  });

  it('avo install refreshes the canonical skill + the tool stub, version-stamped', async () => {
    const { root, cleanup } = await tempDir();
    try {
      const result = await installTool({ cwd: root, tool: 'claude' });
      // canonical skill (21) + exemplars (10) + claude adapter (4)
      expect(result.created.length).toBe(35);
      expect(result.created).toContain('.claude/commands/avo.md');
      expect(result.created).toContain('.avodado/skill/SKILL.md');
      expect(result.created).toContain('.avodado/skill/reference/blocks/contract.md');
      expect(result.created).toContain('.claude/skills/avodado-docs/SKILL.md');
      const canonical = await readFile(join(root, '.avodado/skill/SKILL.md'), 'utf8');
      const stub = await readFile(join(root, '.claude/skills/avodado-docs/SKILL.md'), 'utf8');
      // stampSkillVersion covers canonical + stub alike
      expect(canonical).toMatch(/^version: \d+\.\d+\.\d+$/m);
      expect(frontmatterOf(stub)).toBe(frontmatterOf(canonical));
    } finally {
      await cleanup();
    }
  });

  it('scaffolds avodado.theme.json for a non-default or custom theme', async () => {
    const { root, cleanup } = await tempDir();
    try {
      await runInit({ cwd: root, theme: 'dark' });
      const theme = JSON.parse(await readFile(join(root, 'avodado.theme.json'), 'utf8')) as {
        theme: string;
      };
      expect(theme.theme).toBe('dark');

      const { root: root2, cleanup: cleanup2 } = await tempDir();
      try {
        await runInit({ cwd: root2, customTheme: true });
        const custom = JSON.parse(await readFile(join(root2, 'avodado.theme.json'), 'utf8')) as {
          theme: string;
          colors: unknown;
        };
        expect(custom.theme).toBe('textbook');
        expect(custom.colors).toEqual({});
      } finally {
        await cleanup2();
      }
    } finally {
      await cleanup();
    }
  });

  it('scaffolded tutorial + getting-started docs validate clean', async () => {
    const { root, cleanup } = await tempDir();
    try {
      await runInit({ cwd: root });
      for (const slug of ['getting-started', 'tutorial']) {
        const md = await readFile(join(root, `docs/${slug}.md`), 'utf8');
        const doc = parseDocument(md, slug);
        const diags = validateDocument(doc, `docs/${slug}.md`);
        expect(failing(diags), `${slug} should have no diagnostics`).toEqual([]);
      }
    } finally {
      await cleanup();
    }
  });

  it('skips existing files unless --force', async () => {
    const { root, cleanup } = await tempDir();
    try {
      const first = await runInit({ cwd: root });
      const second = await runInit({ cwd: root });
      expect(second.created).toEqual([]);
      expect(second.skipped.length).toBe(first.created.length);
    } finally {
      await cleanup();
    }
  });
});

describe('tailored install (--scope)', () => {
  const FAM = (f: string): string => `.avodado/skill/reference/blocks/${f}.md`;
  const ALWAYS = [
    '.avodado/skill/SKILL.md',
    '.avodado/skill/reference/blocks/INDEX.md',
    '.avodado/skill/reference/blocks/contract.md',
    '.avodado/skill/reference/recipes.md',
    '.avodado/skill/reference/system-design.md',
    '.avodado/skill/reference/decks.md',
    '.avodado/skill/reference/intake.md',
    '.avodado/skill/reference/organizing.md',
    '.avodado/skill/reference/style-ste.md',
  ];

  it('backend scope drops design-system + algorithms only; INDEX is annotated; config records it', async () => {
    const { root, cleanup } = await tempDir();
    try {
      const result = await runInit({ cwd: root, tools: ['claude'], scope: 'backend' });

      for (const f of ALWAYS) expect(result.created).toContain(f);
      for (const f of EXEMPLAR_FILES) expect(result.created).toContain(f);
      for (const fam of ['narrative', 'tables-data', 'api', 'architecture', 'flows', 'data-model', 'charts-overviews', 'planning', 'business', 'agentic']) {
        expect(result.created, `backend keeps ${fam}`).toContain(FAM(fam));
      }
      for (const fam of ['design-system', 'algorithms']) {
        expect(result.created, `backend drops ${fam}`).not.toContain(FAM(fam));
        expect(existsSync(join(root, FAM(fam)))).toBe(false);
      }
      // full claude init is 38; backend drops exactly 2 family files
      expect(result.created.length).toBe(36);

      // the INSTALLED index marks the omitted families — the template never does
      const index = await readFile(join(root, '.avodado/skill/reference/blocks/INDEX.md'), 'utf8');
      expect(index).toContain('`design-system.md` (not installed — `avo install <tool> --full` adds it)');
      expect(index).toContain('`algorithms.md` (not installed — `avo install <tool> --full` adds it)');
      expect(index).not.toContain('`agentic.md` (not installed');

      const config = JSON.parse(await readFile(join(root, 'avodado.config.json'), 'utf8')) as Record<string, unknown>;
      expect(config['skillScope']).toBe('backend');
    } finally {
      await cleanup();
    }
  });

  it('frontend + product scopes drop their families; exemplars always install', async () => {
    const { root, cleanup } = await tempDir();
    try {
      const r = await runInit({ cwd: root, tools: [], scope: 'frontend' });
      for (const fam of ['api', 'data-model', 'algorithms', 'agentic']) {
        expect(r.created, `frontend drops ${fam}`).not.toContain(FAM(fam));
      }
      expect(r.created).toContain(FAM('design-system'));
      for (const f of EXEMPLAR_FILES) expect(r.created).toContain(f);

      const { root: root2, cleanup: cleanup2 } = await tempDir();
      try {
        const p = await runInit({ cwd: root2, tools: [], scope: 'product' });
        for (const fam of ['narrative', 'tables-data', 'charts-overviews', 'planning', 'business', 'flows']) {
          expect(p.created, `product keeps ${fam}`).toContain(FAM(fam));
        }
        for (const fam of ['api', 'architecture', 'data-model', 'design-system', 'algorithms', 'agentic']) {
          expect(p.created, `product drops ${fam}`).not.toContain(FAM(fam));
        }
        for (const f of EXEMPLAR_FILES) expect(p.created).toContain(f);
      } finally {
        await cleanup2();
      }
    } finally {
      await cleanup();
    }
  });

  it('avo install reuses the recorded scope; --full restores everything and clears it', async () => {
    const { root, cleanup } = await tempDir();
    try {
      await runInit({ cwd: root, tools: ['claude'], scope: 'backend' });

      // update path without --full: still backend-scoped
      const update = await installTool({ cwd: root, tool: 'claude' });
      expect(update.created).not.toContain(FAM('design-system'));
      expect(existsSync(join(root, FAM('design-system')))).toBe(false);

      // --full: every family lands, the annotation goes away, the scope is cleared
      const full = await installTool({ cwd: root, tool: 'claude', full: true });
      expect(full.created).toContain(FAM('design-system'));
      expect(full.created).toContain(FAM('algorithms'));
      expect(existsSync(join(root, FAM('design-system')))).toBe(true);
      const index = await readFile(join(root, '.avodado/skill/reference/blocks/INDEX.md'), 'utf8');
      expect(index).not.toContain('(not installed');
      const config = JSON.parse(await readFile(join(root, 'avodado.config.json'), 'utf8')) as Record<string, unknown>;
      expect('skillScope' in config).toBe(false);

      // a later plain install stays full
      const again = await installTool({ cwd: root, tool: 'claude' });
      expect(again.created).toContain(FAM('design-system'));
    } finally {
      await cleanup();
    }
  });

  it('annotateIndex is the identity for full scope', () => {
    const md = '| `c4` | `architecture.md` | C4 model |\n';
    expect(annotateIndex(md, 'full')).toBe(md);
    expect(annotateIndex(md, 'product')).toContain(
      '`architecture.md` (not installed — `avo install <tool> --full` adds it)',
    );
  });
});

describe('exemplars stay out of the stitch and the MCP embed', () => {
  it('stitchSkill() output carries no exemplar file content', async () => {
    const stitched = await stitchSkill();
    expect(stitched).not.toContain('placeholder: filled by concurrent builder');
    // No exemplar body leaks into the single-file form (the hub may *mention*
    // the folder — the files themselves must not be stitched in).
    for (const f of EXEMPLAR_FILES) {
      const md = await readFile(join(templatesDir(), f), 'utf8');
      const longest = md.split('\n').reduce((a, b) => (b.length > a.length ? b : a), '');
      if (longest.length > 40) {
        expect(stitched, `${f} leaked into the stitch`).not.toContain(longest);
      }
    }
  });

  it('the MCP embed script lists exactly the stitch files — no exemplars', async () => {
    const script = await readFile(
      join(import.meta.dirname, '../../../mcp/scripts/embed-skill.mjs'),
      'utf8',
    );
    expect(script).not.toContain('exemplar');
  });
});
