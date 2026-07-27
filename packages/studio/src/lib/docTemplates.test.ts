/**
 * Template-picker data: the cards cover every core doc template with real
 * display data, the block-type mini list is derived from the template body's
 * fences, and firstContentIndex lands the Edit Sheet on the right segment.
 */

import { describe, expect, it } from 'vitest';
import { DOC_TEMPLATES, DOC_TEMPLATE_INFO, parseDocument } from '@avodado/core';
import { firstContentIndex, TEMPLATE_CARDS, templateBlockTypes } from './docTemplates.js';

describe('TEMPLATE_CARDS', () => {
  it('has one card per DOC_TEMPLATES entry, in order, with picker display data', () => {
    expect(TEMPLATE_CARDS.map((c) => c.id)).toEqual(Object.keys(DOC_TEMPLATES));
    for (const card of TEMPLATE_CARDS) {
      expect(card.title).toBe(DOC_TEMPLATE_INFO[card.id]?.title);
      expect(card.description.length).toBeGreaterThan(0);
      expect(card.blockTypes.length).toBeGreaterThan(0);
    }
  });

  it('derives the block-type list from the template body fences (meta excluded, deduped)', () => {
    const adr = TEMPLATE_CARDS.find((c) => c.id === 'adr');
    expect(adr?.blockTypes).toEqual([
      'callout',
      'drivers',
      'sequence',
      'options',
      'block',
      'statustable',
      'risk',
      'steps',
    ]);
    for (const card of TEMPLATE_CARDS) {
      expect(card.blockTypes).not.toContain('meta');
      expect(new Set(card.blockTypes).size).toBe(card.blockTypes.length);
    }
  });
});

describe('templateBlockTypes', () => {
  it('reads fence openers only — closers and nested content are ignored', () => {
    const src = '```meta\ntitle: T\n```\n\nprose\n\n```table\ncolumns: [A]\nrows:\n  - [x]\n```\n\n```table\ncolumns: [B]\nrows:\n  - [y]\n```\n';
    expect(templateBlockTypes(src)).toEqual(['table']);
  });

  it('ignores tags that are not block types', () => {
    expect(templateBlockTypes('```yaml\nfoo: 1\n```\n')).toEqual([]);
  });
});

describe('firstContentIndex', () => {
  it('a blank doc (meta only) opens the cover', () => {
    expect(firstContentIndex('```meta\ntitle: T\n```\n', 'x')).toBe(0);
  });

  it('a template opens its FIRST content block, skipping cover and prose', () => {
    const adr = DOC_TEMPLATES['adr'] as string;
    const idx = firstContentIndex(adr, 'adr');
    const doc = parseDocument(adr, 'adr');
    expect(doc.segments[idx]?.kind).toBe('callout');
    // Everything before it is the cover or prose.
    for (const seg of doc.segments.slice(0, idx)) {
      expect(['meta', 'markdown']).toContain(seg.kind);
    }
  });

  it('every doc template resolves to a typed content block', () => {
    for (const [id, source] of Object.entries(DOC_TEMPLATES)) {
      const idx = firstContentIndex(source, id);
      const seg = parseDocument(source, id).segments[idx];
      expect(seg, id).toBeDefined();
      expect(seg?.kind, id).not.toBe('markdown');
      expect(seg?.kind, id).not.toBe('meta');
    }
  });
});
