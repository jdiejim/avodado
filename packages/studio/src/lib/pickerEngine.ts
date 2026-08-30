/**
 * The insert picker's pure view-model — ONE search implementation (the insert
 * engine's `filterInsertItems`) behind both of the picker's faces:
 *
 * - COMPACT: a ranked flat list ({@link compactItems}) — what the slash
 *   command and the gap '+' popover show;
 * - BROWSE: a gallery ({@link browseView}) — family sections in
 *   BLOCK_FAMILIES order that filtering only *hides* cards from (a gallery
 *   never re-orders). A query that matches a block through an old alias
 *   spelling (e.g. `waterfall` → `chart`) surfaces the CANONICAL card tagged
 *   with the alias, so the UI can hint "also: waterfall" and insert the
 *   patched template.
 *
 * Also here: the insert-index rule shared by every entry point, and the
 * roving-focus arithmetic for the browse card grid.
 */

import { BLOCK_ALIASES, BLOCK_FAMILIES, type BlockFamily, type BlockType } from '@avodado/core';
import { filterInsertItems, INSERT_ITEMS, insertBodyFor, type InsertItem } from './insertEngine.js';

/** One picker hit: a canonical item, plus the alias the query matched via. */
export interface PickerHit {
  readonly item: InsertItem;
  /** Set when the query's best match for this block was an old spelling. */
  readonly alias?: string;
}

/** One family section of the browse gallery. */
export interface BrowseGroup {
  readonly family: BlockFamily;
  readonly label: string;
  readonly hits: readonly PickerHit[];
}

/** The family pill selection: a single family, or everything. */
export type FamilyFilter = BlockFamily | 'all';

/** Everything browse mode needs to render for a (query, family) pair. */
export interface BrowseView {
  /** Matching sections (family filter applied), BLOCK_FAMILIES order. */
  readonly groups: readonly BrowseGroup[];
  /** Cards visible under the current query + family filter. */
  readonly shown: number;
  /** Catalog size (every insertable block, `meta` excluded). */
  readonly total: number;
  /** Query matches per family, IGNORING the family pill (pill counts). */
  readonly familyCounts: ReadonlyMap<BlockFamily, number>;
  /** Query matches across all families (the "All" pill count). */
  readonly matched: number;
}

const CANONICAL: ReadonlyMap<BlockType, InsertItem> = new Map(
  INSERT_ITEMS.map((i) => [i.type, i]),
);

/** Compact mode's list: the ranked filter, capped at `max` rows. */
export function compactItems(query: string, max: number): InsertItem[] {
  return filterInsertItems(query).slice(0, max);
}

/**
 * One hit per block type for a query, derived from the SAME ranked filter as
 * compact mode: the first (highest-ranked) occurrence of a type decides
 * whether its card carries an alias tag — so `waterfall` (alias rank beats
 * chart's description match) tags the chart card, while `chart` (a direct
 * slug match) does not.
 */
export function browseHits(query: string): ReadonlyMap<BlockType, PickerHit> {
  const byType = new Map<BlockType, PickerHit>();
  for (const item of filterInsertItems(query)) {
    if (byType.has(item.type)) continue;
    const canonical = CANONICAL.get(item.type);
    if (canonical === undefined) continue;
    byType.set(
      item.type,
      item.alias === undefined ? { item: canonical } : { item: canonical, alias: item.alias },
    );
  }
  return byType;
}

/** Builds the gallery view for a query + family pill. Pure; cheap to re-run. */
export function browseView(query: string, family: FamilyFilter): BrowseView {
  const byType = browseHits(query);
  // Lay the hits out in registry order under their family headings — the
  // ranked order only decided WHICH cards show (and their alias tags).
  const perFamily = new Map<BlockFamily, PickerHit[]>();
  let matched = 0;
  for (const item of INSERT_ITEMS) {
    const hit = byType.get(item.type);
    if (hit === undefined) continue;
    matched += 1;
    const list = perFamily.get(item.family);
    if (list === undefined) perFamily.set(item.family, [hit]);
    else list.push(hit);
  }
  const familyCounts = new Map<BlockFamily, number>(
    BLOCK_FAMILIES.map((f) => [f.id, perFamily.get(f.id)?.length ?? 0]),
  );
  const groups = BLOCK_FAMILIES.filter((f) => family === 'all' || f.id === family)
    .map((f) => ({ family: f.id, label: f.label, hits: perFamily.get(f.id) ?? [] }))
    .filter((g) => g.hits.length > 0);
  return {
    groups,
    shown: groups.reduce((n, g) => n + g.hits.length, 0),
    total: INSERT_ITEMS.length,
    familyCounts,
    matched,
  };
}

/**
 * The starter body a picker hit inserts: the canonical template, or — for an
 * alias hit — the canonical template with the alias patch pre-filled
 * (`chart` with `kind: waterfall`).
 */
export function hitInsertBody(hit: PickerHit): string {
  return insertBodyFor(
    hit.alias === undefined ? { type: hit.item.type } : { type: hit.item.type, alias: hit.alias },
  );
}

/** `kind: waterfall`-style summary of an alias's patch (`''` if none). */
export function aliasPatchSummary(name: string): string {
  const patch = BLOCK_ALIASES[name]?.patch ?? {};
  return Object.entries(patch)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(', ');
}

/** Where a context-free insert lands: after the selection, else at doc end. */
export function insertGapIndex(selection: number | null, segmentCount: number): number {
  return selection !== null ? selection + 1 : segmentCount;
}

/**
 * Where the picker's insert lands: the invoking gap when it was opened from
 * one (`pinned`), otherwise after the selection / at the doc end — the same
 * rule for '/', the Library button, and browse mode.
 */
export function pickerInsertIndex(
  pinned: number | null,
  selection: number | null,
  segmentCount: number,
): number {
  return pinned ?? insertGapIndex(selection, segmentCount);
}

/* ─── roving focus (browse card grid) ─────────────────────────────────────── */

/** The keys the card grid's roving focus responds to. */
export type RoveKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End';

/** True when `key` is one the grid handles. */
export function isRoveKey(key: string): key is RoveKey {
  return (
    key === 'ArrowLeft' ||
    key === 'ArrowRight' ||
    key === 'ArrowUp' ||
    key === 'ArrowDown' ||
    key === 'Home' ||
    key === 'End'
  );
}

/**
 * The next roving-focus index in a `columns`-wide grid of `count` cards:
 * ←/→ step by one, ↑/↓ by a row (clamped to the first/last card so a partial
 * final row is still reachable), Home/End jump to the ends. `current` is
 * clamped first, so a stale index (after a filter change) recovers.
 */
export function roveIndex(current: number, key: RoveKey, columns: number, count: number): number {
  if (count <= 0) return 0;
  const cols = Math.max(1, columns);
  const cur = Math.min(Math.max(current, 0), count - 1);
  switch (key) {
    case 'ArrowLeft':
      return Math.max(0, cur - 1);
    case 'ArrowRight':
      return Math.min(count - 1, cur + 1);
    case 'ArrowUp':
      return Math.max(0, cur - cols);
    case 'ArrowDown':
      return Math.min(count - 1, cur + cols);
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
  }
}
