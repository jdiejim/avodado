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
  it('scaffolds all expected files into an empty directory', async () => {
    const { root, cleanup } = await tempDir();
    try {
      const result = await runInit({ cwd: root });
      expect(result.created).toEqual([
        'avodado.config.json',
        'docs/getting-started.md',
        'CLAUDE.md',
        '.cursor/rules/avodado.mdc',
        '.avodado/skill/SKILL.md',
      ]);
      expect(result.skipped).toEqual([]);
      // verify the scaffold actually wrote real content
      const config = await readFile(join(root, 'avodado.config.json'), 'utf8');
      expect(JSON.parse(config)).toMatchObject({ docsDir: 'docs', outDir: 'dist' });
      const skill = await readFile(join(root, '.avodado/skill/SKILL.md'), 'utf8');
      expect(skill).toContain('avodado-docs');
      const claude = await readFile(join(root, 'CLAUDE.md'), 'utf8');
      expect(claude).toContain('Avodado');
      const cursor = await readFile(join(root, '.cursor/rules/avodado.mdc'), 'utf8');
      expect(cursor).toContain('Avodado');
      expect(existsSync(join(root, 'docs/getting-started.md'))).toBe(true);
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
      await runInit({ cwd: root });
      const second = await runInit({ cwd: root });
      expect(second.created).toEqual([]);
      expect(second.skipped.length).toBe(5);
    } finally {
      await cleanup();
    }
  });
});
