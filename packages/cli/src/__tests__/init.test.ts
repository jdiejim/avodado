import { describe, expect, it } from 'vitest';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { parseDocument, validateDocument } from '@avodado/core';
import { runInit } from '../commands/init.js';

async function tempDir(): Promise<{ root: string; cleanup: () => Promise<void> }> {
  const root = join(tmpdir(), `avo-init-${randomBytes(6).toString('hex')}`);
  await mkdir(root, { recursive: true });
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) };
}

describe('runInit', () => {
  it('scaffolds base files + all tool config (instructions, skill, agents) by default', async () => {
    const { root, cleanup } = await tempDir();
    try {
      const result = await runInit({ cwd: root });
      // base files
      for (const f of ['avodado.config.json', 'docs/getting-started.md', '.avodado/skill/SKILL.md']) {
        expect(result.created).toContain(f);
      }
      // the one canonical skill, installed into every tool's native skill location
      for (const f of [
        '.claude/skills/avodado-docs/SKILL.md',
        '.cursor/skills/avodado-docs/SKILL.md',
        '.windsurf/skills/avodado-docs/SKILL.md',
        '.github/prompts/avodado-docs.prompt.md',
      ]) {
        expect(result.created).toContain(f);
      }
      // agents only where the tool has an agent format
      expect(result.created).toContain('.claude/agents/avodado-doc-writer.md');
      expect(result.created).toContain('.github/agents/avodado-doc-writer.agent.md');
      expect(result.skipped).toEqual([]);

      // the per-tool skills are byte-identical to the canonical skill
      const canonical = await readFile(join(root, '.avodado/skill/SKILL.md'), 'utf8');
      const claudeSkill = await readFile(join(root, '.claude/skills/avodado-docs/SKILL.md'), 'utf8');
      const cursorSkill = await readFile(join(root, '.cursor/skills/avodado-docs/SKILL.md'), 'utf8');
      expect(claudeSkill).toBe(canonical);
      expect(cursorSkill).toBe(canonical);

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

  it('writes only the selected tools', async () => {
    const { root, cleanup } = await tempDir();
    try {
      const result = await runInit({ cwd: root, tools: ['claude'] });
      expect(result.created).toContain('CLAUDE.md');
      expect(result.created).toContain('.claude/skills/avodado-docs/SKILL.md');
      expect(result.created).toContain('.claude/agents/avodado-doc-writer.md');
      expect(result.created).not.toContain('.cursor/rules/avodado.mdc');
      expect(existsSync(join(root, '.github/agents/avodado-doc-writer.agent.md'))).toBe(false);
      expect(existsSync(join(root, '.windsurf/skills/avodado-docs/SKILL.md'))).toBe(false);
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
        expect(diags, `${slug} should have no diagnostics`).toEqual([]);
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
