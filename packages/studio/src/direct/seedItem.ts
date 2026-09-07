/**
 * Kind-aware fixups for the generic "+ Add <item>" defaults. `newItemForList`
 * builds a schema-shaped item; this module patches the handful of cases where
 * the schema alone can't produce something USEFUL (or valid):
 *
 * - edge-ish lists (flow/dfd/graph/c4/block edges, state transitions,
 *   swimlane links, sequence messages) seed real endpoints — the first two
 *   node ids — through the connect spec's own `newEdge` builder;
 * - erd relations seed the first two entity names;
 * - statustable rows/subtasks need ≥1 cell and a KNOWN status (the schema
 *   validates the vocabulary, so an empty status is an error);
 * - matrix/journey/heatmap rows pad their cell arrays to the column count;
 * - prose blocks start as a paragraph with placeholder text.
 *
 * `blankListItem` is the second entry point: the context menu has no schema
 * tree to build from, so the list-ordered kinds keep their blank item here.
 *
 * Pure — no React, no DOM; validated per kind through the real pipeline in
 * the tests.
 */

import { specFor } from './connect.js';

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function arrayAt(data: unknown, key: string): unknown[] {
  const a = asRecord(data)?.[key];
  return Array.isArray(a) ? a : [];
}

function idsOf(data: unknown, listKey: string, idKey: string): string[] {
  return arrayAt(data, listKey)
    .map((n) => asRecord(n)?.[idKey])
    .filter((id): id is string => typeof id === 'string' && id !== '');
}

/**
 * Patches a freshly built list item for `kind`/`listPath` against the block
 * `data`. Returns the item (possibly replaced) — never throws, never returns
 * something less valid than its input.
 */
export function fixupNewItem(
  kind: string,
  listPath: string,
  item: unknown,
  data: unknown,
): unknown {
  // Edge lists: seed a real connection (first → second node; a self-loop
  // when the kind allows it and only one node exists).
  const spec = specFor(kind);
  if (spec !== null && listPath === spec.edgesField) {
    const ids = idsOf(data, spec.nodesField, spec.idField);
    const from = ids[0];
    const to = ids[1] ?? (spec.allowSelfLoop ? ids[0] : ids[1]);
    if (from !== undefined && to !== undefined) return spec.newEdge(from, to);
    return item;
  }

  if (kind === 'erd' && listPath === 'relations') {
    const names = arrayAt(data, 'entities')
      .map((e) => asRecord(e)?.['name'])
      .filter((n): n is string => typeof n === 'string' && n !== '');
    const rec = asRecord(item) ?? {};
    if (names.length >= 2) return { ...rec, from: names[0], to: names[1] };
    return item;
  }

  if (kind === 'statustable' && /^rows(\.\d+\.subtasks)?$/.test(listPath)) {
    const rec = asRecord(item) ?? {};
    const cols = arrayAt(data, 'columns');
    const width = Math.max(1, cols.length);
    const cells = Array.from({ length: width }, (_, i) => (i === 0 ? 'New row' : ''));
    // The vocabulary is user statuses first, then the built-ins — `todo` is
    // always known.
    const firstStatus = asRecord(arrayAt(data, 'statuses')[0])?.['label'];
    return { ...rec, cells, status: typeof firstStatus === 'string' ? firstStatus : 'todo' };
  }

  if (kind === 'matrix' && listPath === 'rows') {
    const rec = asRecord(item) ?? {};
    const width = arrayAt(data, 'cols').length;
    return { ...rec, cells: Array.from({ length: width }, () => '') };
  }

  if (kind === 'journey' && listPath === 'rows') {
    const rec = asRecord(item) ?? {};
    const width = arrayAt(data, 'stages').length;
    if (width === 0) return item;
    return { ...rec, cells: Array.from({ length: width }, () => '') };
  }

  if (kind === 'heatmap' && listPath === 'rows') {
    const rec = asRecord(item) ?? {};
    const width = Math.max(1, arrayAt(data, 'xLabels').length);
    return { ...rec, values: Array.from({ length: width }, () => 0) };
  }

  if (kind === 'scorecard' && listPath === 'options') {
    const rec = asRecord(item) ?? {};
    const width = arrayAt(data, 'criteria').length;
    if (width === 0) return item;
    return { ...rec, scores: Array.from({ length: width }, () => 0) };
  }

  if (kind === 'storymap' && listPath === 'slices') {
    // A new slice must carry one cell per backbone step (the schema checks
    // the alignment) — seed the row with empty cells.
    const rec = asRecord(item) ?? {};
    const width = arrayAt(data, 'backbone').length;
    return { ...rec, cells: Array.from({ length: width }, () => []) };
  }

  if (kind === 'prose' && listPath === 'blocks') {
    return { type: 'p', text: 'New paragraph' };
  }

  if (kind === 'okr' && listPath === 'items') {
    // An objective needs at least one key result (schema `min(1)`).
    const rec = asRecord(item) ?? {};
    return { ...rec, krs: [{ kr: 'New key result', progress: 0 }] };
  }

  return item;
}

/* ─── blank items for the list-ordered kinds (context menu) ───────────────── */

/**
 * One blank item per LIST-ORDERED kind (the `REORDER_LISTS` family): every
 * REQUIRED field of the item schema, nothing else. `Insert before` /
 * `Insert after` / `Add …` in the context menu seed from here, so the write
 * validates the moment it lands.
 */
const LIST_ITEM_SEEDS: Readonly<Record<string, () => Record<string, unknown>>> = {
  glossary: () => ({ term: 'New term', def: 'What it means' }),
  faq: () => ({ q: 'New question', a: 'The answer' }),
  steps: () => ({ title: 'New step' }),
  list: () => ({ lead: 'New item' }),
  takeaways: () => ({ text: 'New takeaway' }),
  agenda: () => ({ title: 'New item' }),
  team: () => ({ name: 'New member' }),
  stats: () => ({ value: '0', label: 'New stat' }),
  saga: () => ({ id: 'step', name: 'New step', service: 'Service' }),
};

/**
 * A blank item for `kind`'s ordered list, with a unique `id` when the schema
 * has one. Null for a kind outside the list family.
 */
export function blankListItem(kind: string, siblings: readonly unknown[]): unknown | null {
  const make = LIST_ITEM_SEEDS[kind];
  return make === undefined ? null : withUniqueId(make(), siblings);
}

/**
 * `item` with its `id` made unique against `siblings` — `step` → `step2` → …
 * Items without a string `id` pass through (nothing to keep unique).
 */
export function withUniqueId(item: unknown, siblings: readonly unknown[]): unknown {
  const rec = asRecord(item);
  const id = rec?.['id'];
  if (rec === null || typeof id !== 'string') return item;
  const used = new Set(
    siblings.map((s) => asRecord(s)?.['id']).filter((v): v is string => typeof v === 'string'),
  );
  const base = id.replace(/\d+$/, '') === '' ? 'item' : id.replace(/\d+$/, '');
  let next = base;
  let n = 2;
  while (used.has(next)) {
    next = `${base}${n}`;
    n += 1;
  }
  return { ...rec, id: next };
}
