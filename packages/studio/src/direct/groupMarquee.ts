/**
 * Pure rules for GROUP ranges on the grid diagrams (flow, dfd, state, c4,
 * block):
 *
 * - MARQUEE creation — dragging on empty canvas draws a dashed marquee; on
 *   release the marquee snaps to the covered cell range and appends a
 *   `groups` item (`{col,row,cols,rows,label}` — the shared gridGroupSchema
 *   shape in core) as ONE applyOp / undo step;
 * - RESIZE — dragging a corner handle of the selected group rewrites the
 *   range with the opposite corner fixed ({@link resizeRange});
 * - MOVE — dragging the group's outline (or pressing arrows) shifts the whole
 *   range, same span ({@link moveRangeBy}); ⇧+arrows grow/shrink one axis
 *   ({@link growRange}).
 *
 * No React, no DOM — geometry comes in as the grid attrs the renderer
 * advertises. The DOM glue lives in `useGroupMarquee.ts` (create),
 * `useGroupResize.ts` (corner handles) and `useDrag.ts` (move).
 */

import { specFor } from './connect.js';
import { cellAtPoint, type Box, type GridGeom, type PathSet } from './drag.js';

/** A snapped cell range (1-based, inclusive spans). */
export interface CellRange {
  readonly col: number;
  readonly row: number;
  readonly cols: number;
  readonly rows: number;
}

/**
 * True when a block kind supports marquee groups — the connect spec table's
 * `groups` flag (flow, dfd, state, c4, block: their schemas carry the shared
 * `groups` field; graph's per-node `group` int is a different concept and
 * swimlane's rows are lanes).
 */
export function supportsGroups(kind: string): boolean {
  return specFor(kind)?.groups === true;
}

/**
 * Snaps a marquee (two corner points, CSS px relative to the SVG's top-left)
 * to the covered cell range: `cellAtPoint` on both corners, normalized so the
 * range reads top-left → spans regardless of drag direction.
 */
export function marqueeToCellRange(
  geom: GridGeom,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): CellRange {
  const a = cellAtPoint(geom, x1, y1);
  const b = cellAtPoint(geom, x2, y2);
  return {
    col: Math.min(a.col, b.col),
    row: Math.min(a.row, b.row),
    cols: Math.abs(a.col - b.col) + 1,
    rows: Math.abs(a.row - b.row) + 1,
  };
}

/**
 * The write that creates the group: one append to `groups` (one undo step),
 * seeded with a placeholder label the micro-editor opens on immediately.
 * Null when the kind has no `groups` field.
 */
export function groupOps(
  kind: string,
  data: unknown,
  range: CellRange,
): { sets: PathSet[]; groupPath: string } | null {
  if (!supportsGroups(kind)) return null;
  const rec =
    data !== null && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};
  const existing = Array.isArray(rec['groups']) ? rec['groups'] : [];
  const value = {
    col: range.col,
    row: range.row,
    cols: range.cols,
    rows: range.rows,
    label: 'Group',
  };
  return {
    sets: [{ path: ['groups', existing.length], value }],
    groupPath: `groups.${existing.length}`,
  };
}

/* ─── resizing / moving an EXISTING group ─────────────────────────────────── */

/** A corner handle of the selected group's rect. */
export type GroupCorner = 'nw' | 'ne' | 'sw' | 'se';

/** The group index a `data-bp` path addresses (`groups.3` → 3), or null. */
export function groupIndexFromPath(path: string): number | null {
  const m = /^groups\.(\d+)$/.exec(path);
  return m !== null ? Number(m[1]) : null;
}

/** The cell range of `groups[index]` in the block data (spans default 1). */
export function groupRangeAt(data: unknown, index: number): CellRange | null {
  const rec =
    data !== null && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null;
  const groups = rec !== null && Array.isArray(rec['groups']) ? rec['groups'] : null;
  const g = groups?.[index];
  if (g === null || g === undefined || typeof g !== 'object' || Array.isArray(g)) return null;
  const r = g as Record<string, unknown>;
  const col = r['col'];
  const row = r['row'];
  if (typeof col !== 'number' || typeof row !== 'number') return null;
  const cols = typeof r['cols'] === 'number' ? r['cols'] : 1;
  const rows = typeof r['rows'] === 'number' ? r['rows'] : 1;
  return { col, row, cols, rows };
}

