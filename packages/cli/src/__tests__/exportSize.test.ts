/**
 * `--size` export presets (sm | md | lg | xl) for the page-shaped exports
 * (`avo html`, `avo pdf`).
 *
 * - Preset table + parsing: pure unit tests.
 * - HTML wiring: `runSingle` directly (no browser needed) — the preset must
 *   land as a `--page-max` override, and the unflagged run must not emit one.
 * - PDF page size: gated on a local Chromium (same skip pattern as
 *   pdf.test.ts) — CI without a browser tests the option plumbing only.
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { parseExportSize, runSingle, SIZE_WIDTHS } from '../commands/single.js';
import { isChromiumAvailable, toPdf } from '../io/pdf.js';

const DOC = `\`\`\`meta
title: Size preset fixture
\`\`\`

# Hello

Some prose.
`;

const dir = join(tmpdir(), `avo-size-${randomBytes(4).toString('hex')}`);
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'doc.md'), DOC, 'utf8');

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('size presets', () => {
  it('maps each preset to its page width', () => {
    expect(SIZE_WIDTHS).toEqual({ sm: 720, md: 960, lg: 1280, xl: 1600 });
  });

  it('parses the four presets and rejects everything else', () => {
    expect(parseExportSize('sm')).toBe('sm');
    expect(parseExportSize('md')).toBe('md');
    expect(parseExportSize('lg')).toBe('lg');
    expect(parseExportSize('xl')).toBe('xl');
    expect(parseExportSize('huge')).toBeUndefined();
    expect(parseExportSize('SM')).toBeUndefined();
    expect(parseExportSize('')).toBeUndefined();
  });

  it('html export with --size sets the --page-max override', async () => {
    const out = join(dir, 'sized.html');
    await runSingle({ cwd: dir, input: 'doc.md', format: 'html', output: out, size: 'md' });
    const html = readFileSync(out, 'utf8');
    expect(html).toContain('--page-max:960px');
  });

  it('html export without --size keeps the default width (no override)', async () => {
    const out = join(dir, 'default.html');
    await runSingle({ cwd: dir, input: 'doc.md', format: 'html', output: out });
    const html = readFileSync(out, 'utf8');
    // No override declaration — only the stylesheet's var() fallback remains.
    expect(html).not.toContain('--page-max:');
    expect(html).toContain('max-width:var(--page-max,1180px)');
  });
});

const chromiumAvailable = await isChromiumAvailable();
if (!chromiumAvailable) {
  console.warn('[skip] pdf --size test — Playwright Chromium not installed.');
}

describe.skipIf(!chromiumAvailable)('pdf page width', () => {
  it('a size preset sets the PDF page width (px → pt at 0.75)', async () => {
    const bytes = await toPdf('<!doctype html><html><body><p>hi</p></body></html>', {
      pageWidthPx: SIZE_WIDTHS.sm,
    });
    const text = Buffer.from(bytes).toString('latin1');
    // 720 CSS px = 540 pt. Height = round(720 × √2) = 1018 px = 763.5 pt.
    const m = /\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(text);
    expect(m).not.toBeNull();
    expect(Number(m?.[1])).toBeCloseTo(540, 0);
    expect(Number(m?.[2])).toBeCloseTo(763.5, 0);
  }, 60_000);
});
