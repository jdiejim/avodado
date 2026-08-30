/**
 * Attributes document diagnostics to segments by line range, so the inspector
 * can show exactly the issues of the selected block.
 */

import {
  segmentSpan,
  type Diagnostic,
  type Document,
  type SegmentSpan,
} from '@avodado/core';

/** Diagnostics whose position falls inside `span` (line-less ones excluded). */
export function diagnosticsInSpan(
  diagnostics: readonly Diagnostic[],
  span: SegmentSpan,
): Diagnostic[] {
  return diagnostics.filter(
    (d) => d.line !== undefined && d.line >= span.startLine && d.line <= span.endLine,
  );
}

/** Diagnostics belonging to the segment at `segIndex` (range-checked). */
export function diagnosticsForSegment(
  diagnostics: readonly Diagnostic[],
  source: string,
  doc: Document,
  segIndex: number,
): Diagnostic[] {
  const seg = doc.segments[segIndex];
  if (seg === undefined) return [];
  return diagnosticsInSpan(diagnostics, segmentSpan(source, seg));
}

/** How many diagnostics of each level a segment carries. */
export function countLevels(diags: readonly Diagnostic[]): {
  errors: number;
  warnings: number;
} {
  let errors = 0;
  let warnings = 0;
  for (const d of diags) {
    if (d.level === 'error') errors += 1;
    else warnings += 1;
  }
  return { errors, warnings };
}

/** Error/warning tallies per segment index — the canvas card badges' input. */
export function levelsBySegment(
  diagnostics: readonly Diagnostic[],
  source: string,
  doc: Document,
): ReadonlyArray<{ errors: number; warnings: number }> {
  return doc.segments.map((_, i) =>
    countLevels(diagnosticsForSegment(diagnostics, source, doc, i)),
  );
}
