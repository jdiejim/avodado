/**
 * PDF export via headless Chromium (Playwright).
 *
 * Playwright is an optional dependency — importing it lazily means consumers
 * who never touch `avo pdf` aren't forced to download Chromium. Callers who
 * use {@link toPdf} can pass `autoInstallBrowser: true` to download the matching
 * Chromium on first use; otherwise a missing browser throws a clear error.
 */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { Document } from '@avodado/core';
import { renderDocument } from '@avodado/render';
import type * as Playwright from 'playwright';

type PlaywrightModule = typeof Playwright;

const require = createRequire(import.meta.url);

/** Page format for the generated PDF. */
export type PdfFormat = 'A4' | 'Letter';

/** Options for {@link toPdf}. */
export interface PdfOptions {
  /** Page format. Defaults to `A4`. */
  readonly format?: PdfFormat;
  /**
   * Custom page width in CSS pixels. When set, it wins over `format`: the page
   * becomes `pageWidthPx` wide with portrait A-series proportions
   * (height = width × √2). Used by the CLI `--size` presets.
   */
  readonly pageWidthPx?: number;
  /** Optional page margins (CSS length strings). */
  readonly margin?: {
    readonly top?: string;
    readonly right?: string;
    readonly bottom?: string;
    readonly left?: string;
  };
  /**
   * If Chromium isn't installed, download it (via the bundled Playwright, so the
   * version always matches) and retry once, instead of throwing. Default `false`.
   */
  readonly autoInstallBrowser?: boolean;
  /** Progress logger for the one-time browser download. */
  readonly log?: (message: string) => void;
}

/** True if the error is Playwright complaining the browser binary is missing. */
function isMissingBrowserError(message: string): boolean {
  return /Executable doesn't exist|playwright install|just installed or updated/i.test(message);
}

/** Resolves the bundled Playwright CLI entry (`cli.js`), or `undefined`. */
function playwrightCliPath(): string | undefined {
  try {
    return join(dirname(require.resolve('playwright/package.json')), 'cli.js');
  } catch {
    return undefined;
  }
}

/**
 * Downloads the Chromium build the *installed* Playwright needs, by running its
 * own bundled CLI (`node …/playwright/cli.js install chromium`). Using the
 * bundled CLI guarantees the browser build matches the library version — the
 * usual cause of "Executable doesn't exist at …chromium-XXXX" errors.
 */
export async function installChromium(log: (message: string) => void = () => {}): Promise<void> {
  const cli = playwrightCliPath();
  if (cli === undefined) {
    throw new Error('Could not locate the Playwright CLI. Run `npx playwright install chromium`.');
  }
  log('Downloading Chromium for PDF export (one-time, ~100 MB)…');
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [cli, 'install', 'chromium'], {
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    child.on('error', rejectPromise);
    child.on('exit', (code) =>
      code === 0 ? resolvePromise() : rejectPromise(new Error(`playwright install exited with code ${String(code)}`)),
    );
  });
}

/**
 * Returns `true` if `playwright` is installed AND the Chromium binary is
 * available on disk.
 *
 * Use this to gate PDF tests in CI and to give callers a clear error before
 * launching a browser that doesn't exist.
 */
export async function isChromiumAvailable(): Promise<boolean> {
  try {
    const pw: PlaywrightModule = await import('playwright');
    const exe = pw.chromium.executablePath();
    if (typeof exe !== 'string' || exe.length === 0) return false;
    const { existsSync } = await import('node:fs');
    return existsSync(exe);
  } catch {
    return false;
  }
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
  const browser = await launchChromium(pw, opts);
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    const buffer = await page.pdf({
      // A custom pixel width wins over the named format (Playwright ignores
      // `format` when width/height are given): portrait A-series proportions
      // keep the page shape familiar at every preset.
      ...(opts.pageWidthPx !== undefined
        ? {
            width: `${String(opts.pageWidthPx)}px`,
            height: `${String(Math.round(opts.pageWidthPx * Math.SQRT2))}px`,
          }
        : { format: opts.format ?? 'A4' }),
      printBackground: true,
      ...(opts.margin !== undefined ? { margin: opts.margin } : {}),
    });
    return new Uint8Array(buffer);
  } finally {
    await browser.close();
  }
}

/**
 * Launches headless Chromium. If the browser binary is missing, either
 * auto-installs it (when `opts.autoInstallBrowser`) and retries, or throws a
 * clear, actionable error with the exact command to run.
 *
 * Exported for the other Chromium-backed exporter ({@link ../pptx.js toPptx});
 * not part of the public CLI surface.
 */
export async function launchChromium(pw: PlaywrightModule, opts: PdfOptions): Promise<Playwright.Browser> {
  try {
    return await pw.chromium.launch({ headless: true });
  } catch (err) {
    const message = (err as Error).message;
    if (!isMissingBrowserError(message)) throw err;
    if (opts.autoInstallBrowser === true) {
      await installChromium(opts.log);
      return await pw.chromium.launch({ headless: true });
    }
    const cli = playwrightCliPath();
    const cmd = cli !== undefined ? `node "${cli}" install chromium` : 'npx playwright install chromium';
    throw new Error(
      `Chromium isn't installed for PDF export. Install it once with:\n  ${cmd}\nOriginal error: ${message}`,
    );
  }
}

/** Lazy Playwright import shared by the PDF and PPTX exporters. */
export async function loadPlaywright(): Promise<PlaywrightModule> {
  try {
    return await import('playwright');
  } catch (err) {
    throw new Error(
      `Playwright is required for PDF export. Run: pnpm add playwright && npx playwright install chromium\n` +
        `Original error: ${(err as Error).message}`,
    );
  }
}
