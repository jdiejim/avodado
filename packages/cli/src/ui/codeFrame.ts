/**
 * Renders a code frame — the offending source line(s) with a caret underline —
 * for a diagnostic, in the style of Rust / TypeScript / Babel errors.
 *
 * Pure and dependency-free; the caller supplies the file's source lines so this
 * stays I/O-free and testable.
 */

import pc from 'picocolors';

/** Inputs for {@link renderCodeFrame}. */
export interface CodeFrameInput {
  /** The file's source split into lines (no trailing newline per line). */
  readonly lines: readonly string[];
  /** 1-based line of the offending token. */
  readonly line: number;
  /** 1-based column of the offending token, if known. */
  readonly column?: number;
  /** 1-based exclusive end column, if known (for a multi-char underline). */
  readonly endColumn?: number;
  /** Number of context lines to show above the offending line. Default 1. */
  readonly contextBefore?: number;
  /** Caret colour: 'error' (red) or 'warn' (yellow). Default 'error'. */
  readonly level?: 'error' | 'warn';
}

/**
 * Builds a code frame string. Returns an empty string if the line is out of
 * range (so callers can unconditionally append it).
 *
 * @example
 * ```
 *   30 |   - { from: Client, kind: bogus }
 *      |                     ^^^^^
 * ```
 */
export function renderCodeFrame(input: CodeFrameInput): string {
  const { lines, line } = input;
  if (line < 1 || line > lines.length) return '';

  const contextBefore = input.contextBefore ?? 1;
  const start = Math.max(1, line - contextBefore);
  const gutterWidth = String(line).length + 1;
  const tint = input.level === 'warn' ? pc.yellow : pc.red;

  const out: string[] = [];
  for (let n = start; n <= line; n++) {
    const text = lines[n - 1] ?? '';
    const gutter = pc.dim(`${String(n).padStart(gutterWidth)} | `);
    out.push(gutter + text);
  }

  // Caret line under the offending span.
  if (input.column !== undefined && input.column >= 1) {
    const col = input.column;
    const span = input.endColumn !== undefined ? Math.max(1, input.endColumn - col) : 1;
    const pad = ' '.repeat(gutterWidth) + pc.dim(' | ') + ' '.repeat(col - 1);
    out.push(pad + tint('^'.repeat(span)));
  }

  return out.join('\n');
}
