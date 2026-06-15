/**
 * PDF export via headless Chromium (Playwright).
 *
 * Playwright is an optional dependency — importing it lazily means consumers
 * who only need {@link toHtml} aren't forced to download Chromium. Callers who
 * use {@link toPdf} need to run `npx playwright install chromium` once.
 */

import type { Document } from '@avodado/core';
import { renderDocument } from '@avodado/render';
import type * as Playwright from 'playwright';

type PlaywrightModule = typeof Playwright;

/** Page format for the generated PDF. */
export type PdfFormat = 'A4' | 'Letter';

/** Options for {@link toPdf}. */
export interface PdfOptions {
  /** Page format. Defaults to `A4`. */
  readonly format?: PdfFormat;
  /** Optional page margins (CSS length strings). */
  readonly margin?: {
    readonly top?: string;
    readonly right?: string;
    readonly bottom?: string;
    readonly left?: string;
  };
}

/**
 * Renders a document (or pre-rendered HTML string) to a PDF byte buffer.
 *
 * @param input - A {@link Document} or an HTML string. A Document is rendered
 *   to HTML first via the renderer.
 * @param opts - Optional page format and margins.
 * @returns The PDF bytes.
 *
 * @example
 * ```ts
 * const bytes = await toPdf(doc, { format: 'A4' });
 * await writeFile('out.pdf', bytes);
 * ```
 *
 * @throws If Playwright is not installed or its Chromium binary is missing.
 */
export async function toPdf(input: Document | string, opts: PdfOptions = {}): Promise<Uint8Array> {
  const html = typeof input === 'string' ? input : renderDocument(input);
  const pw = await loadPlaywright();
  const browser = await pw.chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    const buffer = await page.pdf({
      format: opts.format ?? 'A4',
      printBackground: true,
      ...(opts.margin !== undefined ? { margin: opts.margin } : {}),
    });
    return new Uint8Array(buffer);
  } finally {
    await browser.close();
  }
}

async function loadPlaywright(): Promise<PlaywrightModule> {
  try {
    return await import('playwright');
  } catch (err) {
    throw new Error(
      `Playwright is required for PDF export. Run: pnpm add playwright && npx playwright install chromium\n` +
        `Original error: ${(err as Error).message}`,
    );
  }
}
