import { describe, expect, it } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { runCheck } from '../commands/check.js';

async function tempProject(files: Record<string, string>): Promise<{
  root: string;
  cleanup: () => Promise<void>;
}> {
  const root = join(tmpdir(), `avo-check-${randomBytes(6).toString('hex')}`);
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(root, rel);
    await mkdir(join(abs, '..'), { recursive: true });
    await writeFile(abs, content);
  }
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) };
}

describe('runCheck', () => {
  it('returns exitCode 0 for a clean doc', async () => {
    const { root, cleanup } = await tempProject({
      'docs/ok.md': '```meta\ntitle: OK\n```\n\nProse.\n',
    });
    try {
      const result = await runCheck({ patterns: ['docs/**/*.md'], cwd: root, docsRoot: 'docs' });
      expect(result.exitCode).toBe(0);
      expect(result.diagnostics).toEqual([]);
      expect(result.files).toEqual(['docs/ok.md']);
    } finally {
      await cleanup();
    }
  });

  it('returns exitCode 1 for a schema violation', async () => {
    const { root, cleanup } = await tempProject({
      'docs/bad.md': '```callout\nkind: invalid\n```\n',
    });
    try {
      const result = await runCheck({ patterns: ['docs/**/*.md'], cwd: root, docsRoot: 'docs' });
      expect(result.exitCode).toBe(1);
      expect(result.diagnostics.some((d) => d.code === 'E_SCHEMA')).toBe(true);
      // Points at the offending `kind:` line (2), not the fence (1).
      expect(result.diagnostics[0]?.line).toBe(2);
      expect(result.diagnostics[0]?.file).toContain('bad.md');
    } finally {
      await cleanup();
    }
  });

  it('returns exitCode 1 for a dangling reference', async () => {
    const { root, cleanup } = await tempProject({
      'docs/orders.md':
        '```userstory\nrole: u\nwant: w\nsoThat: t\nlinks:\n  - { ref: "#missing", label: x }\n```\n',
    });
    try {
      const result = await runCheck({ patterns: ['docs/**/*.md'], cwd: root, docsRoot: 'docs' });
      expect(result.exitCode).toBe(1);
      const dangling = result.diagnostics.find((d) => d.code === 'E_DANGLING_REF');
      expect(dangling).toBeDefined();
      expect(dangling?.value).toBe('#missing');
    } finally {
      await cleanup();
    }
  });

  it('returns exitCode 1 for a duplicate id across docs', async () => {
    const { root, cleanup } = await tempProject({
      'docs/a.md': '```sequence\nid: dup\nactors: []\nmessages: []\n```\n',
      'docs/b.md': '```erd\nid: dup\nentities: []\nrelations: []\n```\n',
    });
    try {
      const result = await runCheck({ patterns: ['docs/**/*.md'], cwd: root, docsRoot: 'docs' });
      expect(result.exitCode).toBe(1);
      const dup = result.diagnostics.find((d) => d.code === 'E_DUP_ID');
      expect(dup).toBeDefined();
      expect(dup?.value).toBe('dup');
      expect(dup?.message).toContain('a.md');
    } finally {
      await cleanup();
    }
  });

  it('sorts diagnostics by file then line', async () => {
    const { root, cleanup } = await tempProject({
      'docs/a.md': '\n\n```callout\nkind: invalid\n```\n',
      'docs/b.md': '```callout\nkind: invalid\n```\n',
    });
    try {
      const result = await runCheck({ patterns: ['docs/**/*.md'], cwd: root, docsRoot: 'docs' });
      const sorted = [...result.diagnostics].sort((x, y) => {
        const f = x.file.localeCompare(y.file);
        return f !== 0 ? f : (x.line ?? 0) - (y.line ?? 0);
      });
      expect(result.diagnostics).toEqual(sorted);
    } finally {
      await cleanup();
    }
  });
});
