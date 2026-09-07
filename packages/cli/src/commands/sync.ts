/**
 * `avo sync` — import external sources into Avodado documents.
 *
 * `avo sync openapi` generates a doc from an OpenAPI spec (or drift-checks an
 * existing one); `avo sync csv` turns a CSV into a ready-to-insert block
 * fence, or a minimal doc with `--out`; `avo sync sql | dbml | prisma` turn
 * a database schema into an `erd` fence the same way. All build on the pure
 * importers in `@avodado/core` (`core/src/import/`); this module only does
 * the I/O.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, dirname, resolve, extname, relative } from 'node:path';
import {
  convertDbml,
  convertPrisma,
  convertSqlDdl,
  csvToChart,
  csvToStatustable,
  csvToTable,
  erdFence,
  openapiToMarkdown,
  parseOpenApi,
  suggestCsvImport,
  type CsvDelimiter,
  type CsvImportResult,
  type ImportDiagnostic,
} from '@avodado/core';
import { runCheck, type CheckResult } from './check.js';
import { overwriteRefusal } from '../io/write.js';

/** Inputs for {@link runSyncOpenApi}. */
export interface SyncOpenApiOptions {
  readonly cwd: string;
  /** Path to the OpenAPI spec (relative or absolute). */
  readonly spec: string;
  /** Output path (write mode). Mutually exclusive with `check`. */
  readonly out?: string;
  /** Path to compare generated output against (drift mode). */
  readonly check?: string;
  /** Slug used to namespace generated block ids. Defaults to the output basename. */
  readonly slug?: string;
  /** Replace an existing file at `out`. Without it, an existing file is kept. */
  readonly force?: boolean;
}

/** Result of `avo sync openapi`. */
export interface SyncOpenApiResult {
  readonly exitCode: 0 | 1 | 2;
  /** A short, plain-text summary suitable for logging. */
  readonly message: string;
  /** When `check` mode finds drift: the line-level diff. */
  readonly diff?: string;
}

function slugFromPath(path: string): string {
  const base = basename(path, extname(path));
  return base.length > 0 ? base : 'api';
}

/**
 * Generates an Avodado doc from an OpenAPI spec — either writing it to disk,
 * or comparing the in-memory result against an existing doc on disk and
 * reporting drift.
 */
export async function runSyncOpenApi(opts: SyncOpenApiOptions): Promise<SyncOpenApiResult> {
  if (opts.out === undefined && opts.check === undefined) {
    return { exitCode: 2, message: 'avo sync openapi: must specify --out <path> or --check <path>' };
  }
  if (opts.out !== undefined && opts.check !== undefined) {
    return { exitCode: 2, message: 'avo sync openapi: --out and --check are mutually exclusive' };
  }

  const specAbs = resolve(opts.cwd, opts.spec);
  if (!existsSync(specAbs)) {
    return { exitCode: 2, message: `Spec not found: ${specAbs}` };
  }

  const source = await readFile(specAbs, 'utf8');
  let spec;
  try {
    spec = parseOpenApi(source);
  } catch (err) {
    return { exitCode: 1, message: `Failed to parse spec: ${(err as Error).message}` };
  }

  const targetPath = opts.out ?? opts.check;
  if (targetPath === undefined) {
    return { exitCode: 2, message: 'no target path' };
  }
  const slug = opts.slug ?? slugFromPath(targetPath);
  const generated = openapiToMarkdown(spec, { slug });

  if (opts.out !== undefined) {
    const outAbs = resolve(opts.cwd, opts.out);
    const refusal = overwriteRefusal(outAbs, { force: opts.force });
    if (refusal !== undefined) return { exitCode: 1, message: refusal };
    await mkdir(dirname(outAbs), { recursive: true });
    await writeFile(outAbs, generated, 'utf8');
    return {
      exitCode: 0,
      message: `Wrote ${outAbs} (${generated.length} bytes)`,
    };
  }

  // Check mode — compare against existing file.
  const checkAbs = resolve(opts.cwd, opts.check ?? '');
  if (!existsSync(checkAbs)) {
    return {
      exitCode: 1,
      message: `Drift: ${checkAbs} does not exist. Run with --out ${opts.check} to generate it.`,
    };
  }
  const existing = await readFile(checkAbs, 'utf8');
  if (existing === generated) {
    return {
      exitCode: 0,
      message: `OK: ${checkAbs} matches ${specAbs} (${generated.length} bytes)`,
    };
  }
  return {
    exitCode: 1,
    message: `Drift: ${checkAbs} differs from what ${specAbs} would generate.`,
    diff: simpleDiff(existing, generated),
  };
}

