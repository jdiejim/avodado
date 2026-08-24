import { describe, expect, it } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { runCheck } from '../commands/check.js';
import { kebabSuggestion } from '../commands/conventions.js';

async function tempProject(files: Record<string, string>): Promise<{
  root: string;
  cleanup: () => Promise<void>;
}> {
  const root = join(tmpdir(), `avo-conventions-${randomBytes(6).toString('hex')}`);
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(root, rel);
    await mkdir(join(abs, '..'), { recursive: true });
    await writeFile(abs, content);
  }
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) };
}

const DOC = 'A short doc.\n';

const conventionsIn = (
  diags: readonly { code: string; file: string }[],
): readonly { code: string; file: string }[] => diags.filter((d) => d.code === 'W_DOC_CONVENTION');

describe('runCheck on-disk convention (W_DOC_CONVENTION)', () => {
  it('warns on a non-kebab-case filename without affecting the exit code', async () => {
    const { root, cleanup } = await tempProject({ 'docs/My_Doc.md': DOC });
    try {
      const result = await runCheck({ patterns: ['docs/**/*.md'], cwd: root, docsRoot: 'docs' });
      const found = result.diagnostics.filter((d) => d.code === 'W_DOC_CONVENTION');
      expect(found).toHaveLength(1);
      expect(found[0]?.level).toBe('warn');
      expect(found[0]?.message).toContain('My_Doc.md');
      expect(found[0]?.message).toContain('kebab-case');
      expect(found[0]?.hint).toContain('my-doc.md');
      expect(result.exitCode).toBe(0);
    } finally {
      await cleanup();
    }
  });

  it('warns when a doc sits deeper than docs/<area>/<doc>.md', async () => {
    const { root, cleanup } = await tempProject({ 'docs/guides/setup/install.md': DOC });
    try {
      const result = await runCheck({ patterns: ['docs/**/*.md'], cwd: root, docsRoot: 'docs' });
      const found = result.diagnostics.filter((d) => d.code === 'W_DOC_CONVENTION');
      expect(found).toHaveLength(1);
      expect(found[0]?.level).toBe('warn');
      expect(found[0]?.message).toContain('one group level');
      expect(result.exitCode).toBe(0);
    } finally {
      await cleanup();
    }
  });

  it('does not warn on docs/<area>/<doc>.md or the docs root', async () => {
    const { root, cleanup } = await tempProject({
      'docs/guides/a.md': DOC,
      'docs/overview.md': DOC,
    });
    try {
      const result = await runCheck({ patterns: ['docs/**/*.md'], cwd: root, docsRoot: 'docs' });
      expect(conventionsIn(result.diagnostics)).toHaveLength(0);
    } finally {
      await cleanup();
    }
  });

  it('does not warn about files outside the docs root', async () => {
    const { root, cleanup } = await tempProject({
      'resources/x.md': DOC,
      'resources/Not_Kebab.md': DOC,
    });
    try {
      const result = await runCheck({
        patterns: ['resources/*.md'],
        cwd: root,
        docsRoot: 'docs',
      });
      expect(conventionsIn(result.diagnostics)).toHaveLength(0);
      expect(result.exitCode).toBe(0);
    } finally {
      await cleanup();
    }
  });

  it('is not escalated by --strict-prose', async () => {
    const { root, cleanup } = await tempProject({ 'docs/My_Doc.md': DOC });
    try {
      const result = await runCheck({
        patterns: ['docs/**/*.md'],
        cwd: root,
        docsRoot: 'docs',
        strictProse: true,
      });
      const found = result.diagnostics.find((d) => d.code === 'W_DOC_CONVENTION');
      expect(found?.level).toBe('warn');
      expect(result.exitCode).toBe(0);
    } finally {
      await cleanup();
    }
  });
});

describe('kebabSuggestion', () => {
  it('suggests kebab-case names', () => {
    expect(kebabSuggestion('My_Doc.md')).toBe('my-doc.md');
    expect(kebabSuggestion('GettingStarted.md')).toBe('getting-started.md');
    expect(kebabSuggestion('api doc v2.md')).toBe('api-doc-v2.md');
    expect(kebabSuggestion('notes.draft.md')).toBe('notes-draft.md');
  });
});
