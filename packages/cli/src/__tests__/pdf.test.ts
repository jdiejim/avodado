import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseDocument } from '@avodado/core';
import { isChromiumAvailable, toPdf } from '../io/pdf.js';

const roadmap = (): string =>
  readFileSync(resolve(import.meta.dirname, '../../../../resources/avodado-roadmap.md'), 'utf8');

const chromiumAvailable = await isChromiumAvailable();
if (!chromiumAvailable) {
  console.warn(
    '[skip] avo pdf tests — Playwright Chromium not installed. ' +
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
