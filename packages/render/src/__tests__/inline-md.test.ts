/**
 * Inline Markdown in text-first blocks: callout bodies and pullquote text
 * render bold/italic/`code`/links (hardened — raw HTML declined, hrefs
 * sanitized), with blank lines as paragraph breaks.
 */

import { describe, expect, it } from 'vitest';
import { renderCallout } from '../blocks/callout.js';
import { renderPullquote } from '../blocks/pullquote.js';
import { renderInlineMd } from '../markdown.js';

describe('renderInlineMd', () => {
  it('renders inline marks without block wrapping for a single paragraph', () => {
    expect(renderInlineMd('a **bold** `code` move')).toBe('a <strong>bold</strong> <code>code</code> move');
  });

  it('renders blank-line-separated paragraphs as <p>s', () => {
    expect(renderInlineMd('First.\n\nSecond **loud**.')).toBe('<p>First.</p><p>Second <strong>loud</strong>.</p>');
  });

  it('declines raw HTML and sanitizes javascript: hrefs', () => {
    expect(renderInlineMd('<script>x()</script>')).not.toContain('<script>');
    expect(renderInlineMd('[x](javascript:alert(1))')).toContain('href="#"');
  });
});

describe('callout + pullquote render inline markdown', () => {
  it('callout body: markdown works, title stays plain', () => {
    const html = renderCallout({ tone: 'tip', body: 'Use **backoff** — see `retry()`.' });
    expect(html).toContain('<strong>backoff</strong>');
    expect(html).toContain('<code>retry()</code>');
    expect(html).toContain('callout-title');
  });

  it('pullquote text: markdown works', () => {
    const html = renderPullquote({ text: 'Ship *small*, ship often.' });
    expect(html).toContain('<em>small</em>');
  });
});
