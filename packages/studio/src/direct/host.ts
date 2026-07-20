/**
 * Commit routing for direct edits. A {@link DirectHost} is where a micro-edit
 * lands:
 *
 * - the CANVAS host routes each commit through `store.applyOp` as a
 *   `replaceBlockBody` (one undo step, one autosave — like any other edit);
 * - the SHEET host routes commits into the Edit Sheet's DRAFT (the document is
 *   untouched until Done), reusing the sheet's own `commitPath`/`deletePath`.
 *
 * The pure segment-body editors are exported separately so the routing rules
 * are unit-testable without a store.
 */

import {
  deleteYamlPath,
  parseBlockBody,
  replaceBlockBody,
  setYamlPath,
  textBodyYaml,
  type BlockType,
  type Document,
} from '@avodado/core';
import { useStudio } from '../state/store.js';
import { valueAt, type PathSeg } from './paths.js';

/**
 * Materializes TERSE sugar items along `path` before a structured edit: a
 * message written as `- api -> pay: authorize` is a scalar / single-pair map
 * in the RAW YAML, so `setYamlPath(raw, ['messages', 1, 'summary'], …)` can't
 * land. Wherever the raw item differs from its canonical (sugar-expanded)
 * parsed form, the item is rewritten as the canonical object first — then the
 * edit applies normally. Items already in object form pass through untouched.
 */
function materializeTerse(
  raw: string,
  data: unknown,
  path: ReadonlyArray<PathSeg>,
): string {
  if (path.length < 2) return raw;
  const parsed = parseBlockBody(raw);
  if (!parsed.ok) return raw;
  let out = raw;
  for (let i = 0; i < path.length - 1; i++) {
    if (typeof path[i] !== 'number') continue;
    const prefix = path.slice(0, i + 1);
    const rawV = valueAt(parsed.data, prefix);
    const canonV = valueAt(data, prefix);
    if (rawV === undefined || canonV === undefined) continue;
    if (JSON.stringify(rawV) !== JSON.stringify(canonV)) {
      out = setYamlPath(out, prefix, canonV);
      break; // the canonical subtree is fully object-shaped below this point
    }
  }
  return out;
}

/** Where micro-editor commits land. */
export interface DirectHost {
  readonly kind: BlockType;
  /** Sets `path` to `value` in the block body. */
  commitPath(path: ReadonlyArray<PathSeg>, value: unknown): void;
  /**
   * Sets SEVERAL paths in one commit (one undo step) — compound moves like a
   * table-column reorder or a cross-column kanban drag compose here.
   */
  commitPaths(sets: ReadonlyArray<{ path: ReadonlyArray<PathSeg>; value: unknown }>): void;
  /** Deletes the node at `path` from the block body. */
  deletePath(path: ReadonlyArray<PathSeg>): void;
  /** Escape hatch: open the full editor (sheet form / YAML tab). */
  openFull(): void;
  /** Optional user feedback (toast) — e.g. "auto-layout pinned". */
  notify?(message: string): void;
}

/** Pure: new SOURCE with `path` set inside segment `index`'s YAML body. */
export function setPathInSegment(
  source: string,
  doc: Document,
  index: number,
  path: ReadonlyArray<PathSeg>,
  value: unknown,
): string {
  const seg = doc.segments[index];
  if (seg === undefined || seg.kind === 'markdown') {
    throw new TypeError(`segment ${index} is not a typed block`);
  }
  // Bare-text bodies (callout/pullquote text sugar) canonicalize to explicit
  // YAML first, so structured path edits apply instead of throwing; terse
  // sugar items along the path materialize the same way.
  const raw0 = materializeTerse(textBodyYaml(seg.kind, seg.raw) ?? seg.raw, seg.data, path);
  return replaceBlockBody(source, doc, index, setYamlPath(raw0, path, value));
}

/**
 * Pure: new SOURCE with every `sets` entry applied to segment `index`'s YAML
 * body — the writes compose on the same raw, then ONE body replacement (so a
 * caller's applyOp stays one undo step).
 */
export function setPathsInSegment(
  source: string,
  doc: Document,
  index: number,
  sets: ReadonlyArray<{ path: ReadonlyArray<PathSeg>; value: unknown }>,
): string {
  const seg = doc.segments[index];
  if (seg === undefined || seg.kind === 'markdown') {
    throw new TypeError(`segment ${index} is not a typed block`);
  }
  let raw = textBodyYaml(seg.kind, seg.raw) ?? seg.raw;
  // Materialize BEFORE any write: materializeTerse compares against the
  // segment's parsed data, so running it mid-batch would see earlier writes
  // as "terse drift" and clobber them back to the pre-edit values.
  for (const s of sets) raw = materializeTerse(raw, seg.data, s.path);
  for (const s of sets) raw = setYamlPath(raw, s.path, s.value);
  return replaceBlockBody(source, doc, index, raw);
}

/** Pure: new SOURCE with the node at `path` deleted inside segment `index`'s body. */
export function deletePathInSegment(
  source: string,
  doc: Document,
  index: number,
  path: ReadonlyArray<PathSeg>,
): string {
  const seg = doc.segments[index];
  if (seg === undefined || seg.kind === 'markdown') {
    throw new TypeError(`segment ${index} is not a typed block`);
  }
  const raw0 = materializeTerse(textBodyYaml(seg.kind, seg.raw) ?? seg.raw, seg.data, path);
  return replaceBlockBody(source, doc, index, deleteYamlPath(raw0, path));
}

/** Canvas host for the block at `index`: each commit is one applyOp/undo step. */
export function canvasHost(index: number, kind: BlockType): DirectHost {
  return {
    kind,
    commitPath: (path, value) => {
      const s = useStudio.getState();
      s.applyOp((src, doc) => setPathInSegment(src, doc, index, path, value), index);
    },
    commitPaths: (sets) => {
      const s = useStudio.getState();
      s.applyOp((src, doc) => setPathsInSegment(src, doc, index, sets), index);
    },
    deletePath: (path) => {
      const s = useStudio.getState();
      s.applyOp((src, doc) => deletePathInSegment(src, doc, index, path), index);
    },
    openFull: () => useStudio.getState().openSheet(index),
    notify: (message) => useStudio.getState().toast(message),
  };
}
