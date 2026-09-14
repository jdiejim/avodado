import { describe, expect, it } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { loadConfig } from '../io/config.js';

async function tempDir(): Promise<{ root: string; cleanup: () => Promise<void> }> {
  const root = join(tmpdir(), `chiltepin-config-${randomBytes(6).toString('hex')}`);
  await mkdir(root, { recursive: true });
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) };
}

describe('loadConfig', () => {
  it('returns defaults when no config file exists', async () => {
    const { root, cleanup } = await tempDir();
    try {
      const cfg = await loadConfig(root);
      expect(cfg).toEqual({
        docsDir: 'docs',
        outDir: 'dist',
        richIndex: true,
        colorScheme: 'dark',
      });
    } finally {
      await cleanup();
    }
  });

  it('reads chiltepin.config.json and merges with defaults', async () => {
    const { root, cleanup } = await tempDir();
    try {
      await writeFile(join(root, 'chiltepin.config.json'), JSON.stringify({ docsDir: 'pages' }));
      const cfg = await loadConfig(root);
      expect(cfg).toEqual({
        docsDir: 'pages',
        outDir: 'dist',
        richIndex: true,
        colorScheme: 'dark',
      });
    } finally {
      await cleanup();
    }
  });

  it('reads richIndex: false from chiltepin.config.json (absent = on)', async () => {
    const { root, cleanup } = await tempDir();
    try {
      await writeFile(join(root, 'chiltepin.config.json'), JSON.stringify({ richIndex: false }));
      const cfg = await loadConfig(root);
      expect(cfg).toEqual({
        docsDir: 'docs',
        outDir: 'dist',
        richIndex: false,
        colorScheme: 'dark',
      });
    } finally {
      await cleanup();
    }
  });

  it('reads chiltepin.config.yml', async () => {
    const { root, cleanup } = await tempDir();
    try {
      await writeFile(join(root, 'chiltepin.config.yml'), 'docsDir: site\noutDir: build\n');
      const cfg = await loadConfig(root);
      expect(cfg).toEqual({
        docsDir: 'site',
        outDir: 'build',
        richIndex: true,
        colorScheme: 'dark',
      });
    } finally {
      await cleanup();
    }
  });

  it('still reads the legacy avodado.config.json, but chiltepin.config.* wins when both exist', async () => {
    const { root, cleanup } = await tempDir();
    try {
      await writeFile(join(root, 'avodado.config.json'), JSON.stringify({ docsDir: 'old' }));
      const legacy = await loadConfig(root);
      expect(legacy.docsDir).toBe('old');
      await writeFile(join(root, 'chiltepin.config.json'), JSON.stringify({ docsDir: 'new' }));
      const current = await loadConfig(root);
      expect(current.docsDir).toBe('new');
    } finally {
      await cleanup();
    }
  });
});
