/**
 * CSV import — turns RFC-4180 CSV text into ready-to-insert `table`,
 * `statustable`, and `chart` blocks.
 *
 * Pure functions all the way down: strings in, `{ data, fence, diagnostics }`
 * out. Nothing here reads files or throws for malformed input — parse problems
 * (unterminated quotes, ragged rows) surface as {@link ImportDiagnostic}
 * values with row numbers, and a CSV that can't become the requested block
 * shape returns `{ data: null, fence: null }` so the caller can fall back
 * (usually to {@link csvToTable}, which accepts anything rectangular).
 *
 * These diagnostics are deliberately NOT the document `Diagnostic` type —
 * there is no file, no fence line, no stable code; just a row in somebody's
 * spreadsheet export. Keep the two domains apart.
 */

import {
  Document as YamlDocument,
  isCollection,
  isMap,
  isScalar,
  isSeq,
  visit,
  type Node,
} from 'yaml';
import type { BlockDataMap } from '../blocks/schemas.js';
import { type StatusColor } from '../blocks/schemas.js';

// ─── diagnostics ─────────────────────────────────────────────────────────────

/**
 * A problem (or note) encountered while importing CSV. Local to the import
 * domain — see the module doc for why this is not the document `Diagnostic`.
 */
export interface ImportDiagnostic {
  /** `error` means the requested conversion could not produce a block. */
  readonly level: 'warn' | 'error';
  /** 1-based CSV record number (the header row is record 1), when applicable. */
  readonly row?: number;
  /** Human-readable description of the problem. */
  readonly message: string;
}

// ─── parsing ─────────────────────────────────────────────────────────────────

/** The delimiters the parser understands (and auto-detects between). */
export type CsvDelimiter = ',' | ';' | '\t';

/** Options for {@link parseCsv}. */
export interface ParseCsvOptions {
  /** Field delimiter. Omit to auto-detect from the first non-empty line. */
  readonly delimiter?: CsvDelimiter;
}

/** Result of {@link parseCsv}: a rectangular grid plus any parse problems. */
export interface ParseCsvResult {
  /**
   * The records, padded to a uniform width (ragged input warns). Unquoted
   * fields are trimmed; quoted fields are kept verbatim (embedded newlines
   * normalised to `\n`). Blank lines are skipped.
   */
  readonly rows: string[][];
  readonly diagnostics: ImportDiagnostic[];
}

/** Strips a leading UTF-8 byte-order mark, if present. */
function stripBom(text: string): string {
  return text.startsWith('\uFEFF') ? text.slice(1) : text;
}

const DELIMITER_CANDIDATES: readonly CsvDelimiter[] = [',', ';', '\t'];

/**
 * Picks the delimiter by counting candidate characters outside quotes on the
 * first non-empty line. Ties (and a count of zero) resolve to the earliest
 * candidate in `,` → `;` → tab order.
 */
function detectDelimiter(text: string): CsvDelimiter {
  const counts: Record<CsvDelimiter, number> = { ',': 0, ';': 0, '\t': 0 };
  let inQuotes = false;
  let sawContent = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    if (inQuotes) {
      if (ch === '"') inQuotes = false;
      continue;
    }
    if (ch === '\n' || ch === '\r') {
      if (sawContent) break;
      continue; // skip leading empty lines
    }
    if (ch === '"') {
      inQuotes = true;
      sawContent = true;
      continue;
    }
    if (ch === ',' || ch === ';' || ch === '\t') counts[ch] += 1;
    if (ch.trim() !== '') sawContent = true;
  }
  let best: CsvDelimiter = ',';
  for (const cand of DELIMITER_CANDIDATES) {
    if (counts[cand] > counts[best]) best = cand;
  }
  return best;
}

/**
 * Parses CSV text into rows of string fields (RFC 4180, applied leniently).
 *
 * Handles quoted fields, `""` escapes, embedded delimiters and newlines inside
 * quotes, CRLF/LF (and lone CR) line endings, a trailing newline, and a
 * leading BOM. Never throws: an unterminated quote is an `error` diagnostic
 * (the rest of the text becomes the field), stray quotes and text after a
 * closing quote are kept verbatim with a `warn`, and ragged rows are padded to
 * a uniform width with a `warn` per offending row.
 *
 * @param text - The CSV source.
 * @param opts - Delimiter override; omitted → auto-detect.
 */
