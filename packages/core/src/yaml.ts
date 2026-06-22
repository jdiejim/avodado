/**
 * YAML body parsing for typed blocks. YAML is a superset of JSON, so a single
 * YAML parse covers both the YAML and JSON cases described in the format spec.
 */

import { parse as yamlParse, parseDocument, LineCounter, isNode } from 'yaml';

/** Result of parsing a block body. */
export type YamlParseResult =
  | { readonly ok: true; readonly data: unknown }
  | {
      readonly ok: false;
      readonly message: string;
      /** 1-based line of the parse error within the block body, if known. */
      readonly line?: number;
      /** 1-based column of the parse error within the block body, if known. */
      readonly column?: number;
    };

interface YamlError extends Error {
  readonly linePos?: ReadonlyArray<{ readonly line: number; readonly col: number }>;
}

/**
 * Parses a YAML (or JSON) block body. An empty body parses to `null` data and
 * still counts as a success — callers can treat that as an empty block.
 *
 * @param raw - The raw body text between fences.
 * @returns A successful parse with `data`, or a failure with `message` and an
 *   optional body-relative `line` / `column`.
 */
export function parseBlockBody(raw: string): YamlParseResult {
  try {
    const data = yamlParse(raw) as unknown;
    return { ok: true, data };
  } catch (err) {
    const e = err as YamlError;
    const pos = e.linePos?.[0];
    if (pos !== undefined) {
      return { ok: false, message: e.message, line: pos.line, column: pos.col };
    }
    return { ok: false, message: e.message };
  }
}

/** A resolved source position within a block body (1-based line/column). */
export interface YamlLocation {
  /** 1-based line within the block body. */
  readonly line: number;
  /** 1-based column within the block body. */
  readonly column: number;
  /** 1-based exclusive end column when the node ends on the same line. */
  readonly endColumn?: number;
}

/**
 * Resolves the source position of a value at `path` inside a YAML block body.
 *
 * Used to point a schema diagnostic at the exact offending token (e.g. the
 * `kind:` value of `messages[2]`) rather than at the block's opening fence.
 * Returns the position of the value node when the path resolves to a scalar,
 * falling back to the containing node. Returns `undefined` if the path can't be
 * resolved (e.g. the body failed to parse) — callers should degrade to the
 * block's fence line.
 *
 * @param raw - The raw block body (between fences).
 * @param path - A zod-style path, e.g. `['messages', 2, 'kind']`.
 * @returns The body-relative location, or `undefined`.
 *
 * @example
 * ```ts
 * locateYamlPath('messages:\n  - { from: A, kind: bogus }', ['messages', 0, 'kind']);
 * // → { line: 2, column: 19, endColumn: 23 }
 * ```
 */
export function locateYamlPath(
  raw: string,
  path: ReadonlyArray<string | number>,
): YamlLocation | undefined {
  let doc;
  const lineCounter = new LineCounter();
  try {
    doc = parseDocument(raw, { lineCounter });
  } catch {
    return undefined;
  }
  if (doc.errors.length > 0 && doc.contents === null) return undefined;

  const node: unknown = path.length === 0 ? doc.contents : doc.getIn(path, true);
  if (!isNode(node) || node.range === null || node.range === undefined) return undefined;

  const [start, valueEnd] = node.range;
  const startPos = lineCounter.linePos(start);
  const endPos = lineCounter.linePos(valueEnd);
  const loc: { line: number; column: number; endColumn?: number } = {
    line: startPos.line,
    column: startPos.col,
  };
  if (endPos.line === startPos.line) loc.endColumn = endPos.col;
  return loc;
}
