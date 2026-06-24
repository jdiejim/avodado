import { describe, expect, it } from 'vitest';
import { parseDocument } from '@avodado/core';
import { renderSlides } from '../parts.js';

describe('renderSlides', () => {
  it('one slide per heading for light sections', () => {
    const md = [
      '```meta',
      'title: T',
      '```',
      '',
      '## One',
      '',
      'short prose',
      '',
      '## Two',
      '',
      '```callout',
      'tone: tip',
      'body: hi',
      '```',
    ].join('\n');
    const { slides } = renderSlides(parseDocument(md, 'd'));
    // cover + One + Two
    expect(slides.length).toBe(3);
    expect(slides[1]?.title).toBe('One');
    expect(slides[2]?.title).toBe('Two');
  });

  it('paginates a heavy heading across multiple slides (same title)', () => {
    const big = (n: number): string =>
      ['```list', 'style: number', 'items:', ...Array.from({ length: n }, (_, i) => `  - { lead: Item ${i} }`), '```'].join(
        '\n',
      );
    const md = ['```meta', 'title: T', '```', '', '## Heavy', '', big(9), '', big(9), '', big(9)].join('\n');
    const { slides } = renderSlides(parseDocument(md, 'd'));
    const heavy = slides.filter((s) => s.title === 'Heavy');
    // three big lists shouldn't all land on one slide
    expect(heavy.length).toBeGreaterThan(1);
  });
});
