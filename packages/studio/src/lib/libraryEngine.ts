/**
 * The Block Library's pure logic: a browse-oriented view over the same
 * catalog as the insert engine — family sections in BLOCK_FAMILIES order,
 * a search that also matches alias spellings (BLOCK_SYNONYMS), family-pill
 * counts, and the roving-focus arithmetic for the card grid.
 *
 * Unlike the insert engine's ranked list, the library never re-orders: it is
 * a gallery, so filtering only *hides* cards — everything that matches stays
 * in registry order under its family heading. A query that matches a block
 * only through an old alias spelling (e.g. `waterfall` → `chart`) surfaces
 * the CANONICAL card, tagged with the alias so the UI can hint
 * "also: waterfall" and insert the patched template.
 */

import { BLOCK_ALIASES, BLOCK_FAMILIES, BLOCK_SYNONYMS, type BlockFamily } from '@avodado/core';
import { INSERT_ITEMS, insertBodyFor, type InsertItem } from './insertEngine.js';

/** One gallery card: a canonical item, plus the alias the query matched via. */
export interface LibraryHit {
  readonly item: InsertItem;
  /** Set when the query only matched an old alias spelling of this block. */
  readonly alias?: string;
}

/** One family section of the gallery. */
export interface LibraryGroup {
  readonly family: BlockFamily;
  readonly label: string;
  readonly hits: readonly LibraryHit[];
}

/** The family pill selection: a single family, or everything. */
export type FamilyFilter = BlockFamily | 'all';

/** Everything the gallery needs to render for a (query, family) pair. */
export interface LibraryView {
  /** Matching sections (family filter applied), BLOCK_FAMILIES order. */
  readonly groups: readonly LibraryGroup[];
  /** Cards visible under the current query + family filter. */
  readonly shown: number;
  /** Catalog size (every insertable block, `meta` excluded). */
  readonly total: number;
  /** Query matches per family, IGNORING the family pill (pill counts). */
  readonly familyCounts: ReadonlyMap<BlockFamily, number>;
  /** Query matches across all families (the "All" pill count). */
  readonly matched: number;
}

/** How a single query word matched an item. */
type WordMatch = { readonly via: 'direct' } | { readonly via: 'alias'; readonly alias: string } | null;

/**
 * Identity fields (slug, label) count as direct matches first; then alias
 * spellings; description/family only as a last resort. The order matters:
 * `chart`'s description happens to mention "waterfall", but someone typing
 * `waterfall` means the OLD BLOCK TYPE — the hit must carry the alias so the
 * card can say "also: waterfall" and insert the patched template.
 */
function matchWord(item: InsertItem, w: string): WordMatch {
  if (item.type.includes(w) || item.label.toLowerCase().includes(w)) return { via: 'direct' };
  for (const syn of BLOCK_SYNONYMS[item.type] ?? []) {
    if (syn.includes(w)) return { via: 'alias', alias: syn };
  }
  if (item.description.toLowerCase().includes(w) || item.familyLabel.toLowerCase().includes(w)) {
    return { via: 'direct' };
  }
  return null;
}

/**
 * Whether `item` matches every query word (label, slug, description, family
 * label, or an alias spelling). Returns the hit, tagged with the alias when
 * some word matched ONLY through an old spelling — that word is what makes
 * the card appear, so the card must explain itself ("also: waterfall").
 */
export function libraryHit(item: InsertItem, words: readonly string[]): LibraryHit | null {
  let alias: string | undefined;
  for (const w of words) {
    const m = matchWord(item, w);
    if (m === null) return null;
    if (m.via === 'alias' && alias === undefined) alias = m.alias;
  }
  return alias === undefined ? { item } : { item, alias };
}

/** Splits a query into lowercase words (empty array for blank queries). */
export function queryWords(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter((w) => w !== '');
}

/** Builds the gallery view for a query + family pill. Pure; cheap to re-run. */
export function libraryView(query: string, family: FamilyFilter): LibraryView {
  const words = queryWords(query);
  const hits = new Map<BlockFamily, LibraryHit[]>();
  let matched = 0;
  for (const item of INSERT_ITEMS) {
    const hit = libraryHit(item, words);
    if (hit === null) continue;
    matched += 1;
    const list = hits.get(item.family);
    if (list === undefined) hits.set(item.family, [hit]);
    else list.push(hit);
  }
  const familyCounts = new Map<BlockFamily, number>(
    BLOCK_FAMILIES.map((f) => [f.id, hits.get(f.id)?.length ?? 0]),
  );
  const groups = BLOCK_FAMILIES.filter((f) => family === 'all' || f.id === family)
    .map((f) => ({ family: f.id, label: f.label, hits: hits.get(f.id) ?? [] }))
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
 * The starter body a library hit inserts: the canonical template, or — for
 * an alias hit — the canonical template with the alias patch pre-filled
 * (`chart` with `kind: waterfall`). Same flow as the insert menus.
 */
export function hitInsertBody(hit: LibraryHit): string {
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

/** Where a library insert lands: after the selected block, else at doc end. */
export function insertGapIndex(selection: number | null, segmentCount: number): number {
  return selection !== null ? selection + 1 : segmentCount;
}

/* ─── roving focus ────────────────────────────────────────────────────────── */

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
