/**
 * W-4 — a command that writes to a path the user named must not destroy the
 * file that is already there.
 *
 * Every case runs in its own temp directory; nothing here touches the repo's
 * `docs/` or `dist/`.
 */

import { describe, expect, it } from 'vitest';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { overwriteRefusal, writeFileSafe, OverwriteRefusedError } from '../io/write.js';
import { runSyncCsv, runSyncOpenApi, runSyncSchema } from '../commands/sync.js';
import { writeNewDoc } from '../commands/new.js';
import { runSingle } from '../commands/single.js';

async function temp(): Promise<{ root: string; cleanup: () => Promise<void> }> {
  const root = join(tmpdir(), `avo-write-${randomBytes(6).toString('hex')}`);
  await mkdir(root, { recursive: true });
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) };
}

const PRECIOUS = '# PRECIOUS\n\nHand-written content that must not vanish.\n';

describe('overwriteRefusal', () => {
  it('allows a path that does not exist', async () => {
    const { root, cleanup } = await temp();
    try {
      expect(overwriteRefusal(join(root, 'new.md'))).toBeUndefined();
    } finally {
      await cleanup();
    }
  });

  it('refuses an existing file, naming the file and the flag', async () => {
    const { root, cleanup } = await temp();
    try {
      const p = join(root, 'kept.md');
      await writeFile(p, PRECIOUS);
      const refusal = overwriteRefusal(p);
      expect(refusal).toContain(p);
      expect(refusal).toContain('--force');
      expect(refusal).toContain('refusing to overwrite');
    } finally {
      await cleanup();
    }
  });

  it('allows an existing file with --force, or when the command regenerates that extension', async () => {
    const { root, cleanup } = await temp();
    try {
      const md = join(root, 'kept.md');
      const html = join(root, 'out.html');
      await writeFile(md, PRECIOUS);
      await writeFile(html, '<p>old export</p>');
      expect(overwriteRefusal(md, { force: true })).toBeUndefined();
      expect(overwriteRefusal(html, { regenerates: ['.html'] })).toBeUndefined();
      // …but the same command still refuses to write HTML over a document.
      expect(overwriteRefusal(md, { regenerates: ['.html'] })).toBeDefined();
    } finally {
      await cleanup();
    }
  });

  it('writeFileSafe throws instead of clobbering', async () => {
    const { root, cleanup } = await temp();
    try {
      const p = join(root, 'kept.md');
      await writeFile(p, PRECIOUS);
      await expect(writeFileSafe(p, 'new')).rejects.toBeInstanceOf(OverwriteRefusedError);
      expect(await readFile(p, 'utf8')).toBe(PRECIOUS);
      await writeFileSafe(p, 'new', { force: true });
      expect(await readFile(p, 'utf8')).toBe('new');
    } finally {
      await cleanup();
    }
  });
});

describe('avo sync --out (W-4)', () => {
  it('sql: refuses to overwrite a hand-written doc, and leaves it byte-identical', async () => {
    const { root, cleanup } = await temp();
    try {
      await writeFile(join(root, 'schema.sql'), 'CREATE TABLE users (id uuid PRIMARY KEY);\n');
      await mkdir(join(root, 'docs'), { recursive: true });
      await writeFile(join(root, 'docs/precious.md'), PRECIOUS);

      const result = await runSyncSchema({
        cwd: root,
        file: 'schema.sql',
        dialect: 'sql',
        out: 'docs/precious.md',
      });
      expect(result.exitCode).toBe(1);
      expect(result.message).toContain('docs/precious.md');
      expect(result.message).toContain('--force');
      expect(result.outPath).toBeUndefined();
      expect(await readFile(join(root, 'docs/precious.md'), 'utf8')).toBe(PRECIOUS);

      // --force is the explicit opt-in.
      const forced = await runSyncSchema({
        cwd: root,
        file: 'schema.sql',
        dialect: 'sql',
        out: 'docs/precious.md',
        force: true,
      });
      expect(forced.exitCode).toBe(0);
      expect(await readFile(join(root, 'docs/precious.md'), 'utf8')).toContain('```erd');
    } finally {
      await cleanup();
    }
  });

  it('csv: refuses to overwrite an existing doc', async () => {
    const { root, cleanup } = await temp();
    try {
      await writeFile(join(root, 'sales.csv'), 'month,units\nJan,4\n');
      await writeFile(join(root, 'sales.md'), PRECIOUS);
      const result = await runSyncCsv({ cwd: root, file: 'sales.csv', out: 'sales.md' });
      expect(result.exitCode).toBe(1);
      expect(result.message).toContain('--force');
      expect(await readFile(join(root, 'sales.md'), 'utf8')).toBe(PRECIOUS);
    } finally {
      await cleanup();
    }
  });

  it('openapi: refuses to overwrite an existing doc', async () => {
    const { root, cleanup } = await temp();
    try {
      await writeFile(
        join(root, 'api.json'),
        JSON.stringify({ openapi: '3.0.0', info: { title: 'A', version: '1' }, paths: {} }),
      );
      await writeFile(join(root, 'api.md'), PRECIOUS);
      const result = await runSyncOpenApi({ cwd: root, spec: 'api.json', out: 'api.md' });
      expect(result.exitCode).toBe(1);
      expect(result.message).toContain('--force');
      expect(await readFile(join(root, 'api.md'), 'utf8')).toBe(PRECIOUS);
    } finally {
      await cleanup();
    }
  });
});

describe('avo new / block / template -o', () => {
  it('refuses to write a template over an existing document', async () => {
    const { root, cleanup } = await temp();
    try {
      await writeFile(join(root, 'adr.md'), PRECIOUS);
      await expect(writeNewDoc({ cwd: root, type: 'adr', out: 'adr.md' })).rejects.toThrow(
        /--force/,
      );
      expect(await readFile(join(root, 'adr.md'), 'utf8')).toBe(PRECIOUS);
      await writeNewDoc({ cwd: root, type: 'adr', out: 'adr.md', force: true });
      expect(await readFile(join(root, 'adr.md'), 'utf8')).not.toBe(PRECIOUS);
    } finally {
      await cleanup();
    }
  });
});

describe('avo html -o', () => {
  it('re-exports over its own .html output, but refuses to render over a document', async () => {
    const { root, cleanup } = await temp();
    try {
      const input = join(root, 'doc.md');
      await writeFile(input, '```meta\ntitle: Doc\n```\n');
      const out = join(root, 'out.html');
      await runSingle({ cwd: root, input, format: 'html', output: out });
      // Second export to the same .html path is the normal loop — allowed.
      await runSingle({ cwd: root, input, format: 'html', output: out });

      await writeFile(join(root, 'notes.md'), PRECIOUS);
      await expect(
        runSingle({ cwd: root, input, format: 'html', output: join(root, 'notes.md') }),
      ).rejects.toThrow(/--force/);
      expect(await readFile(join(root, 'notes.md'), 'utf8')).toBe(PRECIOUS);
    } finally {
      await cleanup();
    }
  });
});
