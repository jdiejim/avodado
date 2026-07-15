/**
 * Insert-engine behaviour: the catalog excludes `meta`, the filter ranks
 * sensibly across slug/label/description/family, and the Popular row and
 * family grouping stay consistent with the core registry.
 */

import { describe, expect, it } from 'vitest';
import { BLOCK_ALIASES, BLOCK_TYPES, parseDocument, templateBody, validateDocument } from '@avodado/core';
import {
  ALIAS_ITEMS,
  aliasTemplateBody,
  filterInsertItems,
  INSERT_ITEMS,
  insertBodyFor,
  itemsByFamily,
  POPULAR_TYPES,
  popularItems,
} from './insertEngine.js';

describe('INSERT_ITEMS', () => {
  it('covers every block type except meta, with label + description + family', () => {
    expect(INSERT_ITEMS.length).toBe(BLOCK_TYPES.length - 1);
    expect(INSERT_ITEMS.some((i) => i.type === 'meta')).toBe(false);
    for (const item of INSERT_ITEMS) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.description.length).toBeGreaterThan(0);
      expect(item.familyLabel.length).toBeGreaterThan(0);
    }
  });

  it('popularItems resolves every POPULAR_TYPES entry, in order', () => {
    const popular = popularItems();
    expect(popular.map((i) => i.type)).toEqual([...POPULAR_TYPES]);
  });

  it('itemsByFamily partitions the full catalog', () => {
    const grouped = itemsByFamily();
    const all = grouped.flatMap((g) => g.items.map((i) => i.type));
    expect(all.sort()).toEqual(INSERT_ITEMS.map((i) => i.type).sort());
  });
});

describe('filterInsertItems', () => {
  it('empty query returns the whole catalog in registry order', () => {
    expect(filterInsertItems('')).toEqual([...INSERT_ITEMS]);
    expect(filterInsertItems('   ')).toEqual([...INSERT_ITEMS]);
  });

  it('an exact slug wins the top spot', () => {
    expect(filterInsertItems('erd')[0]?.type).toBe('erd');
    expect(filterInsertItems('c4')[0]?.type).toBe('c4');
  });

  it('matches human labels, not just slugs', () => {
    const types = filterInsertItems('entity').map((i) => i.type);
    expect(types[0]).toBe('erd'); // "Entity-relationship diagram"
  });

  it('slug prefix beats a label word-match', () => {
    const seq = filterInsertItems('seq');
    expect(seq[0]?.type).toBe('sequence');
  });

  it('falls back to description and family text', () => {
    expect(filterInsertItems('kubernetes').some((i) => i.type === 'cluster')).toBe(true);
    const agents = filterInsertItems('agents').map((i) => i.type);
    expect(agents).toEqual(expect.arrayContaining(['agentloop', 'trace']));
  });

  it('multi-word queries require every word to match', () => {
    const res = filterInsertItems('state machine');
    expect(res[0]?.type).toBe('state');
    expect(filterInsertItems('state zzz')).toEqual([]);
  });

  it('returns nothing for garbage', () => {
    expect(filterInsertItems('qqqqxyz')).toEqual([]);
  });
});

describe('alias (synonym) search', () => {
  it('has one alias item per BLOCK_ALIASES entry, labelled "matches <alias>"', () => {
    expect(ALIAS_ITEMS.length).toBe(Object.keys(BLOCK_ALIASES).length);
    const waterfall = ALIAS_ITEMS.find((i) => i.alias === 'waterfall');
    expect(waterfall?.type).toBe('chart');
    expect(waterfall?.label).toBe('Data chart — matches waterfall (kind: waterfall)');
  });

  it('typing an old spelling surfaces its canonical block first', () => {
    for (const [name, alias] of Object.entries(BLOCK_ALIASES)) {
      const top = filterInsertItems(name)[0];
      expect(top?.type).toBe(alias.type);
      expect(top?.alias).toBe(name);
    }
  });

  it('alias hits never appear when browsing or on canonical queries', () => {
    expect(filterInsertItems('').some((i) => i.alias !== undefined)).toBe(false);
    expect(filterInsertItems('chart').some((i) => i.alias !== undefined)).toBe(false);
  });

  it('a prefix of the old spelling matches too', () => {
    const hits = filterInsertItems('waterf');
    expect(hits[0]?.alias).toBe('waterfall');
  });
});

describe('aliasTemplateBody / insertBodyFor', () => {
  it('pre-fills the patch, overriding an existing top-level key', () => {
    const body = aliasTemplateBody('waterfall');
    expect(body).toMatch(/^kind: waterfall$/m);
    expect(body).not.toContain('kind: line'); // chart's default kind replaced
  });

  it('prepends the patch when the canonical template lacks the key', () => {
    const body = aliasTemplateBody('infra');
    expect(body).toMatch(/^preset: infra$/m);
  });

  it('never touches nested (indented) keys', () => {
    // flow's template has `kind:` inside node items — those must survive.
    const body = aliasTemplateBody('dag');
    expect(body).toMatch(/^variant: dag$/m);
    expect(body).toContain('kind: start');
  });

  it('every alias body inserts as a VALID canonical block', () => {
    for (const [name, alias] of Object.entries(BLOCK_ALIASES)) {
      const body = insertBodyFor({ type: alias.type, alias: name });
      const source = '```' + alias.type + '\n' + body + '\n```\n';
      const doc = parseDocument(source, `alias-${name}`);
      const errors = validateDocument(doc, `alias-${name}.md`).filter((d) => d.level === 'error');
      expect(errors, `${name} → ${alias.type}`).toEqual([]);
      // The patch actually landed in the parsed data.
      const seg = doc.segments[0];
      const data = seg !== undefined && seg.kind !== 'markdown' ? (seg.data as Record<string, unknown>) : {};
      for (const [k, v] of Object.entries(alias.patch ?? {})) {
        expect(data[k], `${name}.${k}`).toBe(v);
      }
    }
  });

  it('plain hits use the canonical starter template', () => {
    expect(insertBodyFor({ type: 'chart' })).toBe(templateBody('chart'));
  });
});
