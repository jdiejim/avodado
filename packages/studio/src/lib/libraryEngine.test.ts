/**
 * Block Library logic: the browse view (search incl. alias synonyms, family
 * pill combination, counts), alias-insert wiring, and the roving-focus grid
 * arithmetic.
 */

import { describe, expect, it } from 'vitest';
import { BLOCK_FAMILIES, templateBody } from '@avodado/core';
import { aliasTemplateBody, INSERT_ITEMS } from './insertEngine.js';
import {
  aliasPatchSummary,
  hitInsertBody,
  insertGapIndex,
  isRoveKey,
  libraryHit,
  libraryView,
  queryWords,
  roveIndex,
} from './libraryEngine.js';

describe('libraryView', () => {
  it('empty query shows the whole catalog, grouped in BLOCK_FAMILIES order', () => {
    const v = libraryView('', 'all');
    expect(v.total).toBe(INSERT_ITEMS.length);
    expect(v.shown).toBe(v.total);
    expect(v.matched).toBe(v.total);
    const familyOrder = BLOCK_FAMILIES.map((f) => f.id);
    const groupOrder = v.groups.map((g) => g.family);
    expect(groupOrder).toEqual(familyOrder.filter((id) => groupOrder.includes(id)));
    // Browsing never tags aliases.
    expect(v.groups.flatMap((g) => g.hits).every((h) => h.alias === undefined)).toBe(true);
  });

  it('groups keep registry order and account for every item exactly once', () => {
    const v = libraryView('', 'all');
    const flat = v.groups.flatMap((g) => g.hits.map((h) => h.item.type));
    expect(new Set(flat).size).toBe(INSERT_ITEMS.length);
    for (const g of v.groups) {
      const registry = INSERT_ITEMS.filter((i) => i.family === g.family).map((i) => i.type);
      expect(g.hits.map((h) => h.item.type)).toEqual(registry);
    }
  });

  it("'waterfall' surfaces the canonical chart card tagged with the alias", () => {
    const v = libraryView('waterfall', 'all');
    const hits = v.groups.flatMap((g) => g.hits);
    const chart = hits.find((h) => h.item.type === 'chart');
    expect(chart).toBeDefined();
    expect(chart?.alias).toBe('waterfall');
  });

  it("'chart' matches the slug directly — no alias tag", () => {
    const hits = libraryView('chart', 'all').groups.flatMap((g) => g.hits);
    const chart = hits.find((h) => h.item.type === 'chart');
    expect(chart).toBeDefined();
    expect(chart?.alias).toBeUndefined();
  });

  it('multi-word queries require every word (alias words still tag)', () => {
    const hits = libraryView('waterfall chart', 'all').groups.flatMap((g) => g.hits);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.item.type === 'chart' && h.alias === 'waterfall')).toBe(true);
    expect(libraryView('waterfall zzz-no-match', 'all').shown).toBe(0);
  });

  it('description words match (searching prose finds blocks)', () => {
    const hits = libraryView('runbook', 'all').groups.flatMap((g) => g.hits);
    expect(hits.some((h) => h.item.type === 'steps')).toBe(true);
  });

  it('family pill narrows what is shown but not the pill counts', () => {
    const family = INSERT_ITEMS[0]?.family;
    if (family === undefined) throw new Error('empty catalog');
    const v = libraryView('', family);
    expect(v.groups).toHaveLength(1);
    expect(v.groups[0]?.family).toBe(family);
    expect(v.shown).toBe(v.familyCounts.get(family));
    expect(v.matched).toBe(v.total); // pills still count all query matches
    // The counts map covers every family regardless of the pill.
    expect([...v.familyCounts.keys()]).toEqual(BLOCK_FAMILIES.map((f) => f.id));
  });

  it('query and family pill combine', () => {
    const all = libraryView('diagram', 'all');
    expect(all.shown).toBeGreaterThan(0);
    const withMatches = [...all.familyCounts].filter(([, n]) => n > 0);
    expect(withMatches.length).toBeGreaterThan(1);
    const [famId, famCount] = withMatches[0] ?? ['narrative', 0];
    const narrowed = libraryView('diagram', famId);
    expect(narrowed.shown).toBe(famCount);
    expect(narrowed.matched).toBe(all.matched);
    expect(narrowed.groups.every((g) => g.family === famId)).toBe(true);
  });

  it('no match → zero shown, empty groups', () => {
    const v = libraryView('zzzzzz', 'all');
    expect(v.shown).toBe(0);
    expect(v.matched).toBe(0);
    expect(v.groups).toEqual([]);
    expect([...v.familyCounts.values()].every((n) => n === 0)).toBe(true);
  });
});

