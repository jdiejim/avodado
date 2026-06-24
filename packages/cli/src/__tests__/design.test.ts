import { describe, expect, it } from 'vitest';
import { parseDocument, validateDocument } from '@avodado/core';
import { DESIGN_PATTERNS, patternDoc, buildDesignDoc } from '../commands/design.js';

describe('design pattern library', () => {
  it('has unique slugs', () => {
    const slugs = DESIGN_PATTERNS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('every pattern template validates clean', () => {
    for (const p of DESIGN_PATTERNS) {
      const doc = parseDocument(patternDoc(p), p.slug);
      const diags = validateDocument(doc, `${p.slug}.md`);
      expect(diags, `${p.slug} should have no diagnostics`).toEqual([]);
    }
  });

  it('each gallery (all / system / ai / code) validates clean', () => {
    for (const filter of [undefined, 'system', 'ai', 'code'] as const) {
      const md = buildDesignDoc(filter);
      const doc = parseDocument(md, 'design');
      const diags = validateDocument(doc, 'design.md');
      expect(diags, `${filter ?? 'all'} gallery should have no diagnostics`).toEqual([]);
    }
  });
});
