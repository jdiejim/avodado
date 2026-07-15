import { describe, expect, it } from 'vitest';
import { parseDocument, validateDocument, type Diagnostic } from '@avodado/core';
import { DESIGN_PATTERNS, patternDoc, buildDesignDoc } from '../commands/design.js';

/**
 * Diagnostics that should fail a "validates clean" gate. Alias spellings are
 * valid forever and emit only the informational `W_ALIAS_TYPE` warning
 * (warnings never fail `avo check`) — everything else still counts.
 */
const failing = (diags: readonly Diagnostic[]): readonly Diagnostic[] =>
  diags.filter((d) => !(d.code === 'W_ALIAS_TYPE' && d.level === 'warn'));

describe('design pattern library', () => {
  it('has unique slugs', () => {
    const slugs = DESIGN_PATTERNS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('every pattern template validates clean', () => {
    for (const p of DESIGN_PATTERNS) {
      const doc = parseDocument(patternDoc(p), p.slug);
      const diags = validateDocument(doc, `${p.slug}.md`);
      expect(failing(diags), `${p.slug} should have no diagnostics`).toEqual([]);
    }
  });

  it('each gallery (all / system / ai / code), page and slides, validates clean', () => {
    for (const filter of [undefined, 'system', 'ai', 'code'] as const) {
      for (const slides of [false, true]) {
        const md = buildDesignDoc(filter, slides);
        const doc = parseDocument(md, 'design');
        const diags = validateDocument(doc, 'design.md');
        expect(
          failing(diags),
          `${filter ?? 'all'} gallery (slides=${slides}) should have no diagnostics`,
        ).toEqual([]);
      }
    }
  });
});
