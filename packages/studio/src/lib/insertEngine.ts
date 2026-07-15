/**
 * The insert engine: the catalog of insertable blocks (every type except
 * `meta`, which a doc gets exactly once via its cover) with human labels,
 * descriptions and family grouping, plus the fuzzy filter shared by the
 * Insert Menu ('+') and the slash command.
 *
 * Alias spellings (the 12 former block types in BLOCK_ALIASES / the derived
 * BLOCK_SYNONYMS) are searchable: typing "waterfall" surfaces a
 * "Chart — matches waterfall (kind: waterfall)" hit that inserts the CANONICAL
 * block with the alias patch pre-filled in the template body.
 */

import {
  BLOCK_ALIASES,
  BLOCK_DESCRIPTIONS,
  BLOCK_FAMILIES,
  BLOCK_FAMILY,
  BLOCK_LABELS,
  BLOCK_TYPES,
  templateBody,
  type BlockFamily,
  type BlockType,
} from '@avodado/core';

/** One insertable block, denormalised for display + filtering. */
export interface InsertItem {
  readonly type: BlockType;
  readonly label: string;
  readonly description: string;
  readonly family: BlockFamily;
  readonly familyLabel: string;
  /**
   * Set on alias hits only: the old spelling this hit matched (e.g.
   * `waterfall` on a `chart` item). Inserting an alias hit uses
   * {@link insertBodyFor}, which pre-fills the alias patch.
   */
  readonly alias?: string;
}

const FAMILY_LABEL: ReadonlyMap<BlockFamily, string> = new Map(
  BLOCK_FAMILIES.map((f) => [f.id, f.label]),
);

/** Every insertable block (registry order), `meta` excluded. */
export const INSERT_ITEMS: readonly InsertItem[] = BLOCK_TYPES.filter((t) => t !== 'meta').map(
  (type) => ({
    type,
    label: BLOCK_LABELS[type],
    description: BLOCK_DESCRIPTIONS[type],
    family: BLOCK_FAMILY[type],
    familyLabel: FAMILY_LABEL.get(BLOCK_FAMILY[type]) ?? BLOCK_FAMILY[type],
  }),
);

/** The "Popular" row shown before the family sections. */
export const POPULAR_TYPES: readonly BlockType[] = [
  'sequence',
  'table',
  'callout',
  'prose',
  'c4',
  'erd',
  'chart',
  'timeline',
  'flow',
  'userstory',
];

const BY_TYPE: ReadonlyMap<BlockType, InsertItem> = new Map(INSERT_ITEMS.map((i) => [i.type, i]));

/** `kind: waterfall`-style summary of an alias patch. */
function patchSummary(name: string): string {
  const patch = BLOCK_ALIASES[name]?.patch ?? {};
  return Object.entries(patch)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(', ');
}

/**
 * One searchable hit per alias spelling — the canonical item re-labelled
 * "Chart — matches waterfall (kind: waterfall)". Never shown when browsing
 * (empty query); only surfaced when a query matches the alias name.
 */
export const ALIAS_ITEMS: readonly InsertItem[] = Object.entries(BLOCK_ALIASES).flatMap(
  ([name, alias]) => {
    const base = BY_TYPE.get(alias.type);
    if (base === undefined) return [];
    const patch = patchSummary(name);
    return [
      {
        ...base,
        alias: name,
        label: `${base.label} — matches ${name}${patch === '' ? '' : ` (${patch})`}`,
        description: alias.description,
      },
    ];
  },
);

/**
 * The starter template body an insert should use: for a plain hit, the
 * canonical `templateBody(type)`; for an alias hit, the canonical template
 * with the alias patch pre-filled (e.g. `chart` with `kind: waterfall`).
 */
export function insertBodyFor(item: Pick<InsertItem, 'type' | 'alias'>): string {
  return item.alias === undefined ? templateBody(item.type) : aliasTemplateBody(item.alias);
}

/**
 * Composes the canonical starter template with an alias's patch: each patch
 * key overwrites its top-level `key: …` line when the template has one, and
 * is prepended otherwise. Patch keys are simple scalars (`kind` / `preset` /
 * `variant`), and top-level keys sit at column 0, so a `^key:` line match is
 * exact — nested keys are indented and never touched.
 */
export function aliasTemplateBody(name: string): string {
  const alias = BLOCK_ALIASES[name];
  if (alias === undefined) throw new RangeError(`unknown block alias: ${name}`);
  let body = templateBody(alias.type);
  for (const [key, value] of Object.entries(alias.patch ?? {})) {
    const line = `${key}: ${String(value)}`;
    const re = new RegExp(`^${key}:.*$`, 'm');
    body = re.test(body) ? body.replace(re, line) : `${line}\n${body}`;
  }
  return body;
}

/** The Popular row as InsertItems, in POPULAR_TYPES order. */
export function popularItems(): InsertItem[] {
  const out: InsertItem[] = [];
  for (const t of POPULAR_TYPES) {
    const item = BY_TYPE.get(t);
    if (item !== undefined) out.push(item);
  }
  return out;
}

/** INSERT_ITEMS grouped by family, in BLOCK_FAMILIES display order. */
export function itemsByFamily(): ReadonlyArray<{
  readonly family: BlockFamily;
  readonly label: string;
  readonly items: readonly InsertItem[];
}> {
  return BLOCK_FAMILIES.map((f) => ({
    family: f.id,
    label: f.label,
    items: INSERT_ITEMS.filter((i) => i.family === f.id),
  })).filter((g) => g.items.length > 0);
}

function score(item: InsertItem, q: string): number {
  // Alias hits score against the OLD SPELLING only — they never pile onto
  // queries that already match the canonical item.
  if (item.alias !== undefined) {
    if (item.alias === q) return 110;
    if (item.alias.startsWith(q)) return 85;
    if (item.alias.includes(q)) return 45;
    return 0;
  }
  const type = item.type;
  const label = item.label.toLowerCase();
  if (type === q) return 100;
  if (type.startsWith(q)) return 80;
  if (label.startsWith(q)) return 70;
  // Word-start match inside the label ("diagram" hits "Sequence diagram").
  if (label.split(/[\s/&-]+/).some((w) => w.startsWith(q))) return 60;
  if (label.includes(q)) return 50;
  if (type.includes(q)) return 45;
  if (item.description.toLowerCase().includes(q)) return 25;
  if (item.familyLabel.toLowerCase().includes(q)) return 15;
  return 0;
}

const SEARCHABLE: readonly InsertItem[] = [...INSERT_ITEMS, ...ALIAS_ITEMS];

/**
 * Filters + ranks insertable blocks for a query. An empty/blank query returns
 * every canonical item in registry order (no alias hits). Multi-word queries
 * require every word to match somewhere; the rank is the sum of the per-word
 * scores.
 */
export function filterInsertItems(query: string): InsertItem[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter((w) => w !== '');
  if (words.length === 0) return [...INSERT_ITEMS];
  const ranked: Array<{ item: InsertItem; rank: number; order: number }> = [];
  SEARCHABLE.forEach((item, order) => {
    let rank = 0;
    for (const w of words) {
      const s = score(item, w);
      if (s === 0) return; // every word must match
      rank += s;
    }
    ranked.push({ item, rank, order });
  });
  ranked.sort((a, b) => b.rank - a.rank || a.order - b.order);
  return ranked.map((r) => r.item);
}
