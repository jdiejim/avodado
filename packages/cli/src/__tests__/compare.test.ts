import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildComparePage } from '../commands/compare.js';
import { templatesDir } from '../commands/init.js';

const showcase = (): string => readFileSync(join(templatesDir(), 'demo.md'), 'utf8');

describe('avo compare', () => {
  it('renders every showcase block twice — doc panel + a live one-slide deck', () => {
    const html = buildComparePage(showcase());
    const rows = (html.match(/class="cmp-row"/g) ?? []).length;
    expect(rows).toBeGreaterThan(60); // the showcase covers (almost) all types
    // Same count of slide iframes as rows — one deck per block.
    expect((html.match(/iframe class="cmp-stage"/g) ?? []).length).toBe(rows);
    // A known block appears with both panels.
    expect(html).toContain('id="block-sequence"');
    expect(html).toContain('cmp-doc');
    // The embedded decks are escaped into srcdoc (no raw nested documents).
    expect(html).toContain('srcdoc="&lt;!doctype html&gt;');
    // Mini-deck chrome tweaks ride along (nav + UNTITLED footer hidden).
    expect(html).toContain('.deck-nav{display:none!important}');
    expect(html).toContain('.slide-ft{display:none!important}');
    // View toggle present.
    expect(html).toContain('data-v="slide"');
  });

  it('family filter narrows the page', () => {
    const all = buildComparePage(showcase());
    const one = buildComparePage(showcase(), 'planning');
    const count = (s: string): number => (s.match(/class="cmp-row"/g) ?? []).length;
    expect(count(one)).toBeGreaterThan(0);
    expect(count(one)).toBeLessThan(count(all));
  });
});
