/**
 * Edit-Sheet support: builds a one-block document from a draft raw body,
 * renders it through the real pipeline, validates it, and maps diagnostics
 * back onto the block's top-level YAML fields (best effort, by line number).
 */

import {
  parseDocument,
  validateDocument,
  type BlockType,
  type Diagnostic,
  type TypedSegment,
} from '@avodado/core';
import { renderDocumentSegments, type ThemeName } from '@avodado/render';
import { diagnosticsInSpan } from './segDiagnostics.js';

/** A single fenced block as a standalone document source. */
export function buildBlockSource(kind: BlockType, raw: string): string {
  return '```' + kind + '\n' + (raw === '' ? '' : raw + '\n') + '```\n';
}

/** Everything the sheet needs about a draft: parse, render, diagnostics. */
export interface BlockPreview {
  /** The draft parsed as a segment (carries `data` + `parseError`). */
  readonly seg: TypedSegment | undefined;
  /** Rendered HTML (defs + block; the cover for `meta`), `''` when unrenderable. */
  readonly html: string;
  /** Diagnostics attributable to this block. */
  readonly diagnostics: readonly Diagnostic[];
}

/** Parses, validates, and renders a draft block body. Never throws. */
export function previewBlock(
  kind: BlockType,
  raw: string,
  theme: ThemeName,
  themeVars?: Readonly<Record<string, string>>,
): BlockPreview {
  const source = buildBlockSource(kind, raw);
  const doc = parseDocument(source, 'preview');
  const first = doc.segments[0];
  const seg = first !== undefined && first.kind !== 'markdown' ? first : undefined;
  const all = validateDocument(doc, 'preview.md');
  const lineCount = source.split('\n').length;
  const diagnostics = diagnosticsInSpan(all, { startLine: 1, endLine: lineCount });
  let html = '';
  try {
    const r = renderDocumentSegments(doc, {
      theme,
      ...(themeVars !== undefined ? { themeVars } : {}),
    });
    const body = kind === 'meta' ? r.cover : (r.segments[0]?.html ?? '');
    html = body === '' ? '' : r.defs + body;
  } catch {
    html = '';
  }
  return { seg, html, diagnostics };
}

/** Diagnostics split into per-top-level-field buckets plus the unmappable rest. */
export interface FieldDiagnostics {
  readonly byField: ReadonlyMap<string, readonly Diagnostic[]>;
  readonly rest: readonly Diagnostic[];
}

/**
 * Attributes diagnostics of a one-block doc (built by {@link buildBlockSource},
 * fence on line 1, body starting line 2) to the top-level YAML key whose lines
 * contain them. Diagnostics without a line, or on lines before any key, land
 * in `rest`.
 */
export function mapDiagnosticsToFields(
  raw: string,
  diagnostics: readonly Diagnostic[],
): FieldDiagnostics {
  // Top-level keys and the 1-based raw line each starts on.
  const keys: Array<{ name: string; startLine: number }> = [];
  raw.split('\n').forEach((line, i) => {
    const m = /^([A-Za-z_][\w-]*)\s*:/.exec(line);
    if (m !== null && m[1] !== undefined) keys.push({ name: m[1], startLine: i + 1 });
  });
  const byField = new Map<string, Diagnostic[]>();
  const rest: Diagnostic[] = [];
  for (const d of diagnostics) {
    if (d.line === undefined) {
      rest.push(d);
      continue;
    }
    const rawLine = d.line - 1; // fence occupies doc line 1
    let owner: string | null = null;
    for (const k of keys) {
      if (k.startLine <= rawLine) owner = k.name;
      else break;
    }
    if (owner === null) {
      rest.push(d);
      continue;
    }
    const list = byField.get(owner);
    if (list === undefined) byField.set(owner, [d]);
    else list.push(d);
  }
  return { byField, rest };
}
