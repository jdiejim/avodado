/**
 * Pure predicates deciding whether a delete needs its confirm popover.
 * Destructive deletes always confirm; deleting scaffolding the user never
 * touched (a just-inserted template block, a still-seeded array item — the
 * same seed-compare rules the form's Enter rhythm uses) must not nag.
 */

import { describeBlockSchema, templateBody, type BlockType, type Segment } from '@avodado/core';
import {
  newItemForList,
  parseBlockPath,
  resolveFieldAt,
  singularize,
  valueAt,
} from '../direct/paths.js';
import { isPristineRow } from '../form/keyboard.js';

/**
 * Whether deleting the whole segment is destructive. Empty prose and a typed
 * block still equal to its insert template are pristine — no confirm.
 */
export function needsBlockDeleteConfirm(seg: Segment): boolean {
  if (seg.kind === 'markdown') return seg.text.trim() !== '';
  const raw = seg.raw.trim();
  return raw !== '' && raw !== templateBody(seg.kind).trim();
}

/**
 * Whether deleting the array item at `itemPath` (dot-joined, index-last, as
 * produced by `deletablePathFor` / hover ×) is destructive. An item that is
 * still {@link isPristineRow}-equal to what `newItemForList` would have
 * seeded in its place skips the confirm. Anything unresolvable (schema drift,
 * non-item path) errs on the safe side and confirms.
 */
export function needsPartDeleteConfirm(
  kind: BlockType,
  data: unknown,
  itemPath: string,
): boolean {
  const segs = parseBlockPath(itemPath);
  const idx = segs[segs.length - 1];
  if (typeof idx !== 'number') return true;
  const listPath = segs.slice(0, -1);
  const node = resolveFieldAt(describeBlockSchema(kind), listPath);
  if (node === null || node.kind !== 'array') return true;
  const items = valueAt(data, listPath);
  if (!Array.isArray(items) || idx >= items.length) return true;
  const name = [...listPath].reverse().find((s): s is string => typeof s === 'string') ?? 'item';
  // Same convention as the form: the seed is built from the siblings BEFORE
  // the row (ids/copied values depend on them).
  const seed = newItemForList(node.element, items.slice(0, idx), singularize(name));
  return !isPristineRow(items[idx], seed);
}