/** Tiny line-level diff for the drift report. Not a full diff library; good enough for CI. */
function simpleDiff(a: string, b: string): string {
  const aLines = a.split('\n');
  const bLines = b.split('\n');
  const out: string[] = [];
  const max = Math.max(aLines.length, bLines.length);
  for (let i = 0; i < max; i++) {
    const av = aLines[i];
    const bv = bLines[i];
    if (av === bv) continue;
    if (av !== undefined) out.push(`- ${av}`);
    if (bv !== undefined) out.push(`+ ${bv}`);
    if (out.length >= 40) {
      out.push(`… (truncated; ${max - i - 1} more lines)`);
      break;
    }
  }
  return out.join('\n');
}

// ─── avo sync csv ────────────────────────────────────────────────────────────

/** The block kinds `avo sync csv` can target. */
export type CsvBlockKind = 'table' | 'statustable' | 'chart';

/** Inputs for {@link runSyncCsv}. */
export interface SyncCsvOptions {
  readonly cwd: string;
  /** Path to the CSV file (relative or absolute). */
  readonly file: string;
  /** Output doc path. Omitted → the caller prints the fence to stdout. */
  readonly out?: string;
  /** Target block; omitted → `suggestCsvImport`'s pick. */
  readonly block?: CsvBlockKind;
  /** Doc title (with `--out`); defaults to a prettified file name. */
  readonly title?: string;
  /** Delimiter override: `,` `;` `tab` (or a literal tab / `\t`). */
  readonly delimiter?: string;
  /** Replace an existing file at `out`. Without it, an existing file is kept. */
  readonly force?: boolean;
}

/** Result of `avo sync csv`. */
export interface SyncCsvResult {
  readonly exitCode: 0 | 1 | 2;
  /** The block kind that was produced (or attempted). */
  readonly block: CsvBlockKind;
  /** `suggestCsvImport`'s one-liner — set only when the block was auto-picked. */
  readonly reason?: string;
  /** The ready-to-paste fence (stdout mode) — trailing newline included. */
  readonly fence?: string;
  /** Absolute output path (write mode). */
  readonly outPath?: string;
  /** Import warnings (row-level parse notes) — print to stderr. */
  readonly warnings: readonly string[];
  /** Fatal message when `exitCode` ≠ 0. */
  readonly message?: string;
  /** `avo check` result for the written doc (write mode only). */
  readonly check?: CheckResult;
}

// ─── avo sync sql | dbml | prisma ────────────────────────────────────────────

/** The schema dialects `avo sync` reads into an `erd` block. */
export type SchemaDialect = 'sql' | 'dbml' | 'prisma';

/** Inputs for {@link runSyncSchema}. */
export interface SyncSchemaOptions {
  readonly cwd: string;
  /** Path to the schema file (relative or absolute). */
  readonly file: string;
  readonly dialect: SchemaDialect;
  /** Output doc path. Omitted → the caller prints the fence to stdout. */
  readonly out?: string;
  /** Doc title (with `--out`); defaults to a prettified file name. */
  readonly title?: string;
  /** Block id; defaults to the file stem as a slug. */
  readonly id?: string;
  /** Replace an existing file at `out`. Without it, an existing file is kept. */
  readonly force?: boolean;
}

