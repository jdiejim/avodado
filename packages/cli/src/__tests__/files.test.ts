import { describe, expect, it } from 'vitest';
import { mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { decodeUtf8, encodingDiagnostics, loadDocs } from '../io/files.js';
import { runCheck } from '../commands/check.js';

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

  // W-6 — a `docs/loop -> .` symlink used to load the same file under dozens
  // of slugs, inventing duplicate-id errors that no source file contains.
  it('does not descend a symlink cycle under the docs root', async () => {
    const { root, cleanup } = await tempProject();
    try {
      await symlink('.', join(root, 'docs/loop'));
      const docs = await loadDocs(['docs/**/*.md'], root, 'docs');
      expect(docs.map((d) => d.slug).sort()).toEqual(['a', 'sub/b']);
    } finally {
      await cleanup();
    }
  });
});

// B-2 — a file that is not UTF-8 used to pass `avo check` clean.
describe('UTF-8 enforcement', () => {
  it('decodeUtf8 accepts UTF-8 and strips a UTF-8 BOM', () => {
    expect(decodeUtf8(Buffer.from('# Fine — é\n', 'utf8'))).toEqual({ source: '# Fine — é\n' });
    const withBom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('# Fine\n')]);
    expect(decodeUtf8(withBom).source).toBe('# Fine\n');
    expect(decodeUtf8(withBom).encodingError).toBeUndefined();
  });

  it('decodeUtf8 rejects UTF-16/32 byte order marks and invalid byte sequences', () => {
    const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('# U\n', 'utf16le')]);
    expect(decodeUtf8(utf16).encodingError).toContain('UTF-16 LE');
    expect(decodeUtf8(utf16).source).toBe('');

    const bad = Buffer.concat([Buffer.from('# Bad\n\n'), Buffer.from([0xff, 0x80, 0xfe, 0x0a])]);
    const result = decodeUtf8(bad);
    expect(result.encodingError).toContain('not UTF-8');
    expect(result.encodingLine).toBe(3);
    expect(result.source).toBe('');

    // Truncated multi-byte sequence at end of file.
    expect(decodeUtf8(Buffer.from([0xe2, 0x82])).encodingError).toContain('not UTF-8');
    // Surrogate half encoded as UTF-8 (CESU-8) is not valid UTF-8 either.
    expect(decodeUtf8(Buffer.from([0xed, 0xa0, 0x80])).encodingError).toContain('not UTF-8');
  });

  it('avo check reports E_ENCODING and names the file instead of validating mojibake', async () => {
    const root = join(tmpdir(), `avo-enc-${randomBytes(6).toString('hex')}`);
    await mkdir(join(root, 'docs'), { recursive: true });
    await writeFile(join(root, 'docs/ok.md'), '```meta\ntitle: OK\n```\n');
    await writeFile(
      join(root, 'docs/badbytes.md'),
      Buffer.concat([Buffer.from('# Bad\n\n'), Buffer.from([0xff, 0x80, 0xfe, 0x0a])]),
    );
    await writeFile(
      join(root, 'docs/utf16.md'),
      Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('# Utf16\n', 'utf16le')]),
    );
    try {
      const result = await runCheck({ patterns: ['docs/**/*.md'], cwd: root, docsRoot: 'docs' });
      expect(result.exitCode).toBe(1);
      const encoding = result.diagnostics.filter((d) => d.code === 'E_ENCODING');
      expect(encoding.map((d) => d.file).sort()).toEqual([
        'docs/badbytes.md',
        'docs/utf16.md',
      ]);
      expect(encoding.every((d) => d.level === 'error')).toBe(true);
      expect(encoding.some((d) => d.message.includes('UTF-16 LE'))).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('encodingDiagnostics is empty for a clean doc set', async () => {
    const { root, cleanup } = await tempProject();
    try {
      expect(encodingDiagnostics(await loadDocs(['docs/**/*.md'], root, 'docs'))).toEqual([]);
    } finally {
      await cleanup();
    }
  });
});
