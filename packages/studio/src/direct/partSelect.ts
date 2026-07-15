/**
 * Pure rules for PART SELECTION — the level between block selection and the
 * micro-editor (the Figma model): click a `data-bp` part to select it, ⏎ to
 * edit, plain arrows to move it, ⌫ to delete, Esc to pop back out.
 *
 * This module decides:
 * - what a selected part IS ({@link classifyPart}: grid node / reorderable
 *   array item / table cell / inert scalar) — which drives whether arrows
 *   move, navigate, or fall through to the page;
 * - what one arrow press does to a list item ({@link planItemArrow}) or a
 *   table-cell cursor ({@link planCellNav});
 * - where the selection lands AFTER a move ({@link indexAfterReorder},
 *   {@link pathAfterReorder}, {@link kanbanPathAfterMove}) — reorders change
 *   the item's index, so the selection path must be remapped to follow it;
 * - which surface owns the keyboard ({@link keySurface}: sheet > part >
 *   block > canvas).
 *
 * No React, no DOM — geometry comes in as measured rects/counts. The DOM glue
 * lives in `useDrag.ts` / `DirectLayer.tsx`.
 */

import { dragTargetFor } from './drag.js';
import { joinBlockPath, parseBlockPath } from './paths.js';

/* ─── classification ──────────────────────────────────────────────────────── */

/** What arrows do to the selected part. */
export type PartClass =
  /** Grid node: arrows move one cell (`listPath` = nodes/states/steps). */
  | { readonly kind: 'grid'; readonly listPath: string; readonly index: number }
  /** Dashed group wrapper: arrows move the range; ⇧+arrows grow/shrink it. */
  | { readonly kind: 'grid-group'; readonly index: number }
  /** Table cell: arrows NAVIGATE the cell cursor (spreadsheet model). */
  | { readonly kind: 'table-cell'; readonly row: number; readonly col: number }
  /** Table header cell: ←→ run the compound columns+rows reorder. */
  | { readonly kind: 'table-col'; readonly index: number }
  /** Kanban card: ↑↓ reorder within the column, ←→ hop columns. */
  | { readonly kind: 'kanban-card'; readonly col: number; readonly index: number }
  /**
   * Any other array item — or a scalar leaf INSIDE one (a glossary row's
   * term). Arrows reorder along the list's measured axis; `suffix` keeps the
   * selection on the same leaf after the move (`.term` → `terms.2.term`).
   */
  | { readonly kind: 'item'; readonly listPath: string; readonly index: number; readonly suffix?: string }
  /** Scalar part (a callout body, a title): arrows fall through. */
  | { readonly kind: 'inert' };

/**
 * Classifies a selected `data-bp` path. Table CELLS come first (they navigate
 * — moving a single cell makes no sense); then the block-specific v8 drag
 * mapping (actors, rows-via-cells → row, header → column, kanban, grid
 * nodes); then the GENERIC rule: the nearest enclosing array item — the path
 * itself (`terms.2`) or a scalar leaf inside one (`terms.2.term`) — is a
 * reorderable item of its parent list (glossary terms, faq items, steps,
 * sequence messages, chart series, okr krs, …). Only paths with NO array
 * ancestor (a callout body, the block title) are inert.
 */
export function classifyPart(blockKind: string, path: string): PartClass {
  if (blockKind === 'table') {
    const cell = /^rows\.(\d+)\.(\d+)$/.exec(path);
    if (cell !== null) {
      return { kind: 'table-cell', row: Number(cell[1]), col: Number(cell[2]) };
    }
  }
  const t = dragTargetFor(blockKind, path);
  if (t !== null) {
    if (t.mode === 'grid-node') return { kind: 'grid', listPath: t.listPath, index: t.index };
    if (t.mode === 'grid-group') return { kind: 'grid-group', index: t.index };
    if (t.mode === 'table-cols') return { kind: 'table-col', index: t.index };
    if (t.mode === 'kanban-card') return { kind: 'kanban-card', col: t.col, index: t.index };
    // 'reorder' and 'ring' targets are both plain list items to the keyboard.
    return { kind: 'item', listPath: t.listPath, index: t.index };
  }
  const segs = parseBlockPath(path);
  // The nearest enclosing array item: the LAST numeric segment.
  let k = -1;
  for (let i = segs.length - 1; i >= 0; i--) {
    if (typeof segs[i] === 'number') {
      k = i;
      break;
    }
  }
  if (k < 0) return { kind: 'inert' };
  const listPath = joinBlockPath(segs.slice(0, k));
  const index = segs[k] as number;
  // A scalar leaf INSIDE a grid node (a state's tagged `name` text) moves the
  // node itself — arrows shift its cell, not the array order.
  const item = dragTargetFor(blockKind, `${listPath}.${index}`);
  if (item !== null && item.mode === 'grid-node') {
    return { kind: 'grid', listPath: item.listPath, index };
  }
  const suffix = k < segs.length - 1 ? `.${joinBlockPath(segs.slice(k + 1))}` : '';
  return {
    kind: 'item',
    listPath,
    index,
    ...(suffix !== '' ? { suffix } : {}),
  };
}

