/**
 * The insert picker's view-model: both faces (compact list / browse gallery)
 * over the ONE search implementation, the insert-index rule, and the roving
 * grid arithmetic.
 */

import { describe, expect, it } from 'vitest';
import { BLOCK_FAMILIES, templateBody } from '@avodado/core';
import { filterInsertItems, INSERT_ITEMS } from './insertEngine.js';
import {
  aliasPatchSummary,
  browseView,
  compactItems,
  hitInsertBody,
  insertGapIndex,
  isRoveKey,
  pickerInsertIndex,
  roveIndex,
} from './pickerEngine.js';

describe('compactItems', () => {
  it('caps the ranked filter at max rows', () => {
    expect(compactItems('', 9)).toHaveLength(9);
    expect(compactItems('', 9)[0]?.type).toBe(INSERT_ITEMS[0]?.type);
  });

  it('ranks a slug prefix match first ("seq" → sequence)', () => {
    expect(compactItems('seq', 9)[0]?.type).toBe('sequence');
  });
});

describe('browseView', () => {
  it('empty query shows the whole catalog, grouped in BLOCK_FAMILIES order', () => {
    const v = browseView('', 'all');
    expect(v.shown).toBe(INSERT_ITEMS.length);
    expect(v.matched).toBe(INSERT_ITEMS.length);
    const order = BLOCK_FAMILIES.map((f) => f.id).filter((id) =>
      v.groups.some((g) => g.family === id),
    );
    expect(v.groups.map((g) => g.family)).toEqual(order);
  });

  it('groups keep registry order and account for every item exactly once', () => {
    const v = browseView('', 'all');
    const types = v.groups.flatMap((g) => g.hits.map((h) => h.item.type));
    expect(new Set(types).size).toBe(INSERT_ITEMS.length);
    for (const g of v.groups) {
      const registry = INSERT_ITEMS.filter((i) => i.family === g.family).map((i) => i.type);
      expect(g.hits.map((h) => h.item.type)).toEqual(registry);
    }
  });

  it('shows exactly the block types the ranked filter matches (one search impl)', () => {
    for (const q of ['diagram', 'api', 'flow', 'zzz-nothing']) {
      const fromFilter = new Set(filterInsertItems(q).map((i) => i.type));
      const fromBrowse = new Set(
        browseView(q, 'all').groups.flatMap((g) => g.hits.map((h) => h.item.type)),
      );
      expect(fromBrowse).toEqual(fromFilter);
    }
  });

  it("'waterfall' surfaces the canonical chart card tagged with the alias", () => {
    const v = browseView('waterfall', 'all');
    const hits = v.groups.flatMap((g) => g.hits);
    const chart = hits.find((h) => h.item.type === 'chart');
    expect(chart?.alias).toBe('waterfall');
  });

  it("'chart' matches the slug directly — no alias tag", () => {
    const hits = browseView('chart', 'all').groups.flatMap((g) => g.hits);
    const chart = hits.find((h) => h.item.type === 'chart');
    expect(chart).toBeDefined();
    expect(chart?.alias).toBeUndefined();
  });

  it('family pill narrows what is shown but not the pill counts', () => {
    const all = browseView('', 'all');
    const first = BLOCK_FAMILIES.find((f) => (all.familyCounts.get(f.id) ?? 0) > 0);
    expect(first).toBeDefined();
    if (first === undefined) return;
    const narrowed = browseView('', first.id);
    expect(narrowed.groups).toHaveLength(1);
    expect(narrowed.shown).toBe(all.familyCounts.get(first.id));
    expect(narrowed.matched).toBe(all.matched);
    expect(narrowed.familyCounts).toEqual(all.familyCounts);
  });

  it('no match → zero shown, empty groups', () => {
    const v = browseView('no-such-block-here', 'all');
    expect(v.shown).toBe(0);
    expect(v.groups).toEqual([]);
    expect(v.matched).toBe(0);
  });
});

describe('alias-insert wiring', () => {
  it('an alias hit inserts the canonical template with the patch pre-filled', () => {
    const hits = browseView('waterfall', 'all').groups.flatMap((g) => g.hits);
    const chart = hits.find((h) => h.item.type === 'chart');
    expect(chart).toBeDefined();
    if (chart === undefined) return;
    expect(hitInsertBody(chart)).toMatch(/^kind: waterfall$/m);
  });

  it('a plain hit inserts the canonical starter template', () => {
    const hits = browseView('chart', 'all').groups.flatMap((g) => g.hits);
    const chart = hits.find((h) => h.item.type === 'chart');
    expect(chart).toBeDefined();
    if (chart === undefined) return;
    expect(hitInsertBody(chart)).toBe(templateBody('chart'));
  });

  it('aliasPatchSummary renders the patch as key: value', () => {
    expect(aliasPatchSummary('waterfall')).toBe('kind: waterfall');
    expect(aliasPatchSummary('not-an-alias')).toBe('');
  });
});

describe('insert index', () => {
  it('insertGapIndex lands after the selection, or at the doc end', () => {
    expect(insertGapIndex(2, 7)).toBe(3);
    expect(insertGapIndex(null, 7)).toBe(7);
    expect(insertGapIndex(null, 0)).toBe(0);
  });

  it('pickerInsertIndex: a pinned gap wins; otherwise the context rule', () => {
    expect(pickerInsertIndex(4, 2, 7)).toBe(4); // gap '+' — even with a selection
    expect(pickerInsertIndex(0, 2, 7)).toBe(0); // gap 0 is a real pin, not a fallback
    expect(pickerInsertIndex(null, 2, 7)).toBe(3); // '/' or Library: after selection
    expect(pickerInsertIndex(null, null, 7)).toBe(7); // …else the doc end
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
    expect(roveIndex(5, 'ArrowDown', 4, 10)).toBe(9);
    expect(roveIndex(1, 'ArrowDown', 4, 10)).toBe(5);
    expect(roveIndex(5, 'ArrowUp', 4, 10)).toBe(1);
    expect(roveIndex(1, 'ArrowUp', 4, 10)).toBe(0);
  });

  it('Home/End jump to the ends', () => {
    expect(roveIndex(5, 'Home', 4, 10)).toBe(0);
    expect(roveIndex(5, 'End', 4, 10)).toBe(9);
  });

  it('recovers from a stale index and degenerate grids', () => {
    expect(roveIndex(99, 'ArrowLeft', 4, 10)).toBe(8);
    expect(roveIndex(-3, 'ArrowRight', 4, 10)).toBe(1);
    expect(roveIndex(0, 'ArrowDown', 0, 3)).toBe(1); // columns clamp to 1
    expect(roveIndex(5, 'ArrowDown', 4, 0)).toBe(0); // empty grid
  });

  it('isRoveKey recognises exactly the grid keys', () => {
    for (const k of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']) {
      expect(isRoveKey(k)).toBe(true);
    }
    expect(isRoveKey('Enter')).toBe(false);
    expect(isRoveKey('a')).toBe(false);
  });
});
