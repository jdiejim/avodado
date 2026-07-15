import { describe, expect, it } from 'vitest';
import {
  parseCsv,
  csvToTable,
  csvToStatustable,
  csvToChart,
  suggestCsvImport,
  type ImportDiagnostic,
} from '../import/csv.js';
import { parseDocument } from '../parser.js';
import { validateDocument } from '../validate.js';
import type { Diagnostic } from '../diagnostics.js';

/** Round-trips a fence through parse → validate; returns ERROR diagnostics. */
function roundTripErrors(fence: string): Diagnostic[] {
  const doc = parseDocument(fence, 'csv-import');
  return validateDocument(doc, 'csv-import.md').filter((d) => d.level === 'error');
}

function errors(diagnostics: readonly ImportDiagnostic[]): ImportDiagnostic[] {
  return diagnostics.filter((d) => d.level === 'error');
}
function warns(diagnostics: readonly ImportDiagnostic[]): ImportDiagnostic[] {
  return diagnostics.filter((d) => d.level === 'warn');
}

// ─── fixtures ────────────────────────────────────────────────────────────────

const SIMPLE = 'name,qty,price\nWidget,4,9.99\nGadget,12,3.5\n';
const QUOTED = 'name,note\n"Widget, large","He said ""hi""\nsecond line"\n"plain",simple\n';
const CRLF_BOM = '﻿name;qty\r\nWidget;4\r\nGadget;7\r\n';
const RAGGED = 'a,b,c\n1,2\n3,4,5,6\n';
const SEMI = 'name;qty\nWidget;4\n';
const TAB = 'name\tqty\nWidget\t4\n';
const NUMERIC_HEAVY = 'month,revenue,cost\nJan,1200,800\nFeb,1350,900\nMar,1500,950\n';
const STATUS_CSV =
  'Task,Update,Status\nPayment retries,Backoff merged,done\nVendor SSO,Waiting on creds,blocked\nRate limits,PR in review,in progress\n';
const UNICODE = 'név,összeg\nKávé ☕,3\n日本語,42\n';
const ONE_COL = 'name\nWidget\nGadget\n';
const HEADER_ONLY = 'name,qty\n';

// ─── parseCsv ────────────────────────────────────────────────────────────────

