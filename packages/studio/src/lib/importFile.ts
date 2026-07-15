/**
 * File-import planning — the pure half of drag-drop / "Import…" file imports.
 *
 * Everything here is a string-in, value-out decision: is this drag a FILE
 * drag (vs the canvas's own block DnD)? which importer claims the file? what
 * exactly should be inserted (a fenced-block body at a gap) or created (a
 * whole doc from an OpenAPI spec)? The impure half — reading the File,
 * touching the store, toasting — lives in `importActions.ts`.
 */

import {
  csvToChart,
  csvToStatustable,
  csvToTable,
  importerForFile,
  parseOpenApi,
  suggestCsvImport,
  type CsvImportResult,
  type ImportDiagnostic,
  type OpenApiSpec,
} from '@avodado/core';

/**
 * True when a drag carries OS files. The canvas's own block DnD writes
 * `text/plain` payloads and never `Files`, so this is THE discriminator
 * between "import this file" and "move/insert this block".
 */
export function isFileDrag(types: Iterable<string> | null | undefined): boolean {
  if (types === null || types === undefined) return false;
  for (const t of types) if (t === 'Files') return true;
  return false;
}

/**
 * Sniffs YAML/JSON text for an OpenAPI/Swagger document: a top-level
 * `openapi:` / `swagger:` key (YAML, optionally quoted) or an `"openapi"` /
 * `"swagger"` JSON key.
 */
export function looksLikeOpenApi(text: string): boolean {
  return /(^|[\n{,])\s*(['"]?)(openapi|swagger)\2\s*:/.test(text);
}

/**
 * The YAML body inside a fenced block — what `insertBlock` wants. Phase-1
 * CSV converters return whole fences (` ```table … ``` ` + trailing newline);
 * edit ops write their own fence lines.
 */
export function fenceBody(fence: string): string {
  const m = /^```[^\n]*\n([\s\S]*?)\n```\s*$/.exec(fence);
  return m?.[1] ?? fence;
}

/** `Orders API` → `orders-api`; empty/symbol-only titles fall back to `api`. */
export function slugFromTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug === '' ? 'api' : slug;
}

/**
 * The gap index a drop at viewport `y` lands in: one slot per segment,
 * crossing a segment's vertical midpoint moves the drop below it. `minIndex`
 * keeps drops out of the locked gap above the meta cover.
 */
export function dropGapIndex(
  y: number,
  segments: ReadonlyArray<{ readonly top: number; readonly bottom: number }>,
  minIndex = 0,
): number {
  let index = 0;
  for (const r of segments) {
    if (y > (r.top + r.bottom) / 2) index += 1;
  }
  return Math.max(index, minIndex);
}

/** What a file import should do, decided from the name + contents alone. */
export type ImportPlan =
  | {
      /** Insert a ready-filled block at the drop gap. */
      readonly kind: 'block';
      readonly type: 'table' | 'statustable' | 'chart';
      /** Fence-stripped YAML body for `insertBlock`. */
      readonly body: string;
      /** The suggestion one-liner (UI-ready copy from `suggestCsvImport`). */
      readonly reason: string;
      readonly warnings: readonly string[];
    }
  | {
      /** Create a whole doc from an OpenAPI spec (after the confirm dialog). */
      readonly kind: 'openapi';
      readonly spec: OpenApiSpec;
      readonly title: string;
      readonly defaultSlug: string;
    }
  | { readonly kind: 'unrecognized'; readonly message: string }
  | { readonly kind: 'error'; readonly message: string };

const warns = (diags: readonly ImportDiagnostic[]): string[] =>
  diags.filter((d) => d.level === 'warn').map((d) => d.message);
const errors = (diags: readonly ImportDiagnostic[]): string[] =>
  diags.filter((d) => d.level === 'error').map((d) => d.message);

function planCsv(name: string, text: string): ImportPlan {
  const suggestion = suggestCsvImport(text);
  let kind = suggestion.kind;
  let result: CsvImportResult<unknown> =
    kind === 'statustable'
      ? csvToStatustable(text)
      : kind === 'chart'
        ? csvToChart(text)
        : csvToTable(text);
  if (result.data === null && kind !== 'table') {
    // The suggestion mirrors the converters, but belt-and-braces: fall back
    // to the catch-all table before giving up.
    kind = 'table';
    result = csvToTable(text);
  }
  if (result.data === null) {
    return { kind: 'error', message: `Could not import ${name}: ${errors(result.diagnostics).join('; ')}` };
  }
  const fatal = errors(result.diagnostics);
  if (fatal.length > 0) {
    // e.g. an unterminated quote — a silently-mangled table is worse than no import.
    return { kind: 'error', message: `CSV parse failed for ${name}: ${fatal.join('; ')}` };
  }
  return {
    kind: 'block',
    type: kind,
    body: fenceBody(result.fence),
    reason: suggestion.reason,
    warnings: warns(result.diagnostics),
  };
}

function planOpenApi(name: string, text: string): ImportPlan {
  if (!looksLikeOpenApi(text)) {
    return {
      kind: 'unrecognized',
      message: `${name} is not a recognized import format (no openapi/swagger key).`,
    };
  }
  try {
    const spec = parseOpenApi(text);
    const title = spec.info.title;
    return { kind: 'openapi', spec, title, defaultSlug: slugFromTitle(title) };
  } catch (err) {
    return { kind: 'error', message: `Could not import ${name}: ${(err as Error).message}` };
  }
}

/**
 * Plans an import for a file's name + contents: `.csv` → a ready-filled
 * block (per `suggestCsvImport`), `.yaml`/`.yml`/`.json` that sniffs as
 * OpenAPI → a new-doc plan, anything else → unrecognized. Never throws.
 */
export function planImport(name: string, text: string): ImportPlan {
  const importer = importerForFile(name);
  if (importer === null) {
    return {
      kind: 'unrecognized',
      message: `${name} is not a recognized import format — drop a .csv or an OpenAPI .yaml/.json.`,
    };
  }
  return importer.id === 'csv' ? planCsv(name, text) : planOpenApi(name, text);
}
