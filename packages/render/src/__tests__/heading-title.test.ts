/**
 * "The heading titles the block" — render-time healing of heading/title
 * duplication and Markdown-native title inheritance:
 *
 *  - a block `title` that near-duplicates the heading directly above renders
 *    NO section-head title (the heading already says it; the head goes bare);
 *  - a title-less block under a heading inherits the heading text into the
 *    sections nav (but adds no visual title of its own);
 *  - a DIFFERENTLY-titled block under a heading keeps its own title (the old
 *    "meridian case" — mere adjacency never merges).
 */

import { describe, expect, it } from 'vitest';
import { parseDocument } from '@avodado/core';
import { renderDocumentParts } from '../parts.js';

const TABLE = '```table\ntitle: Type scale\ncolumns: [A]\nrows:\n  - [x]\n```\n';
const UNTITLED_TABLE = '```table\ncolumns: [A]\nrows:\n  - [x]\n```\n';

function parts(md: string) {
  return renderDocumentParts(parseDocument(md, 't'));
}

describe('heading titles the block', () => {
  it('suppresses a section-head title that near-duplicates the heading above', () => {
    const p = parts(`## Type scale\n\n${TABLE}`);
    // The prose heading renders once…
    expect(p.body).toContain('Type scale</h2>');
    // …but NOT again as the block's section title (the head goes bare).
    expect(p.body).not.toContain('class="section-title"');
    // The sections nav keeps the title for navigation.
    expect(p.sections[0]?.title).toBe('Type scale');
  });

  it('keeps the block title when the heading above says something different', () => {
    const p = parts(`## Design tokens\n\n${TABLE}`);
    expect(p.body).toContain('class="section-title"');
    expect(p.sections[0]?.title).toBe('Type scale');
  });

  it('keeps the block title when prose does not END with the heading', () => {
    const p = parts(`## Type scale\n\nTrailing prose.\n\n${TABLE}`);
    expect(p.body).toContain('class="section-title"');
  });

  it('a title-less block inherits the heading into the sections nav', () => {
    const p = parts(`## Payment flow\n\n${UNTITLED_TABLE}`);
    // No visual title of its own — the heading right above is the title.
    expect(p.body).not.toContain('class="section-title"');
    // But navigation knows what this section is called.
    expect(p.sections[0]?.title).toBe('Payment flow');
  });

  it('a title-less block with no heading stays untitled in the nav', () => {
    const p = parts(`Some prose without a heading.\n\n${UNTITLED_TABLE}`);
    expect(p.sections[0]?.title).toBeUndefined();
  });
});
