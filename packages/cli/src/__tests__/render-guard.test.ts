/**
 * B-3 — a renderer that throws must name the document and the block, and must
 * not take the whole build down.
 *
 * The documents here are built as models, not parsed from Markdown, so the
 * test does not depend on which values the schemas currently reject: the
 * contract is "ANY renderer failure names its document", whatever caused it.
 */

import { describe, expect, it } from 'vitest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import type { Document } from '@avodado/core';
import { buildSite, type SiteDoc } from '../commands/site.js';
import { failingBlock, renderFailure } from '../commands/renderGuard.js';
import { runBuild } from '../commands/build.js';

/**
 * A document whose second block makes its renderer throw: `saga` reads
 * `steps[].service.length`, and this step has no `service`.
 */
function docWithFailingBlock(slug: string): Document {
  return {
    slug,
    meta: { title: 'Boom' },
    segments: [
      { kind: 'markdown', text: '# Boom\n', line: 1 },
      {
        kind: 'saga',
        raw: 'steps:\n  - { id: a, name: A }',
        data: { steps: [{ id: 'a', name: 'A' }] },
        line: 5,
        id: 'the-saga',
      },
    ],
  };
}

const okDoc = (slug: string, title: string): Document => ({
  slug,
  meta: { title },
  segments: [{ kind: 'markdown', text: `# ${title}\n`, line: 1 }],
});

describe('render failure attribution', () => {
  it('finds the block that throws', () => {
    const block = failingBlock(docWithFailingBlock('boom'));
    expect(block?.kind).toBe('saga');
    expect(block?.line).toBe(5);
  });

  it('builds a diagnostic naming the file, the line, and the block type', () => {
    const d = renderFailure(
      docWithFailingBlock('boom'),
      'docs/boom.md',
      'page',
      new RangeError('Invalid string length'),
    );
    expect(d.code).toBe('E_RENDER');
    expect(d.level).toBe('error');
    expect(d.file).toBe('docs/boom.md');
    expect(d.line).toBe(5);
    expect(d.message).toContain('`saga`');
    expect(d.message).toContain('Invalid string length');
    expect(d.value).toBe('the-saga');
  });

  it('reports a document-level failure when no single block reproduces it', () => {
    const d = renderFailure(okDoc('fine', 'Fine'), 'docs/fine.md', 'page', new Error('boom'));
    expect(d.code).toBe('E_RENDER');
    expect(d.line).toBeUndefined();
    expect(d.message).toContain('boom');
  });
});

describe('buildSite with a failing renderer', () => {
  const docs: SiteDoc[] = [
    { slug: 'ok', file: 'docs/ok.md', doc: okDoc('ok', 'Fine doc') },
    { slug: 'boom', file: 'docs/boom.md', doc: docWithFailingBlock('boom') },
  ];

  it('contains the failure: names it, keeps the URLs, and still builds the others', () => {
    const site = buildSite(docs);
    const render = site.diagnostics.filter((d) => d.code === 'E_RENDER');
    expect(render).toHaveLength(1);
    expect(render[0]?.file).toBe('docs/boom.md');
    expect(render[0]?.message).toContain('`saga`');

    const paths = site.pages.map((p) => p.path);
    expect(paths).toContain('index.html');
    expect(paths).toContain('ok.html');
    expect(paths).toContain('boom.html');
    expect(paths).toContain('boom.slides.html');

    // The good document rendered for real…
    expect(site.pages.find((p) => p.path === 'ok.html')?.html).toContain('Fine doc');
    // …and the failed one is a placeholder that repeats the message.
    const failed = site.pages.find((p) => p.path === 'boom.html')?.html ?? '';
    expect(failed).toContain('Render failed');
    expect(failed).toContain('docs/boom.md');
  });
});

describe('avo build with a failing renderer', () => {
  it('finishes the build, exits non-zero, and names the document', async () => {
    const root = join(tmpdir(), `avo-render-${randomBytes(6).toString('hex')}`);
    await mkdir(join(root, 'docs'), { recursive: true });
    await writeFile(join(root, 'docs/ok.md'), '```meta\ntitle: Fine\n```\n');
    // Schema-invalid (a `saga` step with no `service`) — `avo build` renders
    // anyway, and the renderer throws on it.
    await writeFile(
      join(root, 'docs/boom.md'),
      '```meta\ntitle: Boom\n```\n\n```saga\nsteps:\n  - { id: a, name: A }\n```\n',
    );
    try {
      const result = await runBuild({ cwd: root });
      expect(result.exitCode).toBe(1);
      const render = result.diagnostics.filter((d) => d.code === 'E_RENDER');
      expect(render).toHaveLength(1);
      expect(render[0]?.file).toBe('docs/boom.md');
      expect(render[0]?.message).toContain('`saga`');
      // The rest of the site is on disk.
      expect(existsSync(join(root, 'dist/ok.html'))).toBe(true);
      expect(existsSync(join(root, 'dist/index.html'))).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