describe('parseCsv', () => {
  it('parses simple comma-separated rows', () => {
    const { rows, diagnostics } = parseCsv(SIMPLE);
    expect(rows).toEqual([
      ['name', 'qty', 'price'],
      ['Widget', '4', '9.99'],
      ['Gadget', '12', '3.5'],
    ]);
    expect(diagnostics).toEqual([]);
  });

  it('handles quoted fields with embedded delimiters, escaped quotes, and newlines', () => {
    const { rows, diagnostics } = parseCsv(QUOTED);
    expect(rows).toEqual([
      ['name', 'note'],
      ['Widget, large', 'He said "hi"\nsecond line'],
      ['plain', 'simple'],
    ]);
    expect(diagnostics).toEqual([]);
  });

  it('strips a BOM and handles CRLF line endings', () => {
    const { rows, diagnostics } = parseCsv(CRLF_BOM);
    expect(rows).toEqual([
      ['name', 'qty'],
      ['Widget', '4'],
      ['Gadget', '7'],
    ]);
    expect(diagnostics).toEqual([]);
  });

  it('handles lone-CR line endings', () => {
    const { rows } = parseCsv('a,b\r1,2\r');
    expect(rows).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('does not emit a phantom record for the trailing newline', () => {
    expect(parseCsv('a,b\n1,2\n').rows).toHaveLength(2);
    expect(parseCsv('a,b\n1,2').rows).toHaveLength(2);
  });

  it('skips blank lines between records', () => {
    const { rows, diagnostics } = parseCsv('a,b\n\n1,2\n\n\n3,4\n');
    expect(rows).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
    ]);
    expect(diagnostics).toEqual([]);
  });

  it('trims unquoted fields but preserves quoted ones verbatim', () => {
    const { rows } = parseCsv('a, b ,"  c  "\n');
    expect(rows).toEqual([['a', 'b', '  c  ']]);
  });

  it('auto-detects semicolon and tab delimiters', () => {
    expect(parseCsv(SEMI).rows).toEqual([
      ['name', 'qty'],
      ['Widget', '4'],
    ]);
    expect(parseCsv(TAB).rows).toEqual([
      ['name', 'qty'],
      ['Widget', '4'],
    ]);
  });

  it('detection ignores delimiter characters inside quotes', () => {
    // Two semicolons outside quotes beat the three commas inside quotes.
    const { rows } = parseCsv('"a,b,c,d";x;y\n');
    expect(rows).toEqual([['a,b,c,d', 'x', 'y']]);
  });

  it('an explicit delimiter overrides detection', () => {
    const { rows } = parseCsv('a;b\n', { delimiter: ',' });
    expect(rows).toEqual([['a;b']]);
  });

  it('pads ragged rows and warns with row numbers', () => {
    const { rows, diagnostics } = parseCsv(RAGGED);
    expect(rows).toEqual([
      ['a', 'b', 'c', ''],
      ['1', '2', '', ''],
      ['3', '4', '5', '6'],
    ]);
    const w = warns(diagnostics);
    expect(w.map((d) => d.row)).toEqual([2, 3]);
    expect(errors(diagnostics)).toEqual([]);
  });

  it('reports an unterminated quote as an error with the row number, never throwing', () => {
    const { rows, diagnostics } = parseCsv('a,b\n1,"never closed\n');
    const errs = errors(diagnostics);
    expect(errs).toHaveLength(1);
    expect(errs[0]?.row).toBe(2);
    expect(errs[0]?.message).toMatch(/unterminated/);
    expect(rows[1]).toEqual(['1', 'never closed\n']);
  });

  it('warns (once per row) about text after a closing quote, keeping it', () => {
    const { rows, diagnostics } = parseCsv('a,b\n"x"tra,"y"z9\n');
    expect(rows[1]).toEqual(['xtra', 'yz9']);
    expect(warns(diagnostics)).toHaveLength(1);
  });

  it('returns no rows for empty and whitespace-only input', () => {
    expect(parseCsv('').rows).toEqual([]);
    expect(parseCsv('\n\n').rows).toEqual([]);
  });
});

// ─── csvToTable ──────────────────────────────────────────────────────────────

describe('csvToTable', () => {
  it('maps header to columns and body to rows, typing numeric cells', () => {
    const res = csvToTable(SIMPLE);
    expect(res.data).toEqual({
      columns: ['name', 'qty', 'price'],
      rows: [
        ['Widget', 4, 9.99],
        ['Gadget', 12, 3.5],
      ],
    });
    expect(errors(res.diagnostics)).toEqual([]);
  });

  it('keeps id-like strings with leading zeros as strings', () => {
    const res = csvToTable('id,qty\n007,0\n0042,0.5\n-01,-3\n');
    expect(res.data?.rows).toEqual([
      ['007', 0],
      ['0042', 0.5],
      ['-01', -3],
    ]);
  });

  it('keeps non-plain numerics (1e5, .5, 1,200) as strings', () => {
    const res = csvToTable('a,b,c\n1e5,.5,"1,200"\n');
    expect(res.data?.rows).toEqual([['1e5', '.5', '1,200']]);
  });

  it('honours title and firstRowHeader: false', () => {
    const res = csvToTable('1,2\n3,4\n', { firstRowHeader: false, title: 'Raw grid' });
    expect(res.data).toEqual({
      title: 'Raw grid',
      rows: [
        [1, 2],
        [3, 4],
      ],
    });
  });

  it('names blank header cells Column N', () => {
    const res = csvToTable(',qty\nWidget,4\n');
    expect(res.data?.columns).toEqual(['Column 1', 'qty']);
  });

  it('emits a compact house-style fence', () => {
    const res = csvToTable(SIMPLE, { title: 'Inventory' });
    expect(res.fence).toBe(
      [
        '```table',
        'title: Inventory',
        'columns: [name, qty, price]',
        'rows:',
        '  - [Widget, 4, 9.99]',
        '  - [Gadget, 12, 3.5]',
        '```',
        '',
      ].join('\n'),
    );
  });

  it('quotes cells that YAML would otherwise mangle', () => {
    const res = csvToTable('a,b\n007,"x: y"\n');
    expect(res.fence).toContain('"007"');
    expect(res.fence).toContain('"x: y"');
    expect(roundTripErrors(res.fence ?? '')).toEqual([]);
  });

  it('returns data: null with an error for empty input', () => {
    const res = csvToTable('');
    expect(res.data).toBeNull();
    expect(res.fence).toBeNull();
    expect(errors(res.diagnostics)).toHaveLength(1);
  });

  it('accepts a header-only CSV (columns, no rows)', () => {
    const res = csvToTable(HEADER_ONLY);
    expect(res.data).toEqual({ columns: ['name', 'qty'], rows: [] });
    expect(roundTripErrors(res.fence ?? '')).toEqual([]);
  });
});

