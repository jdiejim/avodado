import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseDocument } from '@avodado/core';
import { toSlides } from '@avodado/render';
import { isChromiumAvailable } from '../io/pdf.js';
import { toPptx } from '../io/pptx.js';
import { toPptxEditable } from '../io/pptxEditable.js';

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

  it('editable mode screenshots ONLY diagram blocks (one media image, not one per slide)', async () => {
    const doc = parseDocument(
      '```meta\ntitle: Mixed\n```\n\n# Flow\n\n```flow\nnodes: [A, B]\nedges: [A -> B]\n```\n\n# Words\n\nJust prose here.\n',
      'mixed',
    );
    const bytes = await toPptxEditable(doc);
    // Media is named image-<slide>-1.png; the flow diagram lands on slide 2
    // and is the deck's ONLY image — the prose slide stays fully native.
    expect(zipEntries(bytes, 'ppt/media/image-2-1.png')).toBeGreaterThan(0);
    expect(zipEntries(bytes, 'ppt/media/image-')).toBe(zipEntries(bytes, 'ppt/media/image-2-1.png'));
  }, 120_000);
});

// No diagrams → no Chromium needed: these run everywhere, browser or not.
describe('toPptxEditable (text-only, no browser)', () => {
  const DOC =
    '```meta\ntitle: Editable Deck\nsubtitle: Native text\n```\n\n' +
    '# The plan\n\nShip **fast** and safe.\n\n' +
    '```takeaways\nitems:\n  - Small PRs — reviewable in minutes\n  - Tests first — trust the suite\n```\n\n' +
    '# Numbers\n\n```table\ncolumns: [Metric, Value]\nrows:\n  - [p95, 120ms]\n  - [errors, 0.02%]\n```\n\n' +
    '# Code\n\n```code\ncode: |\n  print("hello")\nlang: python\n```\n';

  it('emits native, greppable text — titles, bullets, table cells, code', async () => {
    const doc = parseDocument(DOC, 'editable');
    const bytes = await toPptxEditable(doc);
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const raw = Buffer.from(bytes);
    // Slide XML is stored uncompressed, so editable text is directly visible.
    for (const text of ['Editable Deck', 'The plan', 'Small PRs', 'reviewable in minutes', 'p95', '120ms', 'print(&quot;hello&quot;)']) {
      expect(raw.includes(text), `missing native text: ${text}`).toBe(true);
    }
    // Nothing needed a screenshot.
    expect(zipEntries(bytes, 'ppt/media/image-')).toBe(0);
  }, 30_000);
});
