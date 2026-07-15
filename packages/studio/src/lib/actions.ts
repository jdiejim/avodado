/**
 * Block-level actions shared by the canvas toolbar, the Insert Menu, and the
 * slash command — thin wrappers over store.applyOp with core edit ops.
 */

import {
  insertBlock,
  insertProse,
  removeSegment,
  templateBody,
  type BlockType,
} from '@avodado/core';
import { useStudio } from '../state/store.js';
import { emitTourAction } from '../tour/bus.js';

/**
 * Inserts `type`'s starter template at gap `index`, selects it, and opens the
 * Edit Sheet so the user lands in "fill it out" mode. `body` overrides the
 * default starter template (alias hits pass a patched body, e.g. `chart`
 * with `kind: waterfall`). `opts.openSheet: false` skips the sheet — file
 * imports insert an already-filled block, so there is nothing to fill in.
 */
export function insertBlockAt(
  index: number,
  type: BlockType,
  body?: string,
  opts: { readonly openSheet?: boolean } = {},
): void {
  const s = useStudio.getState();
  const raw = body ?? templateBody(type);
  const ok = s.applyOp((src, doc) => insertBlock(src, doc, index, type, raw), index);
  if (ok) {
    if (opts.openSheet !== false) s.openSheet(index, true); // fresh: keyboard-first fill-in mode
    emitTourAction('insert');
  }
}

/** Duplicates the segment at `index` right below itself and selects the copy. */
export function duplicateSegment(index: number): void {
  const s = useStudio.getState();
  s.applyOp((src, doc) => {
    const seg = doc.segments[index];
    if (seg === undefined) throw new RangeError(`no segment ${index}`);
    return seg.kind === 'markdown'
      ? insertProse(src, doc, index + 1, seg.text)
      : insertBlock(src, doc, index + 1, seg.kind, seg.raw);
  }, index + 1);
}

/** Moves the segment one slot up (guarded — nothing moves above the meta cover). */
export function moveSegmentUp(index: number): void {
  useStudio.getState().moveBlock(index, index - 1);
}

/** Moves the segment one slot down (guarded). */
export function moveSegmentDown(index: number): void {
  useStudio.getState().moveBlock(index, index + 2);
}

/** Deletes the segment. */
export function deleteSegment(index: number): void {
  useStudio.getState().applyOp((src, doc) => removeSegment(src, doc, index), null);
}