// ─── csvToStatustable ────────────────────────────────────────────────────────

describe('csvToStatustable', () => {
  it('detects the status column by header name and builds the vocabulary', () => {
    const res = csvToStatustable(STATUS_CSV);
    expect(res.data).toEqual({
      columns: ['Task', 'Update'],
      statuses: [
        { label: 'done', color: 'green' },
        { label: 'blocked', color: 'red' },
        { label: 'in progress', color: 'amber' },
      ],
      rows: [
        { cells: ['Payment retries', 'Backoff merged'], status: 'done' },
        { cells: ['Vendor SSO', 'Waiting on creds'], status: 'blocked' },
        { cells: ['Rate limits', 'PR in review'], status: 'in progress' },
      ],
    });
    expect(errors(res.diagnostics)).toEqual([]);
  });

  it('detects a status column by value vocabulary when no header matches', () => {
    const res = csvToStatustable('Task,Phase\nShip it,done\nFix bug,at risk\n');
    expect(res.data?.rows).toEqual([
      { cells: ['Ship it'], status: 'done' },
      { cells: ['Fix bug'], status: 'at risk' },
    ]);
    expect(res.data?.statuses).toEqual([
      { label: 'done', color: 'green' },
      { label: 'at risk', color: 'amber' },
    ]);
  });

  it('cycles fallback colors for labels outside the known vocabulary', () => {
    const res = csvToStatustable(
      'Task,Status\nA,alpha\nB,beta\nC,gamma\nD,delta\nE,epsilon\nF,done\n',
    );
    expect(res.data?.statuses).toEqual([
      { label: 'alpha', color: 'blue' },
      { label: 'beta', color: 'purple' },
      { label: 'gamma', color: 'teal' },
      { label: 'delta', color: 'navy' },
      { label: 'epsilon', color: 'blue' },
      { label: 'done', color: 'green' },
    ]);
  });

  it('accepts a status column given by index or by header name', () => {
    const byIndex = csvToStatustable('S,Task\ndone,Ship\n', { statusColumn: 0 });
    expect(byIndex.data?.rows).toEqual([{ cells: ['Ship'], status: 'done' }]);
    const byName = csvToStatustable('Task,Phase\nShip,weird\n', { statusColumn: 'phase' });
    expect(byName.data?.rows).toEqual([{ cells: ['Ship'], status: 'weird' }]);
  });

  it('errors on an out-of-range index or unknown column name', () => {
    expect(csvToStatustable(STATUS_CSV, { statusColumn: 9 }).data).toBeNull();
    expect(csvToStatustable(STATUS_CSV, { statusColumn: 'nope' }).data).toBeNull();
  });

  it('returns data: null with an error when no status column is detectable', () => {
    const res = csvToStatustable(SIMPLE);
    expect(res.data).toBeNull();
    expect(res.fence).toBeNull();
    expect(errors(res.diagnostics)[0]?.message).toMatch(/no status column/);
  });

  it('returns data: null when the status column is the only column', () => {
    const res = csvToStatustable('Status\ndone\n');
    expect(res.data).toBeNull();
    expect(errors(res.diagnostics)[0]?.message).toMatch(/only column/);
  });

  it('returns data: null for a header-only CSV', () => {
    expect(csvToStatustable('Task,Status\n').data).toBeNull();
  });

  it('warns on empty status cells but still imports', () => {
    const res = csvToStatustable('Task,Status\nA,done\nB,\n');
    expect(res.data?.rows?.[1]).toEqual({ cells: ['B'], status: '' });
    expect(warns(res.diagnostics).some((d) => d.row === 3)).toBe(true);
    expect(roundTripErrors(res.fence ?? '')).toEqual([]);
  });

  it('dedupes status labels case-insensitively', () => {
    const res = csvToStatustable('Task,Status\nA,Done\nB,done\n');
    expect(res.data?.statuses).toEqual([{ label: 'Done', color: 'green' }]);
  });

  it('emits a compact house-style fence', () => {
    const res = csvToStatustable('Task,Status\nShip,done\n');
    expect(res.fence).toBe(
      [
        '```statustable',
        'columns: [Task]',
        'statuses:',
        '  - {label: done, color: green}',
        'rows:',
        '  - {cells: [Ship], status: done}',
        '```',
        '',
      ].join('\n'),
    );
  });
});