/** The cell that stays FIXED while dragging `corner` — the opposite corner. */
export function fixedCellFor(corner: GroupCorner, range: CellRange): { col: number; row: number } {
  return {
    col: corner === 'nw' || corner === 'sw' ? range.col + range.cols - 1 : range.col,
    row: corner === 'nw' || corner === 'ne' ? range.row + range.rows - 1 : range.row,
  };
}

/**
 * The range spanning the fixed corner cell and the pointer's cell, normalized
 * so it reads top-left → spans (crossing over the anchor just flips the
 * range; 1×1 is the natural minimum). The pointer cell comes from
 * `cellAtPoint`, which already clamps to one cell beyond the grid — the same
 * growth allowance as the create-marquee.
 */
export function resizeRange(
  fixed: { col: number; row: number },
  pointer: { col: number; row: number },
): CellRange {
  return {
    col: Math.min(fixed.col, pointer.col),
    row: Math.min(fixed.row, pointer.row),
    cols: Math.abs(fixed.col - pointer.col) + 1,
    rows: Math.abs(fixed.row - pointer.row) + 1,
  };
}

/**
 * The range shifted by a cell delta, span unchanged: origin clamps to ≥ 1 and
 * the far edge to one col/row beyond the grid (the marquee's growth clamp).
 */
export function moveRangeBy(
  range: CellRange,
  dCol: number,
  dRow: number,
  gridCols: number,
  gridRows: number,
): CellRange {
  const clamp = (v: number, hi: number): number => Math.max(1, Math.min(v, hi));
  return {
    ...range,
    col: clamp(range.col + dCol, gridCols + 2 - range.cols),
    row: clamp(range.row + dRow, gridRows + 2 - range.rows),
  };
}

/**
 * Grows/shrinks one axis by ±1 (⇧+arrows on a selected group): the far edge
 * moves, the origin stays. Null when the step is fully clamped away (span
 * already 1, or the far edge already one beyond the grid).
 */
export function growRange(
  range: CellRange,
  axis: 'x' | 'y',
  dir: -1 | 1,
  gridCols: number,
  gridRows: number,
): CellRange | null {
  if (axis === 'x') {
    const cols = range.cols + dir;
    if (cols < 1 || range.col + cols - 1 > gridCols + 1) return null;
    return { ...range, cols };
  }
  const rows = range.rows + dir;
  if (rows < 1 || range.row + rows - 1 > gridRows + 1) return null;
  return { ...range, rows };
}

/**
 * The writes a corner-drag resize commits (one applyOp / undo step): the full
 * `{col,row,cols,rows}` of `groups[index]`. Null when nothing changed (the
 * release stays a no-op — no empty undo step).
 */
export function groupResizeSets(data: unknown, index: number, range: CellRange): PathSet[] | null {
  const cur = groupRangeAt(data, index);
  if (cur === null) return null;
  if (cur.col === range.col && cur.row === range.row && cur.cols === range.cols && cur.rows === range.rows) {
    return null;
  }
  return [
    { path: ['groups', index, 'col'], value: range.col },
    { path: ['groups', index, 'row'], value: range.row },
    { path: ['groups', index, 'cols'], value: range.cols },
    { path: ['groups', index, 'rows'], value: range.rows },
  ];
}

/**
 * The writes a whole-range move commits: only `col`/`row` (the span — and its
 * cols/rows-omitted spelling — stays untouched). Null when nothing changed.
 */
export function groupMoveSets(data: unknown, index: number, range: CellRange): PathSet[] | null {
  const cur = groupRangeAt(data, index);
  if (cur === null) return null;
  if (cur.col === range.col && cur.row === range.row) return null;
  return [
    { path: ['groups', index, 'col'], value: range.col },
    { path: ['groups', index, 'row'], value: range.row },
  ];
}

/** The union box of a cell range in CSS px relative to the SVG's top-left. */
export function rangeBox(geom: GridGeom, r: CellRange): Box {
  return {
    left: (geom.padX + (r.col - 1) * (geom.cellW + geom.gapX)) * geom.scale,
    top: (geom.padTop + (r.row - 1) * (geom.cellH + geom.gapY)) * geom.scale,
    width: (r.cols * geom.cellW + (r.cols - 1) * geom.gapX) * geom.scale,
    height: (r.rows * geom.cellH + (r.rows - 1) * geom.gapY) * geom.scale,
  };
}