describe('libraryHit / queryWords', () => {
  it('splits queries into lowercase words', () => {
    expect(queryWords('  Waterfall  CHART ')).toEqual(['waterfall', 'chart']);
    expect(queryWords('   ')).toEqual([]);
  });

  it('tags the alias only when a word matched through it', () => {
    const chart = INSERT_ITEMS.find((i) => i.type === 'chart');
    if (chart === undefined) throw new Error('no chart item');
    expect(libraryHit(chart, ['waterfall'])?.alias).toBe('waterfall');
    expect(libraryHit(chart, ['chart'])?.alias).toBeUndefined();
    expect(libraryHit(chart, ['nope-nope'])).toBeNull();
  });
});

describe('alias-insert wiring', () => {
  it('an alias hit inserts the canonical template with the patch pre-filled', () => {
    const chart = INSERT_ITEMS.find((i) => i.type === 'chart');
    if (chart === undefined) throw new Error('no chart item');
    const body = hitInsertBody({ item: chart, alias: 'waterfall' });
    expect(body).toBe(aliasTemplateBody('waterfall'));
    expect(body).toContain('kind: waterfall');
  });

  it('a plain hit inserts the canonical starter template', () => {
    const seq = INSERT_ITEMS.find((i) => i.type === 'sequence');
    if (seq === undefined) throw new Error('no sequence item');
    expect(hitInsertBody({ item: seq })).toBe(templateBody('sequence'));
  });

  it('aliasPatchSummary renders the patch as key: value', () => {
    expect(aliasPatchSummary('waterfall')).toBe('kind: waterfall');
    expect(aliasPatchSummary('not-an-alias')).toBe('');
  });
});

describe('insertGapIndex', () => {
  it('lands after the selection, or at the doc end', () => {
    expect(insertGapIndex(2, 7)).toBe(3);
    expect(insertGapIndex(null, 7)).toBe(7);
    expect(insertGapIndex(null, 0)).toBe(0);
  });
});

describe('roveIndex', () => {
  it('steps left/right with clamping', () => {
    expect(roveIndex(3, 'ArrowRight', 4, 10)).toBe(4);
    expect(roveIndex(9, 'ArrowRight', 4, 10)).toBe(9);
    expect(roveIndex(3, 'ArrowLeft', 4, 10)).toBe(2);
    expect(roveIndex(0, 'ArrowLeft', 4, 10)).toBe(0);
  });

  it('moves by a row up/down, clamped to the ends', () => {
    expect(roveIndex(1, 'ArrowDown', 4, 10)).toBe(5);
    expect(roveIndex(7, 'ArrowDown', 4, 10)).toBe(9); // partial last row reachable
    expect(roveIndex(5, 'ArrowUp', 4, 10)).toBe(1);
    expect(roveIndex(2, 'ArrowUp', 4, 10)).toBe(0);
  });

  it('Home/End jump to the ends', () => {
    expect(roveIndex(5, 'Home', 4, 10)).toBe(0);
    expect(roveIndex(5, 'End', 4, 10)).toBe(9);
  });

  it('recovers from a stale index and degenerate grids', () => {
    expect(roveIndex(42, 'ArrowLeft', 4, 10)).toBe(8);
    expect(roveIndex(-3, 'ArrowRight', 4, 10)).toBe(1);
    expect(roveIndex(0, 'ArrowDown', 0, 3)).toBe(1); // columns clamp to 1
    expect(roveIndex(0, 'ArrowDown', 4, 0)).toBe(0); // empty grid
  });

  it('isRoveKey recognises exactly the grid keys', () => {
    for (const k of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']) {
      expect(isRoveKey(k)).toBe(true);
    }
    expect(isRoveKey('Enter')).toBe(false);
    expect(isRoveKey('Tab')).toBe(false);
  });
});
