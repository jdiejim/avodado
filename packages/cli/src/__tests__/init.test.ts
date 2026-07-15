import { describe, expect, it } from 'vitest';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import fg from 'fast-glob';
import { parseDocument, validateDocument, type Diagnostic } from '@avodado/core';
import { runInit, installTool, stubSkill } from '../commands/init.js';

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
  it('scaffolds the diet tree: one canonical skill + pointer stubs, ≤30 files for all tools', async () => {
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

      // init diet: all four tools land in at most 30 files, none skipped
      expect(result.created.length).toBeLessThanOrEqual(30);
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
      expect(result.created).not.toContain('.cursor/rules/avodado.mdc');
      // one tool: base (22) + claude (3) = 25 files
      expect(result.created.length).toBe(25);
      expect(existsSync(join(root, '.github/agents/avodado-doc-writer.agent.md'))).toBe(false);
      expect(existsSync(join(root, '.windsurfrules'))).toBe(false);

      const { root: root2, cleanup: cleanup2 } = await tempDir();
      try {
        const r2 = await runInit({ cwd: root2, tools: ['cursor', 'windsurf'] });
        // rule-file tools get exactly one pointer file each — no skill dirs
        expect(r2.created).toContain('.cursor/rules/avodado.mdc');
        expect(r2.created).toContain('.windsurfrules');
        expect(r2.created.length).toBe(24); // base 22 + 1 + 1
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
      // canonical skill (19) + claude adapter (3)
      expect(result.created.length).toBe(22);
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