// ─── csvToChart ──────────────────────────────────────────────────────────────

describe('csvToChart', () => {
  it('uses the first non-numeric column as labels and numeric columns as series', () => {
    const res = csvToChart(NUMERIC_HEAVY);
    expect(res.data).toEqual({
      kind: 'bar',
      labels: ['Jan', 'Feb', 'Mar'],
      series: [
        { label: 'revenue', accent: 'navy', values: [1200, 1350, 1500] },
        { label: 'cost', accent: 'teal', values: [800, 900, 950] },
      ],
    });
    expect(errors(res.diagnostics)).toEqual([]);
  });

  it('honours the kind option', () => {
    expect(csvToChart(NUMERIC_HEAVY, { kind: 'line' }).data?.kind).toBe('line');
    expect(csvToChart(NUMERIC_HEAVY, { kind: 'area' }).data?.kind).toBe('area');
  });

  it('falls back to row numbers when every column is numeric', () => {
    const res = csvToChart('a,b\n1,2\n3,4\n');
    expect(res.data?.labels).toEqual(['1', '2']);
    expect(res.data?.series).toHaveLength(2);
    expect(warns(res.diagnostics).some((d) => /row numbers/.test(d.message))).toBe(true);
  });

  it('ignores extra non-numeric columns with a warning', () => {
    const res = csvToChart('month,owner,revenue\nJan,ana,10\nFeb,sam,20\n');
    expect(res.data?.labels).toEqual(['Jan', 'Feb']);
    expect(res.data?.series).toEqual([{ label: 'revenue', accent: 'navy', values: [10, 20] }]);
    expect(warns(res.diagnostics).some((d) => /owner/.test(d.message))).toBe(true);
  });

  it('returns data: null with an error when no column is numeric', () => {
    const res = csvToChart('a,b\nx,y\n');
    expect(res.data).toBeNull();
    expect(res.fence).toBeNull();
    expect(errors(res.diagnostics)[0]?.message).toMatch(/no numeric column/);
  });

  it('returns data: null for header-only or empty input', () => {
    expect(csvToChart(HEADER_ONLY).data).toBeNull();
    expect(csvToChart('').data).toBeNull();
  });

  it('a column with leading-zero ids does not count as numeric', () => {
    const res = csvToChart('id,qty\n007,1\n008,2\n');
    expect(res.data?.labels).toEqual(['007', '008']);
    expect(res.data?.series).toEqual([{ label: 'qty', accent: 'navy', values: [1, 2] }]);
  });

  it('emits a compact house-style fence', () => {
    const res = csvToChart(NUMERIC_HEAVY, { kind: 'line' });
    expect(res.fence).toBe(
      [
        '```chart',
        'kind: line',
        'labels: [Jan, Feb, Mar]',
        'series:',
        '  - {label: revenue, accent: navy, values: [1200, 1350, 1500]}',
        '  - {label: cost, accent: teal, values: [800, 900, 950]}',
        '```',
        '',
      ].join('\n'),
    );
  });
});

