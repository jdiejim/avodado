import { describe, expect, it } from 'vitest';
import { BLOCK_TYPES, parseDocument, validateDocument } from '@avodado/core';
import { buildCatalogDoc } from '../commands/catalog.js';

describe('buildCatalogDoc', () => {
  it('covers every block type (except the meta cover) and validates clean', () => {
    const md = buildCatalogDoc();
    // one `## <type>` heading per block, skipping `meta` (it's the cover)
    for (const t of BLOCK_TYPES) {
      if (t === 'meta') continue;
      expect(md, `catalog should have a section for ${t}`).toContain(`## ${t}\n`);
    }
    const doc = parseDocument(md, 'catalog');
    const diags = validateDocument(doc, 'catalog.md');
    expect(diags, 'catalog should have no diagnostics').toEqual([]);
  });
});
