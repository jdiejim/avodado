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
  const root = join(tmpdir(), `avo-density-${randomBytes(6).toString('hex')}`);
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(root, rel);
    await mkdir(join(abs, '..'), { recursive: true });
    await writeFile(abs, content);
  }
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) };
}

/** A kanban with 9 columns — one over the 8-column budget. */
const denseKanban = `\`\`\`kanban
columns:
${Array.from({ length: 9 }, (_, i) => `  - { label: C${i} }`).join('\n')}
\`\`\`
`;

describe('runCheck density budgets', () => {
  it('surfaces W_DENSE_BLOCK as a warning without affecting the exit code', async () => {
    const { root, cleanup } = await tempProject({ 'docs/board.md': denseKanban });
    try {
      const result = await runCheck({ patterns: ['docs/**/*.md'], cwd: root, docsRoot: 'docs' });
      const dense = result.diagnostics.find((d) => d.code === 'W_DENSE_BLOCK');
      expect(dense).toBeDefined();
      expect(dense?.level).toBe('warn');
      expect(dense?.message).toContain('9 columns');
      expect(dense?.message).toContain('8');
      expect(result.exitCode).toBe(0);
    } finally {
      await cleanup();
    }
  });

  it('is not escalated by --strict-prose', async () => {
    const { root, cleanup } = await tempProject({ 'docs/board.md': denseKanban });
    try {
      const result = await runCheck({
        patterns: ['docs/**/*.md'],
        cwd: root,
        docsRoot: 'docs',
        strictProse: true,
      });
      const dense = result.diagnostics.find((d) => d.code === 'W_DENSE_BLOCK');
      expect(dense?.level).toBe('warn');
      expect(result.exitCode).toBe(0);
    } finally {
      await cleanup();
    }
  });
});
