/**
 * Mermaid-dialect fences render exactly like the typed block they convert
 * to: the catalog example parses to five typed segments, validates with zero
 * diagnostics, renders without throwing, and each block keeps its canonical
 * framing (the SECTION eyebrow of the canonical type — `sourceType: 'mermaid'`
 * is a dialect, not an alias, so it carries no historical label).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseDocument, validateDocument } from '@avodado/core';
import { renderDocument } from '../document.js';
import { renderDocumentSegments } from '../parts.js';
import { SECTION_LABEL, sectionLabelFor } from '../blocks/frame.js';

const EXAMPLE = resolve(import.meta.dirname, '../../../../docs/examples/mermaid-dialect.md');

describe('mermaid dialect rendering', () => {
  const md = readFileSync(EXAMPLE, 'utf8');
  const doc = parseDocument(md, 'examples/mermaid-dialect');
  const typed = doc.segments.flatMap((s) => (s.kind === 'markdown' || s.kind === 'meta' ? [] : [s]));

  it('the catalog example parses to the five typed blocks with zero diagnostics', () => {
    expect(typed.map((s) => s.kind)).toEqual(['sequence', 'flow', 'erd', 'state', 'chart']);
    for (const s of typed) {
      expect(s.sourceType).toBe('mermaid');
      expect(s.parseError).toBeUndefined();
    }
    expect(validateDocument(doc, 'docs/examples/mermaid-dialect.md')).toEqual([]);
  });

  it('renders the full document and every segment without throwing', () => {
    const html = renderDocument(doc);
    expect(html).toContain('<svg');
    const parts = renderDocumentSegments(doc);
    const rendered = parts.segments.filter((s) => s.html.includes('class="diagram"'));
    expect(rendered.length).toBeGreaterThanOrEqual(4);
    // No parse-error placeholder leaked into the output.
    expect(html).not.toContain('parse error:');
  });

  it('keeps the canonical block framing (no alias eyebrow)', () => {
    for (const s of typed) {
      expect(sectionLabelFor(s)).toBe(SECTION_LABEL[s.kind]);
    }
    expect(sectionLabelFor({ kind: 'sequence', sourceType: 'mermaid' })).toBe('Sequence');
  });
});
