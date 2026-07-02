import { describe, expect, it } from 'vitest';
import { parseDocument } from '@avodado/core';
import { toSlides } from '../slides.js';

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
});
