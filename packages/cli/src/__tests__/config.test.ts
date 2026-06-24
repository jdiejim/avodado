import { describe, expect, it } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { loadConfig } from '../io/config.js';

async function tempDir(): Promise<{ root: string; cleanup: () => Promise<void> }> {
  const root = join(tmpdir(), `avo-config-${randomBytes(6).toString('hex')}`);
  await mkdir(root, { recursive: true });
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) };
}

describe('loadConfig', () => {
  it('returns defaults when no config file exists', async () => {
    const { root, cleanup } = await tempDir();
    try {
      const cfg = await loadConfig(root);
      expect(cfg).toEqual({ docsDir: 'docs', outDir: 'dist' });
    } finally {
      await cleanup();
    }
  });

  it('reads avodado.config.json and merges with defaults', async () => {
    const { root, cleanup } = await tempDir();
    try {
      await writeFile(join(root, 'avodado.config.json'), JSON.stringify({ docsDir: 'pages' }));
      const cfg = await loadConfig(root);
      expect(cfg).toEqual({ docsDir: 'pages', outDir: 'dist' });
    } finally {
      await cleanup();
    }
  });

  it('reads avodado.config.yml', async () => {
    const { root, cleanup } = await tempDir();
    try {
      await writeFile(join(root, 'avodado.config.yml'), 'docsDir: site\noutDir: build\n');
      const cfg = await loadConfig(root);
      expect(cfg).toEqual({ docsDir: 'site', outDir: 'build' });
    } finally {
      await cleanup();
    }
  });
});
