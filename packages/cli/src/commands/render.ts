/**
 * `avo render` — render one document to a standalone HTML file.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, parse as parsePath, resolve } from 'node:path';
import { parseDocument } from '@avodado/core';
import { renderDocument, type ThemeName } from '@avodado/render';
import { loadTheme } from '../io/theme.js';

export interface RenderOptions {
  /** Input doc path. */
  readonly input: string;
  /** Output path. Defaults to `<input>.html` next to the input. */
  readonly output?: string;
  /** Working directory. */
  readonly cwd: string;
}

/** Result of a render. */
export interface RenderResult {
  readonly input: string;
  readonly output: string;
  readonly bytes: number;
}

/**
 * Reads `opts.input`, parses + renders it, and writes the resulting HTML.
 *
 * @returns The output path and byte size written.
 */
export async function runRender(opts: RenderOptions): Promise<RenderResult> {
  const inputAbs = resolve(opts.cwd, opts.input);
  const source = await readFile(inputAbs, 'utf8');
  const slug = parsePath(inputAbs).name;
  const doc = parseDocument(source, slug);
  const { theme, themeVars } = loadTheme(opts.cwd);
  const html = renderDocument(doc, {
    ...(theme !== undefined ? { theme: theme as ThemeName } : {}),
    ...(themeVars !== undefined ? { themeVars } : {}),
  });

  const outputAbs = opts.output !== undefined ? resolve(opts.cwd, opts.output) : inputAbs.replace(/\.md$/i, '.html');
  await mkdir(dirname(outputAbs), { recursive: true });
  await writeFile(outputAbs, html, 'utf8');
  return { input: opts.input, output: outputAbs, bytes: html.length };
}
