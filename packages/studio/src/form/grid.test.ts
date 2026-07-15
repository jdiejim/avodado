import { describe, expect, it } from 'vitest';
import {
  emptyRow,
  gridAddRow,
  gridColCount,
  gridEnterAction,
  gridInsertColumn,
  gridRemoveColumn,
  gridRemoveRow,
  isEmptyGridRow,
  padRow,
} from './grid.js';

const columns = ['Region', { label: 'p50', align: 'r' }, 'p99'];
const rows = [
  ['us-east', 12, { v: 40, tone: 'warn' }],
  ['eu-west', 9], // ragged: one cell short
  ['ap-south', 14, 33, 'extra-tail'], // one cell PAST the columns
];

describe('gridColCount / padRow / emptyRow', () => {
  it('column count follows columns when present, else the widest row', () => {
    expect(gridColCount(columns, rows)).toBe(3);
    expect(gridColCount(undefined, rows)).toBe(4);
    expect(gridColCount([], [])).toBe(0);
  });

  it('padRow fills with empty strings and never truncates', () => {
    expect(padRow(['a'], 3)).toEqual(['a', '', '']);
    expect(padRow(['a', 'b', 'c', 'd'], 2)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('emptyRow yields at least one cell', () => {
    expect(emptyRow(0)).toEqual(['']);
    expect(emptyRow(3)).toEqual(['', '', '']);
  });
});

describe('row ops', () => {
  it('gridAddRow appends an empty row matching the grid width', () => {
    const next = gridAddRow(columns, rows);
    expect(next).toHaveLength(4);
    expect(next[3]).toEqual(['', '', '']);
    expect(next[0]).toEqual(rows[0]); // untouched copy
  });

  it('gridRemoveRow drops exactly the indexed row', () => {
    const next = gridRemoveRow(rows, 1);
    expect(next.map((r) => r[0])).toEqual(['us-east', 'ap-south']);
    expect(gridRemoveRow(rows, 99)).toHaveLength(3);
  });
});

describe('column ops — compound columns+rows consistency (v8 padding semantics)', () => {
  it('insert pads ragged rows so the new cell lands at the same visual column', () => {
    const { columns: cols, rows: rs } = gridInsertColumn(columns, rows, 2);
    expect(cols).toEqual(['Region', { label: 'p50', align: 'r' }, '', 'p99']);
    expect(rs[0]).toEqual(['us-east', 12, '', { v: 40, tone: 'warn' }]);
    // The short row is padded up to the insertion point first.
    expect(rs[1]).toEqual(['eu-west', 9, '']);
    // Tail cells past the column count keep their positions.
    expect(rs[2]).toEqual(['ap-south', 14, '', 33, 'extra-tail']);
  });

  it('append at the end grows every row', () => {
    const { columns: cols, rows: rs } = gridInsertColumn(columns, rows, 3);
    expect(cols).toHaveLength(4);
    expect(rs[1]).toEqual(['eu-west', 9, '', '']);
  });

  it('remove drops the same index from columns and every row (short rows padded first)', () => {
    const { columns: cols, rows: rs } = gridRemoveColumn(columns, rows, 1);
    expect(cols).toEqual(['Region', 'p99']);
    expect(rs[0]).toEqual(['us-east', { v: 40, tone: 'warn' }]);
    expect(rs[1]).toEqual(['eu-west', '']); // padded, then column 1 removed
    expect(rs[2]).toEqual(['ap-south', 33, 'extra-tail']);
  });

  it('remove out of range is a no-op copy; headerless grids keep columns null', () => {
    expect(gridRemoveColumn(columns, rows, 9).columns).toEqual(columns);
    const res = gridInsertColumn(undefined, rows, 1);
    expect(res.columns).toBeNull();
    expect(res.rows[1]).toEqual(['eu-west', '', 9]);
  });
});

describe('gridEnterAction — the v6 rhythm, cell-wise', () => {
  const grid = [
    ['a', 'b'],
    ['c', ''],
  ];

  it('advances to the next cell, then wraps to the next row', () => {
    expect(gridEnterAction({ rows: grid, row: 0, col: 0, colCount: 2 })).toEqual({
      kind: 'advance',
      row: 0,
      col: 1,
    });
    expect(gridEnterAction({ rows: grid, row: 0, col: 1, colCount: 2 })).toEqual({
      kind: 'advance',
      row: 1,
      col: 0,
    });
  });

  it('appends a row from the last filled cell', () => {
    expect(gridEnterAction({ rows: grid, row: 1, col: 1, colCount: 2 })).toEqual({
      kind: 'append',
    });
  });

  it('exits from the last cell of an all-empty last row', () => {
    const withEmpty = [...grid, ['', '']];
    expect(gridEnterAction({ rows: withEmpty, row: 2, col: 1, colCount: 2 })).toEqual({
      kind: 'exit',
    });
  });

  it('isEmptyGridRow tolerates nullish cells', () => {
    expect(isEmptyGridRow(['', null, undefined])).toBe(true);
    expect(isEmptyGridRow(['', 0])).toBe(false);
  });
});
