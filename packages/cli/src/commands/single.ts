/**
 * Single-document export shortcuts behind `avo html` / `avo slides` / `avo pdf`.
 * Each renders one doc, applying the project theme (`avodado.theme.json`), and
 * writes a single output file (defaulting next to the input).
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, parse as parsePath, resolve } from 'node:path';
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
}

/** Renders `opts.input` to `opts.format` and writes it. */
export async function runSingle(opts: {
  readonly cwd: string;
  readonly input: string;
  readonly output?: string;
  readonly format: SingleFormat;
}): Promise<SingleResult> {
  const inputAbs = resolve(opts.cwd, opts.input);
  const source = await readFile(inputAbs, 'utf8');
  const doc = parseDocument(source, parsePath(inputAbs).name);

  const { theme, themeVars } = loadTheme(opts.cwd);
  const themeOpts = {
    ...(theme !== undefined ? { theme: theme as ThemeName } : {}),
    ...(themeVars !== undefined ? { themeVars } : {}),
  };

  const outputAbs =
    opts.output !== undefined
      ? resolve(opts.cwd, opts.output)
      : inputAbs.replace(/\.md$/i, `.${EXT[opts.format]}`);
  await mkdir(dirname(outputAbs), { recursive: true });

  if (opts.format === 'pdf') {
    const pdf = await toPdf(renderDocument(doc, themeOpts));
    await writeFile(outputAbs, pdf);
    return { output: outputAbs, bytes: pdf.byteLength };
  }
  const html = opts.format === 'slides' ? toSlides(doc, themeOpts) : renderDocument(doc, themeOpts);
  await writeFile(outputAbs, html, 'utf8');
  return { output: outputAbs, bytes: html.length };
}
