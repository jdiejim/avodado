/**
 * Diagnostic taxonomy.
 *
 * Library functions return `Diagnostic[]` rather than throwing for expected
 * conditions (parse, validation, resolution). The CLI maps these to console
 * output and exit codes.
 */

/** Severity level of a diagnostic. */
export type DiagnosticLevel = 'error' | 'warn';

/** Stable diagnostic code — useful for CI filters and machine consumers. */
export type DiagnosticCode =
  | 'E_PARSE_YAML'
  | 'E_SCHEMA'
  | 'E_DUP_ID'
  | 'E_DANGLING_REF'
  | 'E_BAD_REF_FORMAT'
  | 'E_UNKNOWN_BLOCK'
  | 'W_EMPTY_BLOCK'
  | 'W_SUSPECT_BLOCK';

/**
 * Uniform diagnostic shape.
 *
 * Positions are 1-based. `line`/`column` point at the start of the offending
 * token; `endLine`/`endColumn` bound it when known (for editor underlines).
 * `hint` is a one-line, actionable fix; `suggestions` are "did you mean?"
 * candidates a tool can offer as quick-fixes. All position/help fields are
 * optional so older consumers keep working.
 */
export interface Diagnostic {
  /** File path the diagnostic refers to. */
  readonly file: string;
  /** 1-based line number, if applicable. */
  readonly line?: number;
  /** 1-based column number, if applicable. */
  readonly column?: number;
  /** 1-based end line, if the offending span is known. */
  readonly endLine?: number;
  /** 1-based exclusive end column, if the offending span is known. */
  readonly endColumn?: number;
  readonly level: DiagnosticLevel;
  readonly code: DiagnosticCode;
  /** Human-readable message. */
  readonly message: string;
  /** Offending raw value, where useful (e.g. the bad ref string). */
  readonly value?: string;
  /** One-line actionable fix, shown beneath the message. */
  readonly hint?: string;
  /** "Did you mean?" candidates — a tool may offer these as quick-fixes. */
  readonly suggestions?: readonly string[];
}

/** Base URL for per-code error documentation. */
const ERRORS_BASE = 'https://avodado.dev/errors';

/**
 * Returns the documentation URL for a diagnostic code.
 *
 * @param code - The diagnostic code.
 * @returns A stable help URL, e.g. `https://avodado.dev/errors/e_schema`.
 */
export function helpUrl(code: DiagnosticCode): string {
  return `${ERRORS_BASE}/${code.toLowerCase()}`;
}

/**
 * Exhaustiveness helper for `switch`/`if-else` chains over discriminated unions.
 * The compiler proves a branch is unreachable; calling this throws at runtime if
 * the proof fails.
 */
export function assertNever(x: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(x)}`);
}
