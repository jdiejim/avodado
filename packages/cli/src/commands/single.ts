/**
 * Single-document export shortcuts behind `avo html` / `avo slides` / `avo pdf`.
 * Each renders one doc, applying the project theme (`avodado.theme.json`), and
 * writes a single output file (defaulting next to the input).
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join, parse as parsePath, resolve } from 'node:path';
import open from 'open';
import { parseDocument } from '@avodado/core';
import { renderDocument, type ThemeName } from '@avodado/render';
import { toSlides, toPdf } from '@avodado/export';
import { loadTheme } from '../io/theme.js';

export type SingleFormat = 'html' | 'slides' | 'pdf';

const EXT: Readonly<Record<SingleFormat, string>> = {
  html: 'html',
  slides: 'slides.html',
  pdf: 'pdf',
};

export interface SingleResult {
  readonly output: string;
  readonly bytes: number;
  readonly opened: boolean;
}

/** Renders `opts.input` to `opts.format` and writes it (or previews it). */
export async function runSingle(opts: {
  readonly cwd: string;
  readonly input: string;
  readonly output?: string;
  readonly format: SingleFormat;
  readonly preview?: boolean;
}): Promise<SingleResult> {
  const inputAbs = resolve(opts.cwd, opts.input);
  const source = await readFile(inputAbs, 'utf8');
  const slug = parsePath(inputAbs).name;
  const doc = parseDocument(source, slug);

  const { theme, themeVars } = loadTheme(opts.cwd);
  const themeOpts = {
    ...(theme !== undefined ? { theme: theme as ThemeName } : {}),
    ...(themeVars !== undefined ? { themeVars } : {}),
  };

  // Preview → a stable temp file (reused across runs); otherwise next to input.
  let outputAbs: string;
  if (opts.preview === true) {
    const hash = createHash('sha1').update(inputAbs).digest('hex').slice(0, 8);
    const dir = join(tmpdir(), 'avodado-preview');
    await mkdir(dir, { recursive: true });
    outputAbs = join(dir, `${slug}-${hash}.${EXT[opts.format]}`);
  } else {
    outputAbs =
      opts.output !== undefined
        ? resolve(opts.cwd, opts.output)
        : inputAbs.replace(/\.md$/i, `.${EXT[opts.format]}`);
    await mkdir(dirname(outputAbs), { recursive: true });
  }

  let bytes: number;
  if (opts.format === 'pdf') {
    // Auto-download the matching Chromium on first use, so `avo pdf` just works.
    const pdf = await toPdf(renderDocument(doc, themeOpts), {
      autoInstallBrowser: true,
      log: (m) => console.error(m),
    });
    await writeFile(outputAbs, pdf);
    bytes = pdf.byteLength;
  } else {
    const html = opts.format === 'slides' ? toSlides(doc, themeOpts) : renderDocument(doc, themeOpts);
    await writeFile(outputAbs, html, 'utf8');
    bytes = html.length;
  }

  if (opts.preview === true) await open(outputAbs);
  return { output: outputAbs, bytes, opened: opts.preview === true };
}
