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
  it('scaffolds base files + all adapters by default', async () => {
    const { root, cleanup } = await tempDir();
    try {
      const result = await runInit({ cwd: root });
      expect(result.created).toEqual([
        'avodado.config.json',
        'docs/getting-started.md',
        '.avodado/skill/SKILL.md',
        'CLAUDE.md',
        '.cursor/rules/avodado.mdc',
        '.github/copilot-instructions.md',
        '.windsurfrules',
      ]);
      expect(result.skipped).toEqual([]);
      // verify the scaffold actually wrote real content
      const config = await readFile(join(root, 'avodado.config.json'), 'utf8');
      expect(JSON.parse(config)).toMatchObject({ docsDir: 'docs', outDir: 'dist' });
      const skill = await readFile(join(root, '.avodado/skill/SKILL.md'), 'utf8');
      expect(skill).toContain('avodado-docs');
      const claude = await readFile(join(root, 'CLAUDE.md'), 'utf8');
      expect(claude).toContain('Avodado');
      const copilot = await readFile(join(root, '.github/copilot-instructions.md'), 'utf8');
      expect(copilot).toContain('Avodado');
      expect(existsSync(join(root, '.windsurfrules'))).toBe(true);
      // default theme (minimal) writes no theme file
      expect(existsSync(join(root, 'avodado.theme.json'))).toBe(false);
    } finally {
      await cleanup();
    }
  });

  it('writes only the selected AI-tool adapters', async () => {
    const { root, cleanup } = await tempDir();
    try {
      const result = await runInit({ cwd: root, tools: ['claude'] });
      expect(result.created).toContain('CLAUDE.md');
      expect(result.created).not.toContain('.cursor/rules/avodado.mdc');
      expect(result.created).not.toContain('.github/copilot-instructions.md');
      expect(existsSync(join(root, '.windsurfrules'))).toBe(false);
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
        expect(custom.theme).toBe('minimal');
        expect(custom.colors).toEqual({});
      } finally {
        await cleanup2();
      }
    } finally {
      await cleanup();
    }
  });

  it('scaffolded docs/getting-started.md validates clean', async () => {
    const { root, cleanup } = await tempDir();
    try {
      await runInit({ cwd: root });
      const md = await readFile(join(root, 'docs/getting-started.md'), 'utf8');
      const doc = parseDocument(md, 'getting-started');
      const diags = validateDocument(doc, 'docs/getting-started.md');
      expect(diags).toEqual([]);
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
