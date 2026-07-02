/**
 * `avo build` — render every doc into a static HTML site on disk.
 *
 * Loads config (docsDir/outDir), docs, and the project theme, builds the site
 * via {@link buildSite}, and writes `index.html` plus one page per doc under
 * the out directory (nested slugs keep their directories).
 *
 * Diagnostics are returned for the CLI to print as **warnings** — `avo build`
 * always exits 0 on a build that writes; `avo check` remains the CI gate.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { parseDocument, type Diagnostic } from '@avodado/core';
import type { ThemeName } from '@avodado/render';
import { loadConfig } from '../io/config.js';
import { loadDocs } from '../io/files.js';
import { loadTheme } from '../io/theme.js';
import { buildSite, type SiteDoc } from './site.js';

/** Inputs to {@link runBuild}. */
export interface BuildOptions {
  /** Project root. */
  readonly cwd: string;
  /** Output directory override (defaults to config `outDir`). */
  readonly out?: string;
}

/** Result of {@link runBuild}. */
export interface BuildResult {
  /** Absolute output directory. */
  readonly outDir: string;
  /** Output directory relative to cwd (for display). */
  readonly outDirRel: string;
  /** Written pages with byte sizes. */
  readonly pages: readonly { readonly path: string; readonly bytes: number }[];
  /** Schema + ref diagnostics (print as warnings; build still succeeds). */
  readonly diagnostics: readonly Diagnostic[];
  /** Always 0 — `avo check` is the gate. */
  readonly exitCode: number;
}

/** Builds the docs site and writes it under the out directory. */
export async function runBuild(opts: BuildOptions): Promise<BuildResult> {
  const config = await loadConfig(opts.cwd);
  const outDir = resolve(opts.cwd, opts.out ?? config.outDir);
  const files = await loadDocs([`${config.docsDir}/**/*.md`], opts.cwd, config.docsDir);
  const docs: SiteDoc[] = files.map((f) => ({
    slug: f.slug,
    file: f.file,
    doc: parseDocument(f.source, f.slug),
  }));

  const { theme, themeVars } = loadTheme(opts.cwd);
  const site = buildSite(docs, {
    ...(theme !== undefined ? { theme: theme as ThemeName } : {}),
    ...(themeVars !== undefined ? { themeVars } : {}),
  });

  const pages: { path: string; bytes: number }[] = [];
  for (const page of site.pages) {
    const abs = join(outDir, page.path);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, page.html, 'utf8');
    pages.push({ path: page.path, bytes: page.html.length });
  }

  return {
    outDir,
    outDirRel: relative(opts.cwd, outDir) || '.',
    pages,
    diagnostics: site.diagnostics,
    exitCode: 0,
  };
}
