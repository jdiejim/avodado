/**
 * Detects whether Playwright + Chromium are installed locally, so tests and
 * callers can gracefully skip the PDF code path when the browser isn't present.
 */

import type * as Playwright from 'playwright';

type PlaywrightModule = typeof Playwright;

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
