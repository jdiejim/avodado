import { describe, expect, it } from 'vitest';
import { presentDeckHtml } from './present.js';

const SAVED =
  '```meta\ntitle: Quarterly review\nsubtitle: Q3 numbers\n```\n\n## Wins\n\nShipped the thing.\n';

describe('presentDeckHtml', () => {
  it('renders a full deck document with the doc\'s real title', () => {
    const html = presentDeckHtml(SAVED, 'quarterly');
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('Quarterly review');
    // Deck markup, not a plain page: slides + the deck's own nav controls.
    expect(html).toContain('class="docskin slide');
    expect(html).toContain('deck-next');
  });

  it('works on a dirty/unsaved source string — no disk round-trip', () => {
    const dirty = SAVED + '\n## Brand new section\n\nTyped seconds ago, never saved.\n';
    const html = presentDeckHtml(dirty, 'quarterly');
    expect(html).toContain('Brand new section');
    expect(html).toContain('never saved');
  });
});