/** Result of `avo sync sql | dbml | prisma`. */
export interface SyncSchemaResult {
  readonly exitCode: 0 | 1 | 2;
  /** The ready-to-paste ` ```erd ` fence (stdout mode) — trailing newline included. */
  readonly fence?: string;
  /** Absolute output path (write mode). */
  readonly outPath?: string;
  /** Entity / relation counts, for the log line. */
  readonly entities: number;
  readonly relations: number;
  /** Fatal message when `exitCode` ≠ 0. */
  readonly message?: string;
  /** `avo check` result for the written doc (write mode only). */
  readonly check?: CheckResult;
}

/** `schema.sql` → `schema`; `my Schema.dbml` → `my-schema`. */
function idFromFile(file: string): string {
  const slug = basename(file, extname(file))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug === '' ? 'schema' : slug;
}

/**
 * Converts a SQL DDL, DBML or Prisma schema file to an `erd` fence (stdout
 * mode) or a minimal doc (`--out` mode, validated with `avo check` after
 * writing). A line the dialect subset cannot read is exit 1 with the line.
 */
export async function runSyncSchema(opts: SyncSchemaOptions): Promise<SyncSchemaResult> {
  const fileAbs = resolve(opts.cwd, opts.file);
  if (!existsSync(fileAbs)) {
    return { exitCode: 2, entities: 0, relations: 0, message: `Schema not found: ${fileAbs}` };
  }
  const source = await readFile(fileAbs, 'utf8');
  const result =
    opts.dialect === 'sql' ? convertSqlDdl(source) : opts.dialect === 'dbml' ? convertDbml(source) : convertPrisma(source);
  if (!result.ok) {
    const where = result.line !== undefined ? `${opts.file}:${result.line}` : opts.file;
    return { exitCode: 1, entities: 0, relations: 0, message: `Could not read ${where}: ${result.message}` };
  }
  const data = result.data;
  const entities = Array.isArray(data['entities']) ? data['entities'].length : 0;
  const relations = Array.isArray(data['relations']) ? data['relations'].length : 0;
  const fence = erdFence(data, opts.id ?? idFromFile(opts.file));

  if (opts.out === undefined) {
    return { exitCode: 0, fence, entities, relations };
  }
  const title = opts.title ?? titleFromFile(opts.file);
  const doc = '```meta\ntitle: ' + JSON.stringify(title) + '\n```\n\n' + fence;
  const outAbs = resolve(opts.cwd, opts.out);
  const refusal = overwriteRefusal(outAbs, { force: opts.force });
  if (refusal !== undefined) {
    return { exitCode: 1, entities, relations, message: refusal };
  }
  await mkdir(dirname(outAbs), { recursive: true });
  await writeFile(outAbs, doc, 'utf8');
  const check = await runCheck({
    patterns: [relative(opts.cwd, outAbs) || opts.out],
    cwd: opts.cwd,
    docsRoot: dirname(relative(opts.cwd, outAbs)) || '.',
  });
  return { exitCode: check.exitCode, outPath: outAbs, entities, relations, check };
}

/** Parses the `--delimiter` flag; `undefined` input → auto-detect. */
function parseDelimiter(raw: string | undefined): CsvDelimiter | undefined | null {
  if (raw === undefined) return undefined;
  if (raw === ',' || raw === ';' || raw === '\t') return raw;
  if (raw === 'tab' || raw === '\\t') return '\t';
  return null; // unrecognised
}

/** `sales-q1.csv` → `Sales q1` — the same prettifying `avo studio` uses for new docs. */
function titleFromFile(file: string): string {
  const stem = basename(file, extname(file));
  const spaced = stem.replace(/[-_]+/g, ' ').trim();
  return spaced === '' ? 'Imported schema' : spaced.replace(/^\w/, (c) => c.toUpperCase());
}

const warnMessages = (diags: readonly ImportDiagnostic[]): string[] =>
  diags.filter((d) => d.level === 'warn').map((d) => d.message);
