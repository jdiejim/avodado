/**
 * `avo preview` — render a single doc to a temp HTML file and open it in the
 * default browser.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, parse as parsePath, resolve } from 'node:path';
import open from 'open';
import { parseDocument } from '@avodado/core';
import { renderDocument } from '@avodado/render';

export interface PreviewOptions {
  readonly input: string;
  readonly cwd: string;
}

export interface PreviewResult {
  readonly file: string;
}

/**
 * Renders the doc to a temp file (named by a hash of the source path so
 * repeated previews reuse the same file) and opens it in the OS browser.
 */
export async function runPreview(opts: PreviewOptions): Promise<PreviewResult> {
  const inputAbs = resolve(opts.cwd, opts.input);
  const source = await readFile(inputAbs, 'utf8');
  const slug = parsePath(inputAbs).name;
  const doc = parseDocument(source, slug);
  const html = renderDocument(doc);

  const hash = createHash('sha1').update(inputAbs).digest('hex').slice(0, 8);
  const dir = join(tmpdir(), 'avodado-preview');
  await mkdir(dir, { recursive: true });
  const out = join(dir, `${slug}-${hash}.html`);
  await writeFile(out, html, 'utf8');
  await open(out);
  return { file: out };
}
