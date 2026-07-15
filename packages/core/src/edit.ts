/**
 * Pure surgical text operations on an Avodado Markdown source.
 *
 * Every function takes the source string plus the {@link Document} parsed from
 * it (`doc` MUST be `parseDocument(source, …)` of the same source — the segment
 * indices and line numbers are trusted, not re-derived) and returns a new
 * source string. Nothing here does I/O; line endings are normalised
 * (`\r\n` / `\r` → `\n`) on entry exactly like `splitMarkdown`, so the result
 * is always LF-only.
 *
 * Invalid indices or kind mismatches (e.g. {@link replaceBlockBody} on a prose
 * segment) are programmer errors — callers hold the parsed document and can
 * check first — so these throw a plain `RangeError` / `TypeError` (mirroring
 * `assertNever`), rather than returning diagnostics like the parse/validate
 * pipeline does for *expected* conditions.
 */

import { parseDocument as yamlParseDocument, stringify as yamlStringify } from 'yaml';
import type { BlockType, Document, Segment } from './types.js';
import { parseDocument } from './parser.js';

/** Matches a closing fence line — kept in sync with `splitter.ts`. */
const CLOSE_FENCE_RE = /^```\s*$/;

/** Normalises line endings the same way `splitMarkdown` does. */
function normalize(source: string): string {
  return source.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/** The 1-based inclusive line range a segment occupies in the source. */
export interface SegmentSpan {
  /** 1-based first line (the opening fence for typed blocks). */
  readonly startLine: number;
  /** 1-based last line, inclusive (the closing fence for typed blocks). */
  readonly endLine: number;
}

/**
 * Computes the line extent of a segment by scanning the source, never from the
 * segment's `raw` (a `raw === ''` block is ambiguous between a zero-line and a
 * one-blank-line body). For typed blocks the fences are included; an unclosed
 * fence extends to EOF. For prose runs the extent is the run's line count
 * (prose text owns any blank lines inside its run).
 *
 * @param source - The Markdown source `seg` was parsed from.
 * @param seg - A segment of `parseDocument(source, …)`.
 */
export function segmentSpan(source: string, seg: Segment): SegmentSpan {
  const lines = normalize(source).split('\n');
  if (seg.kind === 'markdown') {
    return { startLine: seg.line, endLine: seg.line + seg.text.split('\n').length - 1 };
  }
  // Typed block: seg.line is the opening fence; scan forward for the close.
  for (let i = seg.line; i < lines.length; i++) {
    if (CLOSE_FENCE_RE.test(lines[i] ?? '')) {
      return { startLine: seg.line, endLine: i + 1 };
    }
  }
  // Unclosed fence: the block runs to EOF.
  return { startLine: seg.line, endLine: lines.length };
}

/** Looks up a segment, throwing `RangeError` for an out-of-range index. */
function segmentAt(doc: Document, segIndex: number): Segment {
  const seg = doc.segments[segIndex];
  if (seg === undefined) {
    throw new RangeError(
      `segment index ${segIndex} out of range (document has ${doc.segments.length} segments)`,
    );
  }
  return seg;
}

/** True when every line in the slice is blank (empty or whitespace-only). */
function isBlank(line: string): boolean {
  return line.trim().length === 0;
}

/** Drops trailing blank lines. */
function trimTrailingBlank(lines: readonly string[]): string[] {
  let end = lines.length;
  while (end > 0 && isBlank(lines[end - 1] ?? '')) end--;
  return lines.slice(0, end);
}

/** Drops leading blank lines. */
function trimLeadingBlank(lines: readonly string[]): string[] {
  let start = 0;
  while (start < lines.length && isBlank(lines[start] ?? '')) start++;
  return lines.slice(start);
}

/**
 * Replaces the body of the typed block at `segIndex` with `newRaw`, verbatim,
 * between the fences. The fences themselves are untouched (an unclosed block
 * stays unclosed). An empty `newRaw` produces a zero-line body (the fences end
 * up adjacent) — except when the existing `raw` is already `''`, in which case
 * the source is returned unchanged so the round-trip
 * `replaceBlockBody(src, doc, i, seg.raw) === normalize(src)` holds for every
 * block, including the ambiguous empty/one-blank-line case.
 *
 * @param source - The Markdown source.
 * @param doc - `parseDocument(source, …)` — must match `source`.
 * @param segIndex - Index into `doc.segments`; must be a typed block.
 * @param newRaw - The new body text (no fences, no trailing newline required).
 */
export function replaceBlockBody(
  source: string,
  doc: Document,
  segIndex: number,
  newRaw: string,
): string {
  const seg = segmentAt(doc, segIndex);
  if (seg.kind === 'markdown') {
    throw new TypeError(`segment ${segIndex} is prose — use replaceProse`);
  }
  const normalised = normalize(source);
  if (newRaw === seg.raw) return normalised;

  const lines = normalised.split('\n');
  const span = segmentSpan(normalised, seg);
  const openIdx = span.startLine - 1;
  const lastIdx = span.endLine - 1;
  const closed = CLOSE_FENCE_RE.test(lines[lastIdx] ?? '');
  // Body sits strictly between the fences (or runs to EOF when unclosed).
  const bodyEnd = closed ? lastIdx : lastIdx + 1;
  const bodyLines = newRaw === '' ? [] : newRaw.split('\n');
  const out = [...lines.slice(0, openIdx + 1), ...bodyLines, ...lines.slice(bodyEnd)];
  return out.join('\n');
}

/**
 * Replaces the prose run at `segIndex` with `newText`, verbatim.
 *
 * Note: a blank-only `newText` yields a document whose re-parse drops the
 * segment entirely (the splitter discards blank-only prose).
 *
 * @param source - The Markdown source.
 * @param doc - `parseDocument(source, …)` — must match `source`.
 * @param segIndex - Index into `doc.segments`; must be a prose segment.
 * @param newText - The replacement Markdown text (no trailing newline required).
 */
export function replaceProse(
  source: string,
  doc: Document,
  segIndex: number,
  newText: string,
): string {
  const seg = segmentAt(doc, segIndex);
  if (seg.kind !== 'markdown') {
    throw new TypeError(`segment ${segIndex} is a ${seg.kind} block — use replaceBlockBody`);
  }
  const normalised = normalize(source);
  const lines = normalised.split('\n');
  const span = segmentSpan(normalised, seg);
  const out = [
    ...lines.slice(0, span.startLine - 1),
    ...newText.split('\n'),
    ...lines.slice(span.endLine),
  ];
  return out.join('\n');
}

/**
 * Inserts `newLines` before the segment at `index` (or appends when
 * `index === doc.segments.length`), normalising the surrounding whitespace to
 * exactly one blank line between the inserted content and each neighbour.
 * Blank gap lines between segments (which belong to no segment) are absorbed,
 * and blank lines a neighbouring prose run owns at the seam are trimmed.
 */
function insertLines(
  source: string,
  doc: Document,
  index: number,
  newLines: readonly string[],
): string {
  if (!Number.isInteger(index) || index < 0 || index > doc.segments.length) {
    throw new RangeError(
      `insert index ${index} out of range (document has ${doc.segments.length} segments)`,
    );
  }
  const normalised = normalize(source);
  const lines = normalised.split('\n');

  if (doc.segments.length === 0) {
    return [...newLines, ''].join('\n');
  }

  const prev = index > 0 ? doc.segments[index - 1] : undefined;
  const next = index < doc.segments.length ? doc.segments[index] : undefined;
  const head =
    prev !== undefined ? trimTrailingBlank(lines.slice(0, segmentSpan(normalised, prev).endLine)) : [];
  const tail =
    next !== undefined
      ? trimLeadingBlank(lines.slice(segmentSpan(normalised, next).startLine - 1))
      : [];

  const out: string[] = [];
  if (head.length > 0) out.push(...head, '');
  out.push(...newLines);
  if (tail.length > 0) out.push('', ...tail);
  else out.push(''); // appended at EOF — keep the trailing newline
  return out.join('\n');
}

/**
 * Inserts a new typed block before the segment at `index`
 * (`index === doc.segments.length` appends at the end), wrapped in
 * ` ```type ` … ` ``` ` fences with exactly one blank line separating it from
 * each neighbour.
 *
 * @param source - The Markdown source.
 * @param doc - `parseDocument(source, …)` — must match `source`.
 * @param index - Insertion position in segment order (0 … segments.length).
 * @param type - The block type for the opening fence.
 * @param body - The YAML body WITHOUT fences; `''` produces a zero-line body.
 */
export function insertBlock(
  source: string,
  doc: Document,
  index: number,
  type: BlockType,
  body: string,
): string {
  const bodyLines = body === '' ? [] : body.split('\n');
  return insertLines(source, doc, index, ['```' + type, ...bodyLines, '```']);
}

/**
 * Inserts a Markdown prose run before the segment at `index`
 * (`index === doc.segments.length` appends), with exactly one blank line
 * separating it from each neighbour.
 *
 * Note: a blank-only `text` is inserted verbatim but disappears on re-parse
 * (the splitter discards blank-only prose). Adjacent prose runs merge into one
 * segment on re-parse — there is no fence to keep them apart.
 *
 * @param source - The Markdown source.
 * @param doc - `parseDocument(source, …)` — must match `source`.
 * @param index - Insertion position in segment order (0 … segments.length).
 * @param text - The Markdown text (no trailing newline required).
 */
export function insertProse(source: string, doc: Document, index: number, text: string): string {
  return insertLines(source, doc, index, text.split('\n'));
}

/**
 * Removes the segment at `segIndex`, absorbing the blank gap lines around it
 * so the new neighbours end up separated by exactly one blank line (never
 * fused, never double-gapped). Removing the only segment yields `''`.
 *
 * Note: when both neighbours are prose runs they merge into a single prose
 * segment on re-parse — nothing separates them once the block between is gone.
 *
 * @param source - The Markdown source.
 * @param doc - `parseDocument(source, …)` — must match `source`.
 * @param segIndex - Index into `doc.segments`.
 */
export function removeSegment(source: string, doc: Document, segIndex: number): string {
  segmentAt(doc, segIndex); // range check
  const normalised = normalize(source);
  const lines = normalised.split('\n');

  const prev = segIndex > 0 ? doc.segments[segIndex - 1] : undefined;
  const next = segIndex < doc.segments.length - 1 ? doc.segments[segIndex + 1] : undefined;
  const head =
    prev !== undefined ? trimTrailingBlank(lines.slice(0, segmentSpan(normalised, prev).endLine)) : [];
  const tail =
    next !== undefined
      ? trimLeadingBlank(lines.slice(segmentSpan(normalised, next).startLine - 1))
      : [];

  // `tail` runs to the end of the line array, so it already carries the
  // source's trailing newline (as a final empty line) when there is one.
  if (head.length === 0 && tail.length === 0) return '';
  if (tail.length === 0) return [...head, ''].join('\n');
  if (head.length === 0) return tail.join('\n');
  return [...head, '', ...tail].join('\n');
}

/**
 * Moves the segment at `from` so it sits immediately before the segment that
 * was ORIGINALLY at index `to` (indices refer to `doc.segments` before the
 * move). `to === doc.segments.length` moves it to the end. Consequently:
 *
 * - `to < from` → the segment's new index is `to`;
 * - `to > from` → the segment's new index is `to - 1` (everything between
 *   shifted left by the removal);
 * - `to === from` and `to === from + 1` are no-ops (the segment would land
 *   back where it started) — the normalised source is returned unchanged.
 *
 * The segment's exact text (fences included) is preserved; the whitespace at
 * both seams is normalised to exactly one blank line, as with
 * {@link insertBlock} / {@link removeSegment}.
 *
 * @param source - The Markdown source.
 * @param doc - `parseDocument(source, …)` — must match `source`.
 * @param from - Index of the segment to move (0 … segments.length - 1).
 * @param to - Original index of the segment to insert before (0 … segments.length).
 */
export function moveSegment(source: string, doc: Document, from: number, to: number): string {
  segmentAt(doc, from); // range check
  if (!Number.isInteger(to) || to < 0 || to > doc.segments.length) {
    throw new RangeError(
      `move target ${to} out of range (document has ${doc.segments.length} segments)`,
    );
  }
  const normalised = normalize(source);
  if (to === from || to === from + 1) return normalised;

  const seg = doc.segments[from];
  if (seg === undefined) throw new RangeError(`segment index ${from} out of range`);
  const span = segmentSpan(normalised, seg);
  const segLines = normalised.split('\n').slice(span.startLine - 1, span.endLine);

  const removed = removeSegment(normalised, doc, from);
  const removedDoc = parseDocument(removed, doc.slug);
  const insertAt = to < from ? to : to - 1;
  return insertLines(removed, removedDoc, insertAt, segLines);
}

/**
 * Serialises block data to a YAML body for a freshly created block:
 * `yaml.stringify` with `lineWidth: 0` (no re-wrapping) and the trailing
 * newline stripped, matching the `raw` convention (no trailing newline).
 *
 * For editing an EXISTING body prefer {@link setYamlPath} /
 * {@link deleteYamlPath}, which preserve the author's comments and formatting.
 *
 * @param data - The plain data to serialise.
 */
export function serializeBlockData(data: unknown): string {
  return yamlStringify(data, { lineWidth: 0 }).replace(/\n$/, '');
}

/** Parses a YAML body for a targeted edit, throwing on unparsable input. */
function parseYamlForEdit(raw: string): ReturnType<typeof yamlParseDocument> {
  const doc = yamlParseDocument(raw);
  const err = doc.errors[0];
  if (err !== undefined) {
    // A caller editing paths in a body it never checked parses is a programmer
    // error — the parse/validate pipeline surfaces E_PARSE_YAML beforehand.
    throw new TypeError(`cannot edit unparsable YAML body: ${err.message}`);
  }
  return doc;
}

/** Serialises an edited YAML document back to `raw` form (no trailing newline). */
function yamlDocToRaw(doc: ReturnType<typeof yamlParseDocument>): string {
  return doc.toString({ lineWidth: 0 }).replace(/\n$/, '');
}

/**
 * Sets the value at `path` inside a YAML block body, preserving the rest of
 * the body byte-for-byte where possible (comments, key order, quoting style of
 * untouched nodes) via the `yaml` document API. Missing intermediate
 * collections are created.
 *
 * @param raw - The block body (between the fences; must parse as YAML).
 * @param path - Object keys and array indices, e.g. `['messages', 2, 'label']`.
 * @param value - The new value (plain JS; serialised by `yaml`).
 * @returns The edited body, without a trailing newline.
 */
export function setYamlPath(
  raw: string,
  path: ReadonlyArray<string | number>,
  value: unknown,
): string {
  const doc = parseYamlForEdit(raw);
  doc.setIn(path, value);
  return yamlDocToRaw(doc);
}

/**
 * Deletes the node at `path` inside a YAML block body, preserving the rest of
 * the body's formatting and comments. Deleting a path that does not exist is a
 * no-op (the body is reserialised either way).
 *
 * @param raw - The block body (between the fences; must parse as YAML).
 * @param path - Object keys and array indices, e.g. `['messages', 2]`.
 * @returns The edited body, without a trailing newline.
 */
export function deleteYamlPath(raw: string, path: ReadonlyArray<string | number>): string {
  const doc = parseYamlForEdit(raw);
  doc.deleteIn(path);
  return yamlDocToRaw(doc);
}