const errorMessages = (diags: readonly ImportDiagnostic[]): string[] =>
  diags.filter((d) => d.level === 'error').map((d) => d.message);

/**
 * Converts a CSV file to a block fence (stdout mode) or a minimal doc
 * (`--out` mode, validated with `avo check` after writing).
 *
 * Block choice: `--block` runs that converter strictly (a CSV that can't take
 * the shape is exit 1); omitted, `suggestCsvImport` picks and its reason is
 * surfaced. Parse warnings ride `warnings`; error-level import diagnostics
 * are fatal (exit 1).
 */
export async function runSyncCsv(opts: SyncCsvOptions): Promise<SyncCsvResult> {
  const fallback: CsvBlockKind = opts.block ?? 'table';
  const delimiter = parseDelimiter(opts.delimiter);
  if (delimiter === null) {
    return {
      exitCode: 2,
      block: fallback,
      warnings: [],
      message: `avo sync csv: unknown delimiter ${JSON.stringify(opts.delimiter)} — use "," ";" or "tab"`,
    };
  }

  const fileAbs = resolve(opts.cwd, opts.file);
  if (!existsSync(fileAbs)) {
    return { exitCode: 2, block: fallback, warnings: [], message: `CSV not found: ${fileAbs}` };
  }
  const csv = await readFile(fileAbs, 'utf8');

  let block: CsvBlockKind;
  let reason: string | undefined;
  if (opts.block !== undefined) {
    block = opts.block;
  } else {
    const suggestion = suggestCsvImport(csv);
    block = suggestion.kind;
    reason = suggestion.reason;
  }

  const convertOpts = delimiter !== undefined ? { delimiter } : {};
  const result: CsvImportResult<unknown> =
    block === 'statustable'
      ? csvToStatustable(csv, convertOpts)
      : block === 'chart'
        ? csvToChart(csv, convertOpts)
        : csvToTable(csv, convertOpts);

  const warnings = warnMessages(result.diagnostics);
  if (result.data === null) {
    const errors = errorMessages(result.diagnostics);
    return {
      exitCode: 1,
      block,
      ...(reason !== undefined ? { reason } : {}),
      warnings,
      message: `Could not import ${opts.file} as ${block}: ${errors.join('; ')}`,
    };
  }
  // Unterminated quotes etc. are error-level even when a table came out —
  // a silently-mangled import is worse than a failing one.
  const parseErrors = errorMessages(result.diagnostics);
  if (parseErrors.length > 0) {
    return {
      exitCode: 1,
      block,
      ...(reason !== undefined ? { reason } : {}),
      warnings,
      message: `CSV parse failed for ${opts.file}: ${parseErrors.join('; ')}`,
    };
  }

  if (opts.out === undefined) {
    return {
      exitCode: 0,
      block,
      ...(reason !== undefined ? { reason } : {}),
      fence: result.fence,
      warnings,
    };
  }

  // Write mode — wrap the fence in a minimal doc and validate it.
  const title = opts.title ?? titleFromFile(opts.file);
  const doc = '```meta\ntitle: ' + JSON.stringify(title) + '\n```\n\n' + result.fence;
  const outAbs = resolve(opts.cwd, opts.out);
  const refusal = overwriteRefusal(outAbs, { force: opts.force });
  if (refusal !== undefined) {
    return {
      exitCode: 1,
      block,
      ...(reason !== undefined ? { reason } : {}),
      warnings,
      message: refusal,
    };
  }
  await mkdir(dirname(outAbs), { recursive: true });
  await writeFile(outAbs, doc, 'utf8');
  const check = await runCheck({
    patterns: [relative(opts.cwd, outAbs) || opts.out],
    cwd: opts.cwd,
    docsRoot: dirname(relative(opts.cwd, outAbs)) || '.',
  });
  return {
    exitCode: check.exitCode,
    block,
    ...(reason !== undefined ? { reason } : {}),
    outPath: outAbs,
    warnings,
    check,
  };
}