/**
 * The array-item path ⌫ removes for a selected part: the part itself when it
 * IS an item, else the enclosing item its classification points at (deleting
 * a glossary row from its term, a timeline entry from its label). Table
 * cells and no-array scalars delete nothing.
 */
export function deletablePathFor(blockKind: string, path: string): string | null {
  const cls = classifyPart(blockKind, path);
  switch (cls.kind) {
    case 'item':
      return `${cls.listPath}.${cls.index}`;
    case 'kanban-card':
      return `columns.${cls.col}.cards.${cls.index}`;
    case 'grid':
      return `${cls.listPath}.${cls.index}`;
    case 'grid-group':
      return `groups.${cls.index}`;
    case 'table-col':
      return `columns.${cls.index}`;
    default:
      // Table cells (deleting one would shift the row) and no-array scalars.
      return null;
  }
}

/**
 * Whether arrows should be CAPTURED for this part (preventDefault — movable
 * parts and table cells must not scroll the page); inert parts release the
 * key so the page scrolls normally.
 */
export function capturesArrows(cls: PartClass): boolean {
  return cls.kind !== 'inert';
}

/* ─── one arrow press, planned ────────────────────────────────────────────── */

export type ArrowKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown';

/** True for ←/→. */
export function isHorizontal(key: ArrowKey): boolean {
  return key === 'ArrowLeft' || key === 'ArrowRight';
}

/** -1 for ←/↑, +1 for →/↓. */
export function arrowDir(key: ArrowKey): -1 | 1 {
  return key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1;
}

/**
 * Plans a one-step reorder of item `index` in a list laid out along `axis`:
 * the insertion GAP for the v8 op builders plus the item's new index (the
 * selection remap). Null when the key is off-axis or the item is at the edge.
 */
export function planItemArrow(args: {
  readonly axis: 'x' | 'y';
  readonly key: ArrowKey;
  readonly index: number;
  readonly length: number;
}): { gap: number; newIndex: number } | null {
  if ((args.axis === 'x') !== isHorizontal(args.key)) return null;
  const dir = arrowDir(args.key);
  const newIndex = args.index + dir;
  if (newIndex < 0 || newIndex >= args.length) return null;
  return { gap: dir < 0 ? args.index - 1 : args.index + 2, newIndex };
}

/**
 * Plans a spreadsheet-style cell-cursor move. ←→ stay within the row's cells;
 * ↑↓ change rows, clamping the column to the new row's width (ragged rows).
 * Null at the table's edges (no wrap).
 */
export function planCellNav(args: {
  readonly row: number;
  readonly col: number;
  readonly key: ArrowKey;
  readonly rowCount: number;
  readonly colsInRow: (row: number) => number;
}): { row: number; col: number } | null {
  const dir = arrowDir(args.key);
  if (isHorizontal(args.key)) {
    const col = args.col + dir;
    if (col < 0 || col >= args.colsInRow(args.row)) return null;
    return { row: args.row, col };
  }
  const row = args.row + dir;
  if (row < 0 || row >= args.rowCount) return null;
  const width = args.colsInRow(row);
  if (width <= 0) return null;
  return { row, col: Math.min(args.col, width - 1) };
}

/* ─── selection remap after a move ────────────────────────────────────────── */

/**
 * Where item `from` ends up after an insert-into-`gap` reorder (the exact
 * inverse bookkeeping of {@link applyReorder}): no-op gaps keep the index,
 * `gap < from` lands ON the gap, `gap > from + 1` lands one before it.
 */
export function indexAfterReorder(from: number, gap: number): number {
  if (gap === from || gap === from + 1) return from;
  return gap > from ? gap - 1 : gap;
}

/** The selection path that follows a reordered list item. */
export function pathAfterReorder(listPath: string, from: number, gap: number): string {
  return `${listPath}.${indexAfterReorder(from, gap)}`;
}

/** The selection path that follows a kanban card after a move/hop. */
export function kanbanPathAfterMove(args: {
  readonly fromCol: number;
  readonly fromIdx: number;
  readonly toCol: number;
  readonly gap: number;
  /** The TARGET column's card count BEFORE the move (cross-column clamp). */
  readonly targetLen: number;
}): string {
  if (args.fromCol === args.toCol) {
    return `columns.${args.fromCol}.cards.${indexAfterReorder(args.fromIdx, args.gap)}`;
  }
  const idx = Math.max(0, Math.min(args.gap, args.targetLen));
  return `columns.${args.toCol}.cards.${idx}`;
}

/* ─── keyboard routing precedence ─────────────────────────────────────────── */

/** Which surface owns the keyboard right now. */
export type KeySurface = 'sheet' | 'part' | 'block' | 'canvas';

/**
 * The precedence ladder: the modal sheet first, then a selected PART (its
 * arrows/⏎/⌫/Esc must never fall through to block navigation), then the
 * selected block, then the bare canvas.
 */
export function keySurface(args: {
  readonly sheetOpen: boolean;
  readonly partSelected: boolean;
  readonly blockSelected: boolean;
}): KeySurface {
  if (args.sheetOpen) return 'sheet';
  if (args.partSelected) return 'part';
  if (args.blockSelected) return 'block';
  return 'canvas';
}
