/**
 * `avo check` — validate one or more documents and report diagnostics.
 *
 * Pure {@link runCheck} returns `{ diagnostics, exitCode }`. The UI layer
 * picks how to render: JSON, Ink table (interactive TTY), or plain text (CI).
 */

import { parseDocument, resolveRefs, validateDocument, type Diagnostic, type Document } from '@avodado/core';
import { loadDocs, type DocFile } from '../io/files.js';

/** Inputs to {@link runCheck}. */
export interface CheckOptions {
  /** Glob patterns to expand. */
  readonly patterns: readonly string[];
  /** Working directory. */
  readonly cwd: string;
  /** Docs root for slug derivation. */
  readonly docsRoot: string;
}

/** Result of running `avo check` — diagnostics aggregated across all matched docs. */
export interface CheckResult {
  /** All diagnostics in file/line order. */
  readonly diagnostics: readonly Diagnostic[];
  /** Files that were checked. */
  readonly files: readonly string[];
  /** Per-file source lines, for code frames (keyed by the diagnostic `file`). */
  readonly sources: ReadonlyMap<string, readonly string[]>;
  /** Suggested exit code: 0 = clean, 1 = errors present. */
  readonly exitCode: 0 | 1;
}

/**
 * Validates a set of documents and resolves references across them.
 *
 * @param opts - Options including glob patterns and docs root.
 * @returns Aggregated diagnostics + suggested exit code.
 */
export async function runCheck(opts: CheckOptions): Promise<CheckResult> {
  const docs = await loadDocs(opts.patterns, opts.cwd, opts.docsRoot);
  const parsed: { doc: Document; file: string }[] = docs.map((d) => ({
    doc: parseDocument(d.source, d.slug),
    file: d.file,
  }));

  const diagnostics: Diagnostic[] = [];

  for (const { doc, file } of parsed) {
    diagnostics.push(...validateDocument(doc, file));
  }

  const resolved = resolveRefs(parsed);
  diagnostics.push(...resolved.diagnostics);

  diagnostics.sort((a, b) => {
    const f = a.file.localeCompare(b.file);
    if (f !== 0) return f;
    return (a.line ?? 0) - (b.line ?? 0);
  });

  const exitCode = diagnostics.some((d) => d.level === 'error') ? 1 : 0;

  const sources = new Map<string, readonly string[]>();
  for (const d of docs) sources.set(d.file, d.source.split(/\r\n|\r|\n/));

  return {
    diagnostics,
    files: docs.map((d: DocFile) => d.file),
    sources,
    exitCode,
  };
}
