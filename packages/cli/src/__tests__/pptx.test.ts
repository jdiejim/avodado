import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseDocument } from '@avodado/core';
import { toSlides } from '@avodado/render';
import { isChromiumAvailable } from '../io/pdf.js';
import { toPptx } from '../io/pptx.js';

const roadmap = (): string =>
  readFileSync(resolve(import.meta.dirname, '../../../../resources/avodado-roadmap.md'), 'utf8');

const chromiumAvailable = await isChromiumAvailable();
if (!chromiumAvailable) {
  console.warn(
    '[skip] avo pptx tests — Playwright Chromium not installed. ' +
      'Run: npx playwright install chromium',
  );
}

/** Zip local-file headers store entry names as plain bytes — no unzip needed. */
const zipEntries = (bytes: Uint8Array, name: string): number => {
  const hay = Buffer.from(bytes);
  const needle = Buffer.from(name, 'utf8');
  let count = 0;
  for (let at = hay.indexOf(needle); at !== -1; at = hay.indexOf(needle, at + 1)) count += 1;
  return count;
};

describe.skipIf(!chromiumAvailable)('toPptx', () => {
  it('produces a .pptx (zip) with one image slide per deck slide', async () => {
    const doc = parseDocument(roadmap(), 'avodado-roadmap');
    const deck = toSlides(doc);
    const deckSlides = (deck.match(/class="docskin slide/g) ?? []).length;
    expect(deckSlides).toBeGreaterThan(1);

    const bytes = await toPptx(deck);
    expect(bytes).toBeInstanceOf(Uint8Array);
    // Zip magic: PK\x03\x04.
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    // Real presentation parts, one slide XML + one PNG per deck slide.
    expect(zipEntries(bytes, 'ppt/presentation.xml')).toBeGreaterThan(0);
    expect(zipEntries(bytes, `ppt/slides/slide${deckSlides}.xml`)).toBeGreaterThan(0);
    expect(zipEntries(bytes, `ppt/slides/slide${deckSlides + 1}.xml`)).toBe(0);
    expect(zipEntries(bytes, `ppt/media/image-${deckSlides}-1.png`)).toBeGreaterThan(0);
    // Screenshots at 2× are heavy — a blank/failed capture would be tiny.
    expect(bytes.byteLength).toBeGreaterThan(50 * 1024);
  }, 120_000);

  it('throws a clear error when the HTML has no slides', async () => {
    await expect(
      toPptx('<!doctype html><html><body><p>not a deck</p></body></html>'),
    ).rejects.toThrow(/no slides/i);
  }, 60_000);
});