// ─── suggestCsvImport ────────────────────────────────────────────────────────

describe('suggestCsvImport', () => {
  it('suggests statustable when a status column is found', () => {
    const s = suggestCsvImport(STATUS_CSV);
    expect(s.kind).toBe('statustable');
    expect(s.reason).toMatch(/Status/);
  });

  it('suggests chart for numeric-heavy data with few label columns', () => {
    expect(suggestCsvImport(NUMERIC_HEAVY).kind).toBe('chart');
  });

  it('suggests table for mixed text data', () => {
    expect(suggestCsvImport('name,role,city\nAna,lead,Berlin\nSam,dev,Lima\n').kind).toBe('table');
  });

  it('suggests table for empty and header-only input', () => {
    expect(suggestCsvImport('').kind).toBe('table');
    expect(suggestCsvImport(HEADER_ONLY).kind).toBe('table');
  });

  it('prefers statustable over chart when both would apply', () => {
    // One numeric column + one status column: status wins.
    expect(suggestCsvImport('n,status\n1,done\n2,blocked\n').kind).toBe('statustable');
  });
});

// ─── round-trip validation battery ──────────────────────────────────────────

describe('fence round-trip: parse → validate with zero errors', () => {
  const tableCases: ReadonlyArray<readonly [string, string]> = [
    ['simple', SIMPLE],
    ['quoted + commas + newlines', QUOTED],
    ['CRLF + BOM + semicolon', CRLF_BOM],
    ['ragged', RAGGED],
    ['semicolon', SEMI],
    ['tab', TAB],
    ['numeric-heavy', NUMERIC_HEAVY],
    ['status vocabulary', STATUS_CSV],
    ['unicode', UNICODE],
    ['single column', ONE_COL],
    ['header-only', HEADER_ONLY],
    ['yaml-hostile strings', 'a,b\n"yes","null"\ntrue,007\n- dash,"[not, a, list]"\n'],
  ];

  it.each(tableCases)('csvToTable round-trips: %s', (_name, csv) => {
    const res = csvToTable(csv);
    expect(res.fence).not.toBeNull();
    expect(roundTripErrors(res.fence ?? '')).toEqual([]);
  });

  it('csvToStatustable round-trips (detected and forced columns)', () => {
    for (const res of [
      csvToStatustable(STATUS_CSV),
      csvToStatustable('Task,Phase\nShip it,done\nFix bug,at risk\n'),
      csvToStatustable('Task,Status\nA,alpha\nB,beta\n'),
      csvToStatustable('Owner,Task,State\nana,Ship,done\nsam,Fix,todo\n', { statusColumn: 2 }),
    ]) {
      expect(res.fence).not.toBeNull();
      expect(roundTripErrors(res.fence ?? '')).toEqual([]);
    }
  });

  it('csvToChart round-trips (bar, line, area, all-numeric)', () => {
    for (const res of [
      csvToChart(NUMERIC_HEAVY),
      csvToChart(NUMERIC_HEAVY, { kind: 'line' }),
      csvToChart(NUMERIC_HEAVY, { kind: 'area' }),
      csvToChart('a,b\n1,2\n3,4\n'),
    ]) {
      expect(res.fence).not.toBeNull();
      expect(roundTripErrors(res.fence ?? '')).toEqual([]);
    }
  });

  it('handles 10k rows in under a second, and the fence still validates', () => {
    const lines = ['label,alpha,beta'];
    for (let i = 0; i < 10_000; i++) {
      lines.push(`row ${i},${i},${(i * 7) % 100}`);
    }
    const csv = lines.join('\n');
    const start = performance.now();
    const res = csvToTable(csv);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(1000);
    expect(res.data?.rows).toHaveLength(10_000);
    expect(roundTripErrors(res.fence ?? '')).toEqual([]);
  });
});
