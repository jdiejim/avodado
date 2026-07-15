import { describe, expect, it } from 'vitest';
import { parseDocument } from '@avodado/core';
import { toSlides } from '../deck.js';
import { toSlides as toSlidesFromIndex } from '../index.js';

const SPLIT_DOC = [
  '```meta',
  'title: Split test',
  '```',
  '',
  '## The message {split}',
  '',
  'Revenue is up and to the right.',
  '',
  '```stats',
  'stats:',
  '  - { value: "$120k", label: MRR, delta: "+12%", trend: up }',
  '```',
].join('\n');

describe('toSlides', () => {
  it('a {split} heading yields the consulting layout — message left, exhibit right', () => {
    const html = toSlides(parseDocument(SPLIT_DOC, 'split-test'));
    expect(html).toContain('sl-split');
    expect(html).toContain('sl-msg'); // prose column
    expect(html).toContain('sl-exhibit'); // block column
  });

  it('ships the fit() text-only scale-cap branch in the deck script', () => {
    const html = toSlides(parseDocument(SPLIT_DOC, 'split-test'));
    // Text-only slides barely scale up; slides with a visual get ~1.5x.
    expect(html).toContain('var cap=visual?1.5:1.08');
  });

  it('aliased fences keep their historical SECTION labels in the deck', () => {
    const aliasDoc = [
      '```meta',
      'title: Alias deck',
      '```',
      '',
      '```waterfall',
      'unit: ms',
      'items:',
      '  - { label: DNS, value: 35 }',
      '```',
      '',
      '```infra',
      'nodes:',
      '  - { id: api, col: 1, row: 1, name: API }',
      '```',
    ].join('\n');
    const html = toSlides(parseDocument(aliasDoc, 'alias-deck'));
    // Slide headers read `NN · <label>` — the labels the old types carried.
    expect(html).toContain('· Budget');
    expect(html).toContain('· Deployment');
    // The blocks themselves rendered through the canonical renderers.
    expect(html).toContain('Budget waterfall');
    expect(html).toContain('>INFRA</span>');
  });

  it('is exported from the package index and yields a standalone document', () => {
    const html = toSlidesFromIndex(parseDocument(SPLIT_DOC, 'split-test'));
    expect(html).toBe(toSlides(parseDocument(SPLIT_DOC, 'split-test')));
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('class="deck-nav"'); // navigation chrome present
  });
});
