/**
 * Pure ops for the table GRID editor (array-of-rows-of-cells shapes —
 * `table.rows` plus its sibling `columns`). Column ops are COMPOUND: they
 * touch `columns` AND every row with the same padding semantics as the v8
 * drag reorder (`tableColumnReorderSets`): short rows are padded with `''`
 * up to the column count before a positional edit, and cells beyond the
 * column count keep their tail positions.
 *
 * All functions return NEW arrays (no mutation) so callers can commit them
 * directly as YAML path writes. Kept free of React/DOM.
 */

/** A cell value: string | number | detailed object — whatever the union allows. */
export type GridCell = unknown;
/** One row of cells. */
export type GridRow = readonly GridCell[];

function asRows(v: unknown): readonly GridRow[] {
  return Array.isArray(v) ? v.map((r) => (Array.isArray(r) ? (r as GridRow) : [])) : [];
}

function asCols(v: unknown): readonly unknown[] | null {
  return Array.isArray(v) ? v : null;
}

/**
 * The grid's column count: the `columns` length when present, else the
 * widest row (a headerless grid still has a rectangular editing surface).
 */
export function gridColCount(columns: unknown, rows: unknown): number {
  const cols = asCols(columns);
  if (cols !== null && cols.length > 0) return cols.length;
  return asRows(rows).reduce((m, r) => Math.max(m, r.length), 0);
}

/** A row padded with `''` up to `width` (never truncates). */
export function padRow(row: GridRow, width: number): GridCell[] {
  const out = row.slice();
  while (out.length < width) out.push('');
  return out;
}

/** A fresh all-empty row of `width` cells. */
export function emptyRow(width: number): GridCell[] {
  return Array.from({ length: Math.max(1, width) }, () => '');
}

/** True when every cell of the row is empty (`''`/null/undefined). */
export function isEmptyGridRow(row: GridRow): boolean {
  return row.every((c) => c === '' || c === null || c === undefined);
}

/** Rows with a new empty row appended (width follows the grid). */
export function gridAddRow(columns: unknown, rows: unknown): GridCell[][] {
  const rs = asRows(rows);
  return [...rs.map((r) => r.slice()), emptyRow(gridColCount(columns, rows))];
}

/** Rows with row `index` removed (out-of-range → unchanged copy). */
export function gridRemoveRow(rows: unknown, index: number): GridCell[][] {
  return asRows(rows)
    .filter((_, i) => i !== index)
    .map((r) => r.slice());
}

/** The compound result of a column op: the new `columns` + the new `rows`. */
export interface GridColumnsResult {
  /** New `columns` value, or null when the block has no columns field/value. */
  readonly columns: unknown[] | null;
  readonly rows: GridCell[][];
}

/**
 * Inserts an empty column at `at` (clamped 0…width): `columns` gains `''`
 * there (when present) and EVERY row gains an empty cell at the same
 * position — rows shorter than the insertion point are padded first, so the
 * new cell lands at the same visual column everywhere.
 */
export function gridInsertColumn(columns: unknown, rows: unknown, at: number): GridColumnsResult {
  const width = gridColCount(columns, rows);
  const i = Math.max(0, Math.min(at, width));
  const cols = asCols(columns);
  const nextCols = cols !== null ? [...cols.slice(0, i), '', ...cols.slice(i)] : null;
  const nextRows = asRows(rows).map((row) => {
    const padded = padRow(row, Math.min(i, width));
    return [...padded.slice(0, i), '', ...padded.slice(i)];
  });
  return { columns: nextCols, rows: nextRows };
}

/**
 * Removes the column at `at`: drops `columns[at]` (when present) and cell
 * `at` from every row — rows are padded to the column count first (v8
 * semantics), so ragged rows stay aligned; tail cells beyond the column
 * count keep their positions.
 */
export function gridRemoveColumn(columns: unknown, rows: unknown, at: number): GridColumnsResult {
  const width = gridColCount(columns, rows);
  if (at < 0 || at >= width) {
    return { columns: asCols(columns)?.slice() ?? null, rows: asRows(rows).map((r) => r.slice()) };
  }
  const cols = asCols(columns);
  const nextCols = cols !== null ? cols.filter((_, i) => i !== at) : null;
  const nextRows = asRows(rows).map((row) => {
    const padded = padRow(row, width);
    return [...padded.slice(0, at), ...padded.slice(at + 1)];
  });
  return { columns: nextCols, rows: nextRows };
}

/**
 * Plans the Enter rhythm inside the grid (the v6 rules, cell-wise):
 * - anywhere but the row's last cell → advance to the next cell;
 * - last cell of a filled row → advance to the next row's first cell, or
 *   APPEND a fresh row from the last row;
 * - last cell of an all-empty LAST row → exit (drop the empty row, leave
 *   the grid toward the next field).
 */
export type GridEnterAction =
  | { readonly kind: 'advance'; readonly row: number; readonly col: number }
  | { readonly kind: 'append' }
  | { readonly kind: 'exit' };

export function gridEnterAction(args: {
  readonly rows: unknown;
  readonly row: number;
  readonly col: number;
  readonly colCount: number;
}): GridEnterAction {
  const rs = asRows(args.rows);
  const isLastCell = args.col >= args.colCount - 1;
  const isLastRow = args.row >= rs.length - 1;
  const current = rs[args.row] ?? [];
  if (!isLastCell) return { kind: 'advance', row: args.row, col: args.col + 1 };
  if (isLastRow && isEmptyGridRow(current)) return { kind: 'exit' };
  if (isLastRow) return { kind: 'append' };
  return { kind: 'advance', row: args.row + 1, col: 0 };
}
