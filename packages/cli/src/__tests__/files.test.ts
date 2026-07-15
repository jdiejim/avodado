import { describe, expect, it } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { loadDocs } from '../io/files.js';

async function tempProject(): Promise<{ root: string; cleanup: () => Promise<void> }> {
  const root = join(tmpdir(), `avo-files-${randomBytes(6).toString('hex')}`);
  await mkdir(join(root, 'docs/sub'), { recursive: true });
  await writeFile(join(root, 'docs/a.md'), '# A\n');
  await writeFile(join(root, 'docs/sub/b.md'), '# B\n');
  await writeFile(join(root, 'README.md'), '# Root\n');
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) };
}

describe('loadDocs', () => {
  it('expands a glob and derives slugs relative to docs root', async () => {
    const { root, cleanup } = await tempProject();
    try {
      const docs = await loadDocs(['docs/**/*.md'], root, 'docs');
      expect(docs).toHaveLength(2);
      const slugs = docs.map((d) => d.slug).sort();
      expect(slugs).toEqual(['a', 'sub/b']);
      expect(docs[0]?.source).toContain('# A');
    } finally {
      await cleanup();
    }
  });

  it('falls back to basename when the file is outside docs root', async () => {
    const { root, cleanup } = await tempProject();
    try {
      const docs = await loadDocs(['README.md'], root, 'docs');
      expect(docs).toHaveLength(1);
      expect(docs[0]?.slug).toBe('README');
    } finally {
      await cleanup();
    }
  });

  it('returns results sorted by file path', async () => {
    const { root, cleanup } = await tempProject();
    try {
      const docs = await loadDocs(['docs/**/*.md'], root, 'docs');
      const files = docs.map((d) => d.file);
      expect(files).toEqual([...files].sort());
    } finally {
      await cleanup();
    }
  });
});
