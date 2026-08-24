/**
 * Direct-edit path tagging for the narrative / prose-family renderers: each
 * one emits `data-bp` (one addressable YAML value/item) and `data-bl` (array
 * container) attributes whose paths match the block's schema field names.
 * The attributes are inert metadata — these tests pin the contract the
 * studio's direct-edit layer navigates by.
 */

import { describe, expect, it } from 'vitest';
import { renderBignumber } from '../blocks/bignumber.js';
import { renderDivider } from '../blocks/divider.js';
import { renderFaq } from '../blocks/faq.js';
import { renderFigure } from '../blocks/figure.js';
import { renderGlossary } from '../blocks/glossary.js';
import { renderLayers } from '../blocks/layers.js';
import { renderList } from '../blocks/list.js';
import { renderProseBlock } from '../blocks/prose.js';
import { renderPullquote } from '../blocks/pullquote.js';
import { renderSteps } from '../blocks/steps.js';
import { renderTakeaways } from '../blocks/takeaways.js';

describe('data-path tagging (direct edit, narrative blocks)', () => {
  it('prose tags sub-blocks, nested list items, and both list containers', () => {
    const html = renderProseBlock({
      blocks: [
        { type: 'h', text: 'Heading' },
        { type: 'p', text: 'Body' },
        { type: 'ul', items: ['one', 'two'] },
        { type: 'quote', text: 'Q' },
      ],
    });
    expect(html).toContain('<div class="prose" data-bl="blocks">');
    expect(html).toContain('<h3 data-bp="blocks.0">');
    expect(html).toContain('<p data-bp="blocks.1">');
    expect(html).toContain('<ul data-bp="blocks.2" data-bl="blocks.2.items">');
    expect(html).toContain('<li data-bp="blocks.2.items.1">');
    expect(html).toContain('<blockquote data-bp="blocks.3">');
  });

  it('prose renders inline markdown in text fields, like callout/pullquote', () => {
    const html = renderProseBlock({
      blocks: [
        { type: 'h', text: 'The `avo` CLI' },
        { type: 'p', text: 'This is **bold** and `code`.' },
        { type: 'ul', items: ['*emphasis* item', '[link](https://example.com)'] },
        { type: 'quote', text: 'A **strong** quote' },
      ],
    });
    expect(html).toContain('<p data-bp="blocks.1">This is <strong>bold</strong> and <code>code</code>.</p>');
    expect(html).toContain('<h3 data-bp="blocks.0">The <code>avo</code> CLI</h3>');
    expect(html).toContain('<li data-bp="blocks.2.items.0"><em>emphasis</em> item</li>');
    expect(html).toContain('<a href="https://example.com">link</a>');
    expect(html).toContain('<blockquote data-bp="blocks.3">A <strong>strong</strong> quote</blockquote>');
  });

  it('prose still escapes literal HTML in every position', () => {
    const html = renderProseBlock({
      blocks: [
        { type: 'p', text: '<script>alert(1)</script>' },
        { type: 'ul', items: ['<img src=x onerror=alert(1)>'] },
      ],
    });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
  });

  it('glossary tags rows, term/def, and the terms container', () => {
    const html = renderGlossary({
      terms: [
        { term: 'API', def: 'Interface' },
        { term: 'ERD', def: 'Entity diagram' },
      ],
    });
    expect(html).toContain('<div class="glossary" data-bl="terms">');
    expect(html).toContain('<div class="row" data-bp="terms.0">');
    expect(html).toContain('<dt data-bp="terms.1.term">');
    expect(html).toContain('<dd data-bp="terms.0.def">');
    // No avoid list → no "not:" suffix at all.
    expect(html).not.toContain('class="avoid"');
  });

  it('glossary renders avoided terms as a muted "not:" suffix, tagged per word', () => {
    const html = renderGlossary({
      terms: [
        { term: 'SLO', def: 'The objective.', avoid: ['uptime target', 'service promise'] },
        { term: 'Saga', def: 'A split transaction.' },
      ],
    });
    expect(html).toContain('<span class="avoid" data-bl="terms.0.avoid">not: ');
    expect(html).toContain('<span data-bp="terms.0.avoid.0">uptime target</span>');
    expect(html).toContain('<span data-bp="terms.0.avoid.1">service promise</span>');
    // The suffix joins with a comma and stays inside the definition cell.
    expect(html).toContain('uptime target</span>, <span data-bp="terms.0.avoid.1">');
    // The avoid-free term renders exactly as before.
    expect(html).toContain('<dd data-bp="terms.1.def">A split transaction.</dd>');
  });

  it('faq tags items, q/a, and the items container', () => {
    const html = renderFaq({
      items: [
        { q: 'Why?', a: 'Because.' },
        { q: 'How?', a: 'Like this.', open: true },
      ],
    });
    expect(html).toContain('<div class="fq-list" data-bl="items">');
    expect(html).toContain('data-bp="items.0"');
    expect(html).toContain('data-bp="items.0.q"');
    expect(html).toContain('data-bp="items.1.a"');
  });

  it('steps tags items, title/body/note, and the items container', () => {
    const html = renderSteps({
      items: [
        { title: 'Install', body: 'Run it', code: 'npm i', lang: 'sh' },
        { title: 'Verify', note: 'Should be green' },
      ],
    });
    expect(html).toContain('<ol class="stp-list" data-bl="items">');
    expect(html).toContain('<li class="stp-item" data-bp="items.0">');
    expect(html).toContain('data-bp="items.0.title"');
    expect(html).toContain('data-bp="items.0.body"');
    expect(html).toContain('data-bp="items.1.note"');
  });

  it('divider tags kicker, title, and subtitle', () => {
    const html = renderDivider({ kicker: 'PART 2', title: 'The fix', subtitle: 'How we did it' });
    expect(html).toContain('<span class="dvd-kicker-text" data-bp="kicker">');
    expect(html).toContain('<div class="dvd-title" data-bp="title">');
    expect(html).toContain('<p class="dvd-subtitle" data-bp="subtitle">');
  });

  it('bignumber tags value, label, delta, and context', () => {
    const html = renderBignumber({
      value: '42ms',
      label: 'p99 latency',
      context: 'down from 90ms',
      delta: '-53%',
      trend: 'down',
    });
    expect(html).toContain('<span class="bn-value" data-bp="value">');
    expect(html).toContain('<div class="bn-label" data-bp="label">');
    expect(html).toContain('<span class="bn-delta" data-bp="delta">');
    expect(html).toContain('<p class="bn-context" data-bp="context">');
  });

  it('takeaways tags items, text/detail, and the items container', () => {
    const html = renderTakeaways({
      items: [
        { text: 'Ship small', detail: 'Smaller diffs land faster' },
        { text: 'Measure first' },
      ],
    });
    expect(html).toContain('<ol class="tk-list" data-bl="items">');
    expect(html).toContain('<li class="tk-item" data-bp="items.1">');
    expect(html).toContain('data-bp="items.0.text"');
    expect(html).toContain('data-bp="items.0.detail"');
  });

  it('pullquote tags text and attribution', () => {
    const html = renderPullquote({ text: 'Make it work', attribution: 'Kent Beck' });
    expect(html).toContain('<p class="pull-text" data-bp="text">');
    expect(html).toContain('<div class="pull-attr" data-bp="attribution">');
  });

  it('layers tags layer rows, kicker/title/body, and the items container', () => {
    const html = renderLayers({
      items: [
        { title: 'L1', kicker: 'Cache', body: 'In-process' },
        { title: 'L2', source: 'Redis' },
      ],
    });
    expect(html).toContain('<div class="layer-stack" data-bl="items">');
    expect(html).toContain('<div class="layer" data-bp="items.0">');
    expect(html).toContain('data-bp="items.0.kicker"');
    expect(html).toContain('data-bp="items.1.title"');
    expect(html).toContain('data-bp="items.0.body"');
  });

  it('list tags items, lead/text, and the items container', () => {
    const html = renderList({
      style: 'check',
      items: [
        { lead: 'Done thing', text: 'with detail', done: true },
        { lead: 'Open thing', done: false },
      ],
    });
    expect(html).toContain('<ul class="ls-list" data-bl="items">');
    expect(html).toContain('data-bp="items.0"');
    expect(html).toContain('data-bp="items.0.lead"');
    expect(html).toContain('data-bp="items.0.text"');
    expect(html).toContain('data-bp="items.1.lead"');
  });

  it('figure tags the caption only (src/alt are not visible text)', () => {
    const html = renderFigure({ src: 'https://example.com/a.png', caption: 'The system' });
    expect(html).toContain('<figcaption class="fig-cap" data-bp="caption">');
    expect(html).not.toContain('data-bp="src"');
    expect(html).not.toContain('data-bp="alt"');
  });
});