export function parseCsv(text: string, opts: ParseCsvOptions = {}): ParseCsvResult {
  const src = stripBom(text);
  const delimiter = opts.delimiter ?? detectDelimiter(src);
  const rows: string[][] = [];
  const diagnostics: ImportDiagnostic[] = [];

  let field = '';
  let fieldWasQuoted = false;
  let record: string[] = [];
  let recordHasContent = false;
  let warnedStray = false;

  const pushField = (): void => {
    record.push(fieldWasQuoted ? field : field.trim());
    field = '';
    fieldWasQuoted = false;
  };
  const pushRecord = (): void => {
    pushField();
    rows.push(record);
    record = [];
    recordHasContent = false;
    warnedStray = false;
  };

  let inQuotes = false;
  let i = 0;
  const n = src.length;
  while (i < n) {
    const ch = src.charAt(i);
    if (inQuotes) {
      if (ch === '"') {
        if (src.charAt(i + 1) === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else if (ch === '\r') {
        // Normalise embedded CRLF / lone CR to LF.
        field += '\n';
        i += src.charAt(i + 1) === '\n' ? 2 : 1;
      } else {
        field += ch;
        i += 1;
      }
      continue;
    }
    if (ch === delimiter) {
      pushField();
      recordHasContent = true;
      i += 1;
      continue;
    }
    if (ch === '\n' || ch === '\r') {
      if (recordHasContent) pushRecord();
      else {
        // Blank line — not a record.
        field = '';
        record = [];
      }
      i += ch === '\r' && src.charAt(i + 1) === '\n' ? 2 : 1;
      continue;
    }
    if (ch === '"') {
      if (field === '' && !fieldWasQuoted) {
        inQuotes = true;
        fieldWasQuoted = true;
        recordHasContent = true;
        i += 1;
        continue;
      }
      // Stray quote mid-field, or content resuming after a closing quote.
      if (!warnedStray) {
        diagnostics.push({
          level: 'warn',
          row: rows.length + 1,
          message: `row ${rows.length + 1}: quote character outside a quoted field — kept verbatim`,
        });
        warnedStray = true;
      }
      field += ch;
      recordHasContent = true;
      i += 1;
      continue;
    }
    if (fieldWasQuoted && ch === ' ') {
      // Padding between a closing quote and the next delimiter — ignore.
      i += 1;
      continue;
    }
    if (fieldWasQuoted && !warnedStray) {
      diagnostics.push({
        level: 'warn',
        row: rows.length + 1,
        message: `row ${rows.length + 1}: text after a closing quote — kept verbatim`,
      });
      warnedStray = true;
    }
    field += ch;
    if (ch.trim() !== '') recordHasContent = true;
    i += 1;
  }

  if (inQuotes) {
    diagnostics.push({
      level: 'error',
      row: rows.length + 1,
      message: `row ${rows.length + 1}: unterminated quoted field — the rest of the input was taken as the field value`,
    });
  }
  if (recordHasContent || inQuotes) pushRecord();

  // Pad to a uniform width; the first record sets the expectation.
  const first = rows[0];
  if (first !== undefined) {
    const expected = first.length;
    let widest = 0;
    for (const r of rows) widest = Math.max(widest, r.length);
    rows.forEach((r, idx) => {
      if (r.length !== expected) {
        diagnostics.push({
          level: 'warn',
          row: idx + 1,
          message: `row ${idx + 1} has ${r.length} field(s); expected ${expected} — rows padded to match`,
        });
      }
      while (r.length < widest) r.push('');
    });
  }

  return { rows, diagnostics };
}

// ─── cell typing ─────────────────────────────────────────────────────────────

const NUMERIC_RE = /^-?\d+(\.\d+)?$/;

/**
 * The numeric value of a field, or `undefined` when it should stay a string.
 * A field is numeric when it matches `/^-?\d+(\.\d+)?$/` AND its integer part
 * has no leading zero (unless it IS `0` / `0.x`) — so id-like values such as
 * `007` or `0042` survive as strings.
 */
function numericValue(raw: string): number | undefined {
  const t = raw.trim();
  if (!NUMERIC_RE.test(t)) return undefined;
  const unsigned = t.startsWith('-') ? t.slice(1) : t;
  const intPart = unsigned.split('.', 1)[0] ?? unsigned;
  if (intPart.length > 1 && intPart.startsWith('0')) return undefined;
  return Number(t);
}

/** A table/statustable cell: numeric-looking fields become numbers. */
function toCell(raw: string): string | number {
  return numericValue(raw) ?? raw;
}

/** Column labels from a header record; blank headers become `Column N`. */
function headerLabels(header: readonly string[]): string[] {
  return header.map((h, i) => {
    const t = h.trim();
    return t === '' ? `Column ${i + 1}` : t;
  });
}

// ─── fence serialization ─────────────────────────────────────────────────────

/** Keys whose collection value is written inline: `columns: [A, B]`. */
const FLOW_VALUE_KEYS = new Set(['columns', 'labels']);
/** Keys whose sequence ITEMS are written inline: `- { label: x, … }`. */
const FLOW_ITEM_KEYS = new Set(['rows', 'series', 'statuses']);

/** Marks every collection in a subtree as flow-style. */
function flowDeep(node: Node): void {
  visit(node, {
    Map(_key, map) {
      map.flow = true;
    },
    Seq(_key, seq) {
      seq.flow = true;
    },
  });
}

/**
 * Serialises block data to a compact YAML body in the house-template style:
 * scalars and top-level keys in block form, `columns` / `labels` as inline
 * arrays, and each `rows` / `series` / `statuses` item as an inline entry —
 * one record per line, like `BLOCK_TEMPLATES`. `lineWidth: 0` (no re-wrapping)
 * and no trailing newline, matching `serializeBlockData`; flow collections are
 * written without inner padding (`[a, b]`, `{label: x}`), the seq style the
 * templates use.
 */
function serializeCompactBody(data: Record<string, unknown>): string {
  const doc = new YamlDocument(data);
  const root = doc.contents;
  if (isMap(root)) {
    for (const pair of root.items) {
      const key = isScalar(pair.key) ? pair.key.value : pair.key;
      if (typeof key !== 'string') continue;
      const value = pair.value;
      if (FLOW_VALUE_KEYS.has(key) && isCollection(value)) {
        flowDeep(value);
      } else if (FLOW_ITEM_KEYS.has(key) && isSeq(value)) {
        for (const item of value.items) {
          if (isCollection(item)) flowDeep(item);
        }
      }
    }
  }
  return doc.toString({ lineWidth: 0, flowCollectionPadding: false }).replace(/\n$/, '');
}

/** Wraps a serialised body in ` ```type ` fences, trailing newline included. */
function buildFence(
  type: 'table' | 'statustable' | 'chart',
  data: Record<string, unknown>,
): string {
  return '```' + type + '\n' + serializeCompactBody(data) + '\n```\n';
}

// ─── conversion results ──────────────────────────────────────────────────────

/**
 * Result of a CSV → block conversion. Either the conversion applied — `data`
 * is the block's typed data and `fence` a ready-to-insert fenced block — or it
 * did not (`data` and `fence` are both `null`; the diagnostics say why, and
 * the caller falls back, usually to {@link csvToTable}).
 */
export type CsvImportResult<T> =
  | { readonly data: T; readonly fence: string; readonly diagnostics: ImportDiagnostic[] }
  | { readonly data: null; readonly fence: null; readonly diagnostics: ImportDiagnostic[] };

function failure(
  diagnostics: ImportDiagnostic[],
  message: string,
): { data: null; fence: null; diagnostics: ImportDiagnostic[] } {
  return { data: null, fence: null, diagnostics: [...diagnostics, { level: 'error', message }] };
}

/** Forwards only the caller's delimiter choice to {@link parseCsv}. */
function delimiterOpts(delimiter: CsvDelimiter | undefined): ParseCsvOptions {
  return delimiter !== undefined ? { delimiter } : {};
}

// ─── table ───────────────────────────────────────────────────────────────────

/** Options for {@link csvToTable}. */
export interface CsvToTableOptions {
  /** Optional block `title`. */
  readonly title?: string;
  /** Treat the first record as the header row (default `true`). */
  readonly firstRowHeader?: boolean;
  /** Field delimiter; omitted → auto-detect. */
  readonly delimiter?: CsvDelimiter;
}

/**
 * Converts CSV to a `table` block: header record → `columns`, remaining
 * records → `rows`, numeric-looking cells as numbers (id-like values with
 * leading zeros stay strings). The catch-all conversion — any non-empty CSV
 * becomes a table.
 *
 * @param csv - The CSV source.
 * @param opts - Title, header handling, delimiter.
 *
 * @example
 * ```ts
 * const { fence } = csvToTable('name,qty\nWidget,4\n');
 * // ```table
 * // columns: [name, qty]
 * // rows:
 * //   - [Widget, 4]
 * // ```
 * ```
 */
export function csvToTable(
  csv: string,
  opts: CsvToTableOptions = {},
): CsvImportResult<BlockDataMap['table']> {
  const parsed = parseCsv(csv, delimiterOpts(opts.delimiter));
  const diagnostics = [...parsed.diagnostics];
  const first = parsed.rows[0];
  if (first === undefined) return failure(diagnostics, 'CSV has no rows — nothing to import');

  const firstRowHeader = opts.firstRowHeader ?? true;
  const body = firstRowHeader ? parsed.rows.slice(1) : parsed.rows;
  const data: BlockDataMap['table'] = {
    ...(opts.title !== undefined ? { title: opts.title } : {}),
    ...(firstRowHeader ? { columns: headerLabels(first) } : {}),
    rows: body.map((r) => r.map(toCell)),
  };
  return { data, fence: buildFence('table', data), diagnostics };
}

// ─── statustable ─────────────────────────────────────────────────────────────

/**
 * Common status vocabulary → the color each maps to, matched
 * case-insensitively. Also the word list the status-column detector accepts.
 */
const STATUS_COLOR_MAP: Readonly<Record<string, StatusColor>> = {
  done: 'green',
  completed: 'green',
  complete: 'green',
  shipped: 'green',
  'on track': 'green',
  blocked: 'red',
  'off track': 'red',
  failed: 'red',
  cancelled: 'red',
  canceled: 'red',
  'in progress': 'amber',
  'in-progress': 'amber',
  doing: 'amber',
  wip: 'amber',
  'at risk': 'amber',
  pending: 'amber',
  waiting: 'amber',
  'in review': 'purple',
  review: 'purple',
  todo: 'gray',
  'to do': 'gray',
  'not started': 'gray',
  backlog: 'gray',
  planned: 'gray',
  'on hold': 'gray',
  paused: 'gray',
  neutral: 'gray',
};

/** Colors cycled (in order) for status labels outside the known vocabulary. */
const FALLBACK_STATUS_COLORS: readonly StatusColor[] = ['blue', 'purple', 'teal', 'navy'];

/** Accents cycled across chart series, in house-template order. */
const SERIES_ACCENTS: ReadonlyArray<
  NonNullable<BlockDataMap['chart']['series']>[number]['accent']
> = ['navy', 'teal', 'amber', 'purple', 'blue', 'green', 'red', 'gray'];

/** `items[i % items.length]`, typed without a non-null assertion. */
function cycle<T>(items: readonly T[], i: number): T {
  const item = items[i % items.length];
  if (item === undefined) throw new RangeError('cycle() requires a non-empty array');
  return item;
}

/**
 * Finds the status column: first a header matching `/status|state/i`, else the
 * first column whose non-empty values are all in the known status vocabulary
 * with at most 6 distinct values. `undefined` when nothing qualifies.
 */
function detectStatusColumn(
  header: readonly string[],
  body: readonly string[][],
): number | undefined {
  const byName = header.findIndex((h) => /status|state/i.test(h));
  if (byName !== -1) return byName;
  if (body.length === 0) return undefined;
  for (let c = 0; c < header.length; c++) {
    const distinct = new Set<string>();
    let known = true;
    for (const row of body) {
      const v = (row[c] ?? '').trim().toLowerCase();
      if (v === '') continue;
      distinct.add(v);
      if (!(v in STATUS_COLOR_MAP)) {
        known = false;
        break;
      }
    }
    if (known && distinct.size >= 1 && distinct.size <= 6) return c;
  }
  return undefined;
}

/** Options for {@link csvToStatustable}. */
export interface CsvToStatustableOptions {
  /** Status column as a 0-based index or a header name (case-insensitive). */
  readonly statusColumn?: string | number;
  /** Field delimiter; omitted → auto-detect. */
  readonly delimiter?: CsvDelimiter;
}

/**
 * Converts CSV to a `statustable` block. The status column (given, or detected
 * per {@link detectStatusColumn}'s rules) becomes each row's `status`; its
 * distinct values become the `statuses` vocabulary — known words get their
 * semantic color (done → green, blocked → red, in progress / at risk → amber,
 * todo → gray, …), the rest cycle through accents. The remaining columns
 * become `columns` + `cells`.
 *
 * Returns `data: null` (with an `error` diagnostic) when no status column can
 * be found, when the status column is the only column, or when there are no
 * data rows — the caller should import as a plain table instead.
 *
 * @param csv - The CSV source.
 * @param opts - Status column override, delimiter.
 */
export function csvToStatustable(
  csv: string,
  opts: CsvToStatustableOptions = {},
): CsvImportResult<BlockDataMap['statustable']> {
  const parsed = parseCsv(csv, delimiterOpts(opts.delimiter));
  const diagnostics = [...parsed.diagnostics];
  const header = parsed.rows[0];
  const body = parsed.rows.slice(1);
  if (header === undefined || body.length === 0) {
    return failure(diagnostics, 'statustable needs a header row and at least one data row');
  }

  let statusCol: number | undefined;
  if (typeof opts.statusColumn === 'number') {
    if (
      !Number.isInteger(opts.statusColumn) ||
      opts.statusColumn < 0 ||
      opts.statusColumn >= header.length
    ) {
      return failure(
        diagnostics,
        `status column index ${opts.statusColumn} is out of range (0–${header.length - 1})`,
      );
    }
    statusCol = opts.statusColumn;
  } else if (typeof opts.statusColumn === 'string') {
    const wanted = opts.statusColumn.trim().toLowerCase();
    const found = header.findIndex((h) => h.trim().toLowerCase() === wanted);
    if (found === -1) {
      return failure(diagnostics, `no column named "${opts.statusColumn}" in the header`);
    }
    statusCol = found;
  } else {
    statusCol = detectStatusColumn(header, body);
    if (statusCol === undefined) {
      return failure(
        diagnostics,
        'no status column detected (no header matching /status|state/i and no column of known status words) — import as a table instead',
      );
    }
  }
  if (header.length < 2) {
    return failure(
      diagnostics,
      'the status column is the only column — a statustable row needs at least one cell; import as a table instead',
    );
  }

  const labels = headerLabels(header);
  const columns = labels.filter((_, i) => i !== statusCol);

  // Distinct statuses in first-appearance order, deduped case-insensitively.
  const seen = new Map<string, string>();
  body.forEach((row, i) => {
    const status = (row[statusCol] ?? '').trim();
    if (status === '') {
      diagnostics.push({
        level: 'warn',
        row: i + 2,
        message: `row ${i + 2} has an empty status`,
      });
    }
    if (!seen.has(status.toLowerCase())) seen.set(status.toLowerCase(), status);
  });
  let fallback = 0;
  const statuses = [...seen.values()].map((label) => {
    const color = STATUS_COLOR_MAP[label.toLowerCase()];
    return { label, color: color ?? cycle(FALLBACK_STATUS_COLORS, fallback++) };
  });

  const data: BlockDataMap['statustable'] = {
    columns,
    statuses,
    rows: body.map((row) => ({
      cells: row.filter((_, i) => i !== statusCol).map(toCell),
      status: (row[statusCol] ?? '').trim(),
    })),
  };
  return { data, fence: buildFence('statustable', data), diagnostics };
}

// ─── chart ───────────────────────────────────────────────────────────────────

/** Options for {@link csvToChart}. */
export interface CsvToChartOptions {
  /** Chart kind (default `bar`). */
  readonly kind?: 'bar' | 'line' | 'area';
  /** Field delimiter; omitted → auto-detect. */
  readonly delimiter?: CsvDelimiter;
}

/**
 * Converts CSV to a `chart` block: the first non-numeric column becomes
 * `labels`, and every numeric column (all cells numeric per the cell-typing
 * rule) becomes a `series` named after its header, accents cycled. Extra
 * non-numeric columns are ignored with a warning; a CSV with no non-numeric
 * column uses row numbers as labels.
 *
 * Returns `data: null` (with an `error` diagnostic) when there is no numeric
 * column or no data row — import as a table instead.
 *
 * @param csv - The CSV source.
 * @param opts - Chart kind, delimiter.
 */
export function csvToChart(
  csv: string,
  opts: CsvToChartOptions = {},
): CsvImportResult<BlockDataMap['chart']> {
  const parsed = parseCsv(csv, delimiterOpts(opts.delimiter));
  const diagnostics = [...parsed.diagnostics];
  const header = parsed.rows[0];
  const body = parsed.rows.slice(1);
  if (header === undefined || body.length === 0) {
    return failure(diagnostics, 'chart needs a header row and at least one data row');
  }

  const numericCols: number[] = [];
  const otherCols: number[] = [];
  for (let c = 0; c < header.length; c++) {
    const allNumeric = body.every((row) => numericValue(row[c] ?? '') !== undefined);
    (allNumeric ? numericCols : otherCols).push(c);
  }
  if (numericCols.length === 0) {
    return failure(
      diagnostics,
      'no numeric column found — a chart needs at least one all-numeric column; import as a table instead',
    );
  }

  const names = headerLabels(header);
  const labelCol = otherCols[0];
  const labels =
    labelCol !== undefined
      ? body.map((row) => (row[labelCol] ?? '').trim())
      : body.map((_, i) => String(i + 1));
  if (labelCol === undefined) {
    diagnostics.push({
      level: 'warn',
      message: 'every column is numeric — using row numbers as labels',
    });
  }
  const ignored = otherCols.slice(1);
  if (ignored.length > 0) {
    diagnostics.push({
      level: 'warn',
      message: `ignored non-numeric column(s): ${ignored.map((c) => names[c] ?? `Column ${c + 1}`).join(', ')}`,
    });
  }

  const data: BlockDataMap['chart'] = {
    kind: opts.kind ?? 'bar',
    labels,
    series: numericCols.map((c, si) => ({
      label: names[c] ?? `Column ${c + 1}`,
      accent: cycle(SERIES_ACCENTS, si),
      values: body.map((row) => numericValue(row[c] ?? '') ?? 0),
    })),
  };
  return { data, fence: buildFence('chart', data), diagnostics };
}

// ─── suggestion ──────────────────────────────────────────────────────────────

/** The block kind {@link suggestCsvImport} recommends, with its reasoning. */
export interface CsvImportSuggestion {
  readonly kind: 'table' | 'statustable' | 'chart';
  /** One human-readable sentence a UI can surface next to the default. */
  readonly reason: string;
}

/**
 * Suggests the best target block for a CSV — the default an import UI should
 * pre-select. Rules, in order:
 *
 * 1. A status column is detected (and other columns exist) → `statustable`.
 * 2. ≥ 1 all-numeric column and ≤ 2 non-numeric columns → `chart`.
 * 3. Everything else (including empty / header-only input) → `table`.
 *
 * @param csv - The CSV source (delimiter auto-detected).
 */
export function suggestCsvImport(csv: string): CsvImportSuggestion {
  const { rows } = parseCsv(csv);
  const header = rows[0];
  const body = rows.slice(1);
  if (header === undefined || body.length === 0) {
    return {
      kind: 'table',
      reason: 'Not enough data to detect a shape — a table accepts anything.',
    };
  }

  const statusCol = detectStatusColumn(header, body);
  if (statusCol !== undefined && header.length >= 2) {
    const label = headerLabels(header)[statusCol] ?? `Column ${statusCol + 1}`;
    return {
      kind: 'statustable',
      reason: `Column "${label}" looks like a status column.`,
    };
  }

  let numeric = 0;
  for (let c = 0; c < header.length; c++) {
    if (body.every((row) => numericValue(row[c] ?? '') !== undefined)) numeric += 1;
  }
  const nonNumeric = header.length - numeric;
  if (numeric >= 1 && nonNumeric <= 2) {
    return {
      kind: 'chart',
      reason: `${numeric} numeric column(s) and ${nonNumeric} label column(s) — chartable data.`,
    };
  }
  return { kind: 'table', reason: 'Mixed text data — best shown as a table.' };
}
