import { describe, expect, it } from 'vitest';
import { parseDocument } from '@avodado/core';
import { isChromiumAvailable } from '../chromium-available.js';
import { toPdf } from '../pdf.js';
import { roadmap } from './fixtures.js';

const chromiumAvailable = await isChromiumAvailable();
if (!chromiumAvailable) {
  console.warn(
    '[skip] @avodado/export PDF tests — Playwright Chromium not installed. ' +
      'Run: npx playwright install chromium',
  );
}

describe.skipIf(!chromiumAvailable)('toPdf', () => {
  it('produces a PDF byte buffer with the %PDF- magic header', async () => {
    const doc = parseDocument(roadmap(), 'avodado-roadmap');
    const bytes = await toPdf(doc);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.byteLength).toBeGreaterThan(1024);
    const header = String.fromCharCode(...bytes.slice(0, 5));
    expect(header).toBe('%PDF-');
  }, 60_000);

  it('accepts a pre-rendered HTML string', async () => {
    const html = '<!doctype html><html><body><h1>Hello</h1></body></html>';
    const bytes = await toPdf(html);
    expect(bytes.byteLength).toBeGreaterThan(512);
  }, 60_000);
});
