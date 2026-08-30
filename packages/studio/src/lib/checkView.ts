/**
 * View-models for the check surfaces: the check-chip popover's rows (each
 * diagnostic located in its segment and, when possible, its top-level YAML
 * field) and the per-doc status the rail dots and the All-documents Status
 * column show. Pure functions — no store, no DOM.
 */

import { segmentSpan, type Diagnostic, type Document } from '@avodado/core';
import type { DocListItem } from '../api/client.js';
import { mapDiagnosticsToFields } from './blockPreview.js';

/** One row of the check popover: a diagnostic plus where to jump for it. */
export interface CheckRow {
  readonly level: Diagnostic['level'];
  readonly code: string;
  readonly message: string;
  readonly hint: string | null;
  /** 1-based source line, when the diagnostic carries one. */
  readonly line: number | null;
  /** Owning segment index, when the line falls inside one. */
  readonly segIndex: number | null;
  /** The owning segment's kind (`'markdown'` for prose), when located. */
  readonly segKind: string | null;
  /** Top-level YAML key of a typed block the diagnostic maps to, if any. */
  readonly field: string | null;
}

/**
 * Locates every diagnostic of `doc` for the popover: the segment whose span
 * contains its line, and — for typed blocks — the top-level YAML field via
 * {@link mapDiagnosticsToFields} (line remapped to block-local coordinates).
 */
export function buildCheckRows(
  source: string,
  doc: Document,
  diagnostics: readonly Diagnostic[],
): CheckRow[] {
  const spans = doc.segments.map((seg) => segmentSpan(source, seg));
  return diagnostics.map((d) => {
    const line = d.line ?? null;
    let segIndex: number | null = null;
    if (line !== null) {
      const i = spans.findIndex((sp) => line >= sp.startLine && line <= sp.endLine);
      segIndex = i === -1 ? null : i;
    }
    const seg = segIndex !== null ? doc.segments[segIndex] : undefined;
    let field: string | null = null;
    if (seg !== undefined && seg.kind !== 'markdown' && segIndex !== null && line !== null) {
      const span = spans[segIndex];
      if (span !== undefined) {
        // mapDiagnosticsToFields expects one-block-doc lines: fence on line 1,
        // body from line 2 — exactly line minus the opening fence's offset.
        const local: Diagnostic = { ...d, line: line - span.startLine + 1 };
        const { byField } = mapDiagnosticsToFields(seg.raw, [local]);
        field = [...byField.keys()][0] ?? null;
      }
    }
    return {
      level: d.level,
      code: d.code,
      message: d.message,
      hint: d.hint ?? null,
      line,
      segIndex,
      segKind: seg?.kind ?? null,
      field,
    };
  });
}

/**
 * A doc's check status for the rail and the All-documents table. Errors only
 * — warnings never change a doc's status (they never block publish).
 */
export type DocCheckStatus =
  | { readonly kind: 'pass' }
  | { readonly kind: 'errors'; readonly count: number }
  /** The doc-list payload carries no count (an older server) — show nothing. */
  | { readonly kind: 'unknown' };

/**
 * Status of one doc-list entry. The OPEN doc always uses the live in-editor
 * error count (it reflects unsaved edits); every other doc uses the
 * `errorCount` the doc-list payload carries.
 */
export function docCheckStatus(
  item: Pick<DocListItem, 'slug' | 'errorCount'>,
  open: { readonly slug: string | null; readonly errors: number },
): DocCheckStatus {
  if (open.slug !== null && item.slug === open.slug) {
    return open.errors > 0 ? { kind: 'errors', count: open.errors } : { kind: 'pass' };
  }
  if (item.errorCount === undefined) return { kind: 'unknown' };
  return item.errorCount > 0 ? { kind: 'errors', count: item.errorCount } : { kind: 'pass' };
}
