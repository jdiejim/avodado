/**
 * `avo export` — batch-export one or more documents to HTML and/or PDF.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseDocument } from '@avodado/core';
import { toHtml, toPdf, toSlides } from '@avodado/export';
import { loadDocs } from '../io/files.js';

export type ExportFormat = 'html' | 'pdf' | 'slides';

export interface ExportOptions {
  readonly patterns: readonly string[];
  readonly cwd: string;
  readonly docsRoot: string;
  readonly outDir: string;
  readonly formats: readonly ExportFormat[];
}

export interface ExportItem {
  readonly file: string;
  readonly outputs: readonly { format: ExportFormat; path: string; bytes: number }[];
}

export interface ExportResult {
  readonly items: readonly ExportItem[];
}

/**
 * Reads, parses, and renders each matched document into one or more output
 * formats under `outDir`. Filenames mirror the doc's slug.
 */
export async function runExport(opts: ExportOptions): Promise<ExportResult> {
  const docs = await loadDocs(opts.patterns, opts.cwd, opts.docsRoot);
  const outRoot = resolve(opts.cwd, opts.outDir);
  await mkdir(outRoot, { recursive: true });

  const items: ExportItem[] = [];
  for (const d of docs) {
    const doc = parseDocument(d.source, d.slug);
    const outputs: { format: ExportFormat; path: string; bytes: number }[] = [];
    for (const fmt of opts.formats) {
      const ext = fmt === 'slides' ? 'slides.html' : fmt;
      const outPath = join(outRoot, `${d.slug}.${ext}`);
      await mkdir(resolve(outPath, '..'), { recursive: true });
      if (fmt === 'html') {
        const html = toHtml(doc);
        await writeFile(outPath, html, 'utf8');
        outputs.push({ format: fmt, path: outPath, bytes: html.length });
      } else if (fmt === 'slides') {
        const html = toSlides(doc);
        await writeFile(outPath, html, 'utf8');
        outputs.push({ format: fmt, path: outPath, bytes: html.length });
      } else {
        const pdf = await toPdf(doc, { autoInstallBrowser: true, log: (m) => console.error(m) });
        await writeFile(outPath, pdf);
        outputs.push({ format: fmt, path: outPath, bytes: pdf.byteLength });
      }
    }
    items.push({ file: d.file, outputs });
  }
  return { items };
}
