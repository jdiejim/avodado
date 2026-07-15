import { describe, expect, it } from 'vitest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { projectStatus, formatStatus } from '../commands/status.js';

async function scratchProject(): Promise<{ root: string; cleanup: () => Promise<void> }> {
  const root = join(tmpdir(), `avo-status-${randomBytes(6).toString('hex')}`);
  await mkdir(join(root, 'docs'), { recursive: true });
  await writeFile(join(root, 'avodado.config.json'), '{ "docsDir": "docs", "outDir": "dist" }\n');
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) };
}

describe('projectStatus (smart bare `avo`)', () => {
  it('counts docs and reports a clean quick-validate', async () => {
    const { root, cleanup } = await scratchProject();
    try {
      await writeFile(join(root, 'docs', 'a.md'), '```meta\ntitle: A\n```\n');
      await writeFile(join(root, 'docs', 'b.md'), '```meta\ntitle: B\n```\n');
      const status = await projectStatus(root);
      expect(status.docCount).toBe(2);
      expect(status.errors).toBe(0);
      expect(status.docsDir).toBe('docs');
      // exact value depends on a possible machine-global theme — just non-empty
      expect(status.theme.length).toBeGreaterThan(0);

      const text = formatStatus(status, true);
      expect(text).toContain('2 document(s)');
      expect(text).toContain('clean');
      // the 4-5 next actions, with one-liners
      for (const cmd of ['avo check', 'avo <file.md>', 'avo studio', 'avo build', 'avo explore']) {
        expect(text).toContain(cmd);
      }
    } finally {
      await cleanup();
    }
  });

  it('surfaces validate errors and points at avo check', async () => {
    const { root, cleanup } = await scratchProject();
    try {
      await writeFile(
        join(root, 'docs', 'bad.md'),
        '```userstory\nrole: u\nwant: w\nsoThat: t\nlinks:\n  - { ref: "#missing", label: x }\n```\n',
      );
      const status = await projectStatus(root);
      expect(status.errors).toBeGreaterThan(0);
      const text = formatStatus(status, true);
      expect(text).toContain('error(s)');
      expect(text).toContain('run avo check');
    } finally {
      await cleanup();
    }
  });
});
