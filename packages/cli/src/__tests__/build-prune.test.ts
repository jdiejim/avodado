/**
 * W-5 — `avo build` must remove the outputs it no longer generates, and
 * nothing else.
 *
 * The rule under test: a build deletes only files the *previous* build recorded
 * in `dist/.avodado-build.json`. A file a user put in the output directory was
 * never in that manifest, so it survives; an output directory with no manifest
 * (an older Avodado's `dist/`) is left completely alone.
 */

import { describe, expect, it } from 'vitest';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { runBuild } from '../commands/build.js';
import { MANIFEST_FILE, readManifest } from '../io/manifest.js';

async function project(): Promise<{ root: string; cleanup: () => Promise<void> }> {
  const root = join(tmpdir(), `avo-prune-${randomBytes(6).toString('hex')}`);
  await mkdir(join(root, 'docs', 'guides'), { recursive: true });
  await writeFile(join(root, 'docs/keep.md'), '```meta\ntitle: Keep\n```\n');
  await writeFile(join(root, 'docs/goner.md'), '```meta\ntitle: Goner\n```\n');
  await writeFile(join(root, 'docs/guides/nested.md'), '```meta\ntitle: Nested\n```\n');
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) };
}

describe('avo build prune', () => {
  it('removes the pages of a deleted doc on the next build', async () => {
    const { root, cleanup } = await project();
    try {
      const first = await runBuild({ cwd: root });
      expect(first.removed).toEqual([]);
      expect(existsSync(join(root, 'dist/goner.html'))).toBe(true);
      expect(existsSync(join(root, 'dist/goner.slides.html'))).toBe(true);

      await rm(join(root, 'docs/goner.md'));
      const second = await runBuild({ cwd: root });
      expect(second.removed).toEqual(['goner.html', 'goner.slides.html']);
      expect(existsSync(join(root, 'dist/goner.html'))).toBe(false);
      expect(existsSync(join(root, 'dist/goner.slides.html'))).toBe(false);
      // Everything still generated stays.
      expect(existsSync(join(root, 'dist/keep.html'))).toBe(true);
      expect(existsSync(join(root, 'dist/index.html'))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it('removes a nested doc and the directory it emptied, but keeps the out dir', async () => {
    const { root, cleanup } = await project();
    try {
      await runBuild({ cwd: root });
      expect(existsSync(join(root, 'dist/guides/nested.html'))).toBe(true);
      await rm(join(root, 'docs/guides'), { recursive: true });
      const second = await runBuild({ cwd: root });
      expect(second.removed).toEqual(['guides/nested.html', 'guides/nested.slides.html']);
      expect(existsSync(join(root, 'dist/guides'))).toBe(false);
      expect(existsSync(join(root, 'dist'))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it('never touches a file the user put in the output directory', async () => {
    const { root, cleanup } = await project();
    try {
      await runBuild({ cwd: root });
      await writeFile(join(root, 'dist/CNAME'), 'docs.example.com\n');
      await mkdir(join(root, 'dist/assets'), { recursive: true });
      await writeFile(join(root, 'dist/assets/logo.svg'), '<svg/>');
      await rm(join(root, 'docs/goner.md'));

      const second = await runBuild({ cwd: root });
      expect(second.removed).toEqual(['goner.html', 'goner.slides.html']);
      expect(await readFile(join(root, 'dist/CNAME'), 'utf8')).toBe('docs.example.com\n');
      expect(existsSync(join(root, 'dist/assets/logo.svg'))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it('degrades gracefully on a dist from a pre-manifest Avodado: prunes nothing, says so', async () => {
    const { root, cleanup } = await project();
    try {
      // A dist built by an older version: pages, no manifest.
      await mkdir(join(root, 'dist'), { recursive: true });
      await writeFile(join(root, 'dist/ancient.html'), '<p>from an older build</p>');
      const first = await runBuild({ cwd: root });
      expect(first.removed).toEqual([]);
      expect(first.pruneDeferred).toBe(true);
      expect(existsSync(join(root, 'dist/ancient.html'))).toBe(true);

      // From the next build on, the manifest exists and pruning works — but it
      // still only covers what *this* generation wrote, so the orphan stays.
      await rm(join(root, 'docs/goner.md'));
      const second = await runBuild({ cwd: root });
      expect(second.pruneDeferred).toBe(false);
      expect(second.removed).toEqual(['goner.html', 'goner.slides.html']);
      expect(existsSync(join(root, 'dist/ancient.html'))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it('a corrupt manifest is treated as no manifest (prune nothing, rewrite it)', async () => {
    const { root, cleanup } = await project();
    try {
      await runBuild({ cwd: root });
      await writeFile(join(root, 'dist', MANIFEST_FILE), '{ not json');
      await rm(join(root, 'docs/goner.md'));
      const second = await runBuild({ cwd: root });
      expect(second.removed).toEqual([]);
      expect(existsSync(join(root, 'dist/goner.html'))).toBe(true);
      const manifest = await readManifest(join(root, 'dist'));
      expect(manifest?.files).toContain('keep.html');
    } finally {
      await cleanup();
    }
  });

  it('a manifest entry pointing outside the out dir is ignored', async () => {
    const { root, cleanup } = await project();
    try {
      await runBuild({ cwd: root });
      await writeFile(join(root, 'docs/keep.md'), '```meta\ntitle: Keep\n```\n'); // unchanged
      await writeFile(
        join(root, 'dist', MANIFEST_FILE),
        JSON.stringify({ version: 1, generator: 'x', files: ['../docs/keep.md'] }),
      );
      const second = await runBuild({ cwd: root });
      expect(second.removed).toEqual([]);
      expect(existsSync(join(root, 'docs/keep.md'))).toBe(true);
    } finally {
      await cleanup();
    }
  });
});
