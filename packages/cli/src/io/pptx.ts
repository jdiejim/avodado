/**
 * PowerPoint export via headless Chromium (Playwright) + pptxgenjs.
 *
 * The deck is Avodado's own self-contained slide HTML (`toSlides`): each slide
 * is driven on-screen exactly as it presents — deck script, fitter, themed SVG
 * diagrams and all — photographed at 2× and placed as a full-bleed 16:9 image
 * on a real `.pptx` slide, with the slide's title as its speaker note.
 *
 * Image-based on purpose: translating every block type to native PowerPoint
 * shapes would be a third renderer with strictly worse fidelity. The trade-off
 * is that text isn't editable inside PowerPoint — the Markdown stays the
 * source of truth, which is the whole idea.
 */

import type PptxGenJS from 'pptxgenjs';
import { type PdfOptions, launchChromium, loadPlaywright } from './pdf.js';

/** Options for {@link toPptx} — the Chromium bootstrap knobs shared with PDF. */
export type PptxOptions = Pick<PdfOptions, 'autoInstallBrowser' | 'log'>;

/**
 * Viewport sized so the deck CSS settles on its 1120px slide cap
 * (`min(94vw, (100vh − 116px) · 16/9, 1120px)`) with room for the nav bar —
 * shot at deviceScaleFactor 2 → 2240×1260 px per slide image.
 */
const VIEWPORT = { width: 1260, height: 780 } as const;

/** PowerPoint 16:9 layout is 10in × 5.625in. */
const LAYOUT = { w: 10, h: 5.625 } as const;

interface DeckShot {
  readonly png: Buffer;
  readonly title: string;
}

/** CJS/ESM interop: unwrap however many `default`s the bundler nested. */
async function loadPptxGen(): Promise<typeof PptxGenJS> {
  let mod: unknown = await import('pptxgenjs');
  while (typeof mod === 'object' && mod !== null && 'default' in mod) {
    mod = (mod as { default: unknown }).default;
  }
  return mod as typeof PptxGenJS;
}

/**
 * Renders a slide-deck HTML string (from `toSlides`) to PowerPoint bytes.
 *
 * @param deckHtml - Self-contained deck HTML produced by `@avodado/render`'s
 *   `toSlides` (its `.docskin.slide` markup and `#deck-jump` nav are driven).
 * @returns The `.pptx` bytes.
 *
 * @throws If Playwright is not installed or its Chromium binary is missing
 *   (unless `autoInstallBrowser`), or if the HTML has no slides.
 */
export async function toPptx(deckHtml: string, opts: PptxOptions = {}): Promise<Uint8Array> {
  const pw = await loadPlaywright();
  const browser = await launchChromium(pw, opts);
  let deckTitle = '';
  const shots: DeckShot[] = [];
  try {
    const page = await browser.newPage({ viewport: { ...VIEWPORT }, deviceScaleFactor: 2 });
    await page.setContent(deckHtml, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    deckTitle = await page.title();

    // Slide count and titles come from the deck's own jump menu — it already
    // resolves the presentable name per slide (divider band > heading > label).
    const titles = await page.$$eval('#deck-jump option', (els) =>
      els.map((el) => (el.textContent ?? '').replace(/^\d+\s·\s/, '').trim()),
    );
    if (titles.length === 0) throw new Error('The deck HTML contains no slides.');

    for (let i = 0; i < titles.length; i += 1) {
      // Drive the deck like a presenter would: the jump menu's change handler
      // runs show(i) + the fitter, so the shot matches presentation exactly.
      await page.selectOption('#deck-jump', String(i));
      // Two frames: let the fitter's transform land before photographing.
      await page.evaluate(
        () =>
          new Promise((done) => {
            requestAnimationFrame(() => requestAnimationFrame(() => done(undefined)));
          }),
      );
      const el = page.locator('.docskin.slide.active');
      const png = await el.screenshot({ type: 'png' });
      shots.push({ png, title: titles[i] ?? '' });
    }
  } finally {
    await browser.close();
  }

  const Pptx = await loadPptxGen();
  const pres = new Pptx();
  pres.layout = 'LAYOUT_16x9';
  if (deckTitle !== '') pres.title = deckTitle;
  for (const shot of shots) {
    const slide = pres.addSlide();
    slide.addImage({
      data: `image/png;base64,${shot.png.toString('base64')}`,
      x: 0,
      y: 0,
      w: LAYOUT.w,
      h: LAYOUT.h,
    });
    if (shot.title !== '') slide.addNotes(shot.title);
  }
  const out = (await pres.write({ outputType: 'nodebuffer' })) as Buffer;
  return new Uint8Array(out);
}
