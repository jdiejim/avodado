/**
 * Block-type aliases — the 12 former block types that merged into a canonical
 * type. The old spellings remain valid forever: the splitter recognises an
 * alias fence, the parser maps it to its canonical `kind` (recording the tag
 * as written in `sourceType`) and injects the alias `patch` for any keys the
 * body doesn't set (body wins). Validation surfaces a `W_ALIAS_TYPE` warning —
 * informational only; warnings never fail `avo check`.
 *
 * The display data (`sectionLabel`, `label`, `description`) is the exact text
 * these types carried before the merge, so alias fences keep rendering with
 * their historical framing (e.g. an `infra` block still gets the "Deployment"
 * section eyebrow).
 */

import type { BlockType } from '../types.js';

/** One alias entry: the canonical target plus presentation/patch data. */
export interface BlockAlias {
  /** The canonical block type this alias parses to. */
  readonly type: BlockType;
  /**
   * Data injected at parse time for keys ABSENT in the body (body wins).
   * E.g. `waterfall` injects `{ kind: 'waterfall' }` into its `chart` data.
   */
  readonly patch?: Readonly<Record<string, unknown>>;
  /** The SECTION eyebrow this type rendered with before the merge. */
  readonly sectionLabel: string;
  /** Human display name (what the type was called in editing UIs). */
  readonly label: string;
  /** One-line "what it's for" (the type's former catalog description). */
  readonly description: string;
}

/** The permanent aliases, keyed by the old fence tag. */
export const BLOCK_ALIASES: Readonly<Record<string, BlockAlias>> = {
  infra: {
    type: 'block',
    patch: { preset: 'infra' },
    sectionLabel: 'Deployment',
    label: 'Cloud infrastructure',
    description: 'Cloud topology (same engine as block) — CDN / gateway / compute / DB.',
  },
  event: {
    type: 'block',
    patch: { preset: 'event' },
    sectionLabel: 'Events',
    label: 'Pub/sub topology',
    description: 'Pub/sub topology — producers → topics → consumers.',
  },
  ddd: {
    type: 'block',
    patch: { preset: 'ddd' },
    sectionLabel: 'Context map',
    label: 'Bounded-context map',
    description: 'A DDD bounded-context map.',
  },
  network: {
    type: 'block',
    patch: { preset: 'network' },
    sectionLabel: 'Security zones',
    label: 'Network zones',
    description: 'Security zones with trust boundaries (supports forbidden edges).',
  },
  belogic: {
    type: 'felogic',
    patch: { variant: 'be' },
    sectionLabel: 'Backend logic',
    label: 'Backend logic graph',
    description: 'Backend module graph — controller / service / repository / adapter.',
  },
  dag: {
    type: 'flow',
    patch: { variant: 'dag' },
    sectionLabel: 'DAG',
    label: 'Pipeline DAG',
    description: 'A pipeline / DAG (CI-CD-flavoured flow).',
  },
  waterfall: {
    type: 'chart',
    patch: { kind: 'waterfall' },
    sectionLabel: 'Budget',
    label: 'Budget waterfall',
    description:
      'A budget cascade — bars start where the previous total ended, with an optional dashed budget cap.',
  },
  funnel: {
    type: 'chart',
    patch: { kind: 'funnel' },
    sectionLabel: 'Funnel',
    label: 'Conversion funnel',
    description:
      'A conversion funnel — stacked bands proportional to value, with stage-to-stage conversion chips.',
  },
  diff: {
    type: 'code',
    patch: { kind: 'diff' },
    sectionLabel: 'Diff',
    label: 'Code diff',
    description: 'A unified diff on the dark editor surface — added / removed / hunk lines.',
  },
  terminal: {
    type: 'code',
    patch: { kind: 'terminal' },
    sectionLabel: 'Terminal',
    label: 'Terminal session',
    description:
      'A shell session on the dark surface — $ commands, # comments, and output lines.',
  },
  mece: {
    type: 'tree',
    patch: { variant: 'issue' },
    sectionLabel: 'Issue tree',
    label: 'MECE issue tree',
    description: 'A MECE issue tree — one problem split into exclusive branches.',
  },
  tracker: {
    type: 'statustable',
    patch: { variant: 'tracker' },
    sectionLabel: 'Tracker',
    label: 'Task tracker',
    description: 'A task list with status / priority / owner / due.',
  },
};

/** Runtime set of alias fence tags for fast membership checks. */
export const ALIAS_TYPE_SET: ReadonlySet<string> = new Set(Object.keys(BLOCK_ALIASES));

/**
 * Alias spellings per canonical type, derived from {@link BLOCK_ALIASES} —
 * e.g. `chart` → `['waterfall', 'funnel']`. Search/insert UIs index these so
 * typing an old name finds its canonical block.
 */
export const BLOCK_SYNONYMS: Readonly<Partial<Record<BlockType, readonly string[]>>> = (() => {
  const out: Partial<Record<BlockType, string[]>> = {};
  for (const [name, alias] of Object.entries(BLOCK_ALIASES)) {
    (out[alias.type] ??= []).push(name);
  }
  return out;
})();
