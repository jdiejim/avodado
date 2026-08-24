/**
 * Text-surface extraction for the prose linter.
 *
 * A surface is one analyzable run of author prose with a context:
 *
 * - `procedural` — `steps` block item text (`body`, `note`). The tightest
 *   limits and the passive-voice check apply here.
 * - `descriptive` — markdown paragraphs, `prose` block texts, `pullquote`
 *   text, and the shared text fields (`description`, `lede`, `body`, `note`,
 *   `summary`, `subtitle`) wherever a block carries them as strings.
 *
 * Shared text fields set `isField: true`. A field must carry complete
 * information — the linter applies form rules (sentence length, tense,
 * openers) but exempts fields from the paragraph cap, because a
 * sentence-count cap pressures authors to delete facts. Completeness beats
 * brevity inside blocks; the skill's zone rules (SKILL.md "Prose rules",
 * `reference/style-ste.md` "Where each level applies") are the authority.
 * `steps` item text is procedural instruction text, not a completeness-first
 * field, so it keeps `isField: false`.
 *
 * NEVER analyzed: code blocks and `code`/`lang` fields, fenced YAML outside
 * the listed fields, inline code spans (masked), headings, table cell data,
 * ids, and name/label/title fields.
 */

import type { BlockType, Document, Segment, TypedSegment } from '../types.js';
import { locateYamlPath } from '../yaml.js';
import { splitParagraphs } from './text.js';

/** The text context a surface belongs to. */
export type ProseContext = 'procedural' | 'descriptive';

/** A position a diagnostic can point at (1-based, like all diagnostics). */
export interface UnitLocation {
  readonly line?: number;
  readonly column?: number;
}

/** One paragraph-shaped run of prose, ready for the analyzers. */
export interface ProseUnit {
  /** The unit's text (one paragraph / list item / field paragraph). */
  readonly text: string;
  readonly context: ProseContext;
  /** Where the unit came from: a markdown run or a typed block's kind. */
  readonly kind: 'markdown' | BlockType;
  /** True for `steps` item text — the passive-voice check applies. */
  readonly isStep: boolean;
  /**
   * True for a shared block text field (`description`, `lede`, `body`,
   * `note`, `summary`, `subtitle`) — exempt from the paragraph cap so the
   * length rule never pressures fact deletion.
   */
  readonly isField: boolean;
  /** Maps a character offset in `text` to a document position. */
  readonly locate: (offset: number) => UnitLocation;
}

/** Block text fields collected wherever they appear as strings. */
const TEXT_KEYS: ReadonlySet<string> = new Set([
  'description',
  'lede',
  'body',
  'note',
  'summary',
  'subtitle',
]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/* ── Markdown segments ─────────────────────────────────────────────────── */

const FENCE_RE = /^(`{3,}|~{3,})/;
const HEADING_RE = /^#{1,6}\s/;
const TABLE_RE = /^\|/;
const HTML_RE = /^</;
const LIST_ITEM_RE = /^([-*+]|\d{1,3}[.)])\s+/;
const QUOTE_MARK_RE = /^>\s?/;
const INDENTED_CODE_RE = /^( {4,}|\t)/;

interface ParaLine {
  readonly text: string;
  /** Absolute 1-based document line. */
  readonly line: number;
}

/** Joins accumulated lines into one unit with an offset→line mapping. */
function unitFromLines(lines: readonly ParaLine[]): ProseUnit | undefined {
  const text = lines.map((l) => l.text).join('\n');
  if (text.trim().length === 0) return undefined;
  // Offset ranges per line for `locate`.
  const starts: { start: number; line: number }[] = [];
  let off = 0;
  for (const l of lines) {
    starts.push({ start: off, line: l.line });
    off += l.text.length + 1; // '\n'
  }
  const locate = (offset: number): UnitLocation => {
    let line = starts[0]?.line;
    for (const s of starts) {
      if (s.start <= offset) line = s.line;
      else break;
    }
    return line !== undefined ? { line } : {};
  };
  return { text, context: 'descriptive', kind: 'markdown', isStep: false, isField: false, locate };
}

/**
 * The open fenced-code marker, if any — shared across a document's markdown
 * segments so an example fence that the block parser split apart (a typed
 * fence inside a longer ```` fence becomes its own segment) still masks
 * everything up to its true closing marker.
 */
interface FenceState {
  open: { readonly char: string; readonly len: number } | undefined;
}

/**
 * Splits a markdown segment into prose units: paragraphs, list items (one
 * unit each — a bullet list is not a paragraph), and blockquote runs. Skips
 * fenced code, indented code, headings, table rows, and HTML lines.
 *
 * A fence closes only on a bare marker of the same character, at least as
 * long as the opener (CommonMark) — a shorter ``` inside a ```` example is
 * content, not a toggle.
 */
function markdownUnits(text: string, segLine: number, fence: FenceState): ProseUnit[] {
  const units: ProseUnit[] = [];
  const lines = text.split('\n');
  let current: ParaLine[] = [];

  const flush = (): void => {
    const u = unitFromLines(current);
    if (u !== undefined) units.push(u);
    current = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] as string;
    const absLine = segLine + i;
    const trimmed = raw.trim();

    const marker = FENCE_RE.exec(trimmed)?.[1];
    if (marker !== undefined) {
      if (fence.open === undefined) {
        flush();
        fence.open = { char: marker[0] as string, len: marker.length };
      } else if (marker[0] === fence.open.char && marker.length >= fence.open.len && trimmed === marker) {
        fence.open = undefined;
      }
      continue;
    }
    if (fence.open !== undefined) continue;
    if (trimmed === '') {
      flush();
      continue;
    }
    if (HEADING_RE.test(trimmed) || TABLE_RE.test(trimmed) || HTML_RE.test(trimmed)) {
      flush();
      continue;
    }
    // Indented code only opens at a paragraph boundary; inside a paragraph an
    // indented line is a continuation (e.g. under a list item).
    if (current.length === 0 && INDENTED_CODE_RE.test(raw)) continue;

    const unquoted = raw.replace(QUOTE_MARK_RE, '');
    // A bare `>` line is a paragraph break inside a blockquote.
    if (unquoted.trim() === '') {
      flush();
      continue;
    }
    const listMatch = LIST_ITEM_RE.exec(unquoted.trim());
    if (listMatch !== null) {
      flush(); // each list item is its own unit
      current.push({ text: unquoted.trim().slice(listMatch[0].length), line: absLine });
      continue;
    }
    current.push({ text: unquoted, line: absLine });
  }
  flush();
  return units;
}

/* ── Typed block segments ──────────────────────────────────────────────── */

/**
 * Splits one field value into paragraph units that all point at the field's
 * YAML position (located lazily, once).
 */
function fieldUnits(
  seg: TypedSegment,
  path: ReadonlyArray<string | number>,
  value: string,
  context: ProseContext,
  isStep: boolean,
  isField: boolean,
): ProseUnit[] {
  let cached: UnitLocation | undefined;
  const locate = (): UnitLocation => {
    if (cached !== undefined) return cached;
    const loc =
      locateYamlPath(seg.raw, path) ??
      (path.length > 0 ? locateYamlPath(seg.raw, path.slice(0, -1)) : undefined);
    cached =
      loc !== undefined
        ? { line: seg.line + loc.line, column: loc.column }
        : { line: seg.line };
    return cached;
  };
  return splitParagraphs(value).map((p) => ({
    text: p.text,
    context,
    kind: seg.kind,
    isStep,
    isField,
    locate,
  }));
}

/** Recursively collects string values at the shared text keys. */
function walkTextFields(
  seg: TypedSegment,
  value: unknown,
  path: ReadonlyArray<string | number>,
  out: ProseUnit[],
): void {
  if (Array.isArray(value)) {
    value.forEach((v, i) => walkTextFields(seg, v, [...path, i], out));
    return;
  }
  if (!isPlainObject(value)) return;
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === 'string') {
      if (TEXT_KEYS.has(k)) out.push(...fieldUnits(seg, [...path, k], v, 'descriptive', false, true));
      continue;
    }
    walkTextFields(seg, v, [...path, k], out);
  }
}

/** Units for a typed block segment, per its kind's text surfaces. */
function blockUnits(seg: TypedSegment): ProseUnit[] {
  if (!isPlainObject(seg.data)) return [];
  const data = seg.data;
  const out: ProseUnit[] = [];

  if (seg.kind === 'steps') {
    // Procedural text: item `body` and `note`. The item `title` is a label.
    const desc = data['description'];
    if (typeof desc === 'string') out.push(...fieldUnits(seg, ['description'], desc, 'descriptive', false, true));
    const items = data['items'];
    if (Array.isArray(items)) {
      items.forEach((item, i) => {
        if (!isPlainObject(item)) return;
        for (const key of ['body', 'note'] as const) {
          const v = item[key];
          // Procedural instruction text, not a completeness-first field.
          if (typeof v === 'string') out.push(...fieldUnits(seg, ['items', i, key], v, 'procedural', true, false));
        }
      });
    }
    return out;
  }

  if (seg.kind === 'prose') {
    for (const key of ['description', 'lede'] as const) {
      const v = data[key];
      if (typeof v === 'string') out.push(...fieldUnits(seg, [key], v, 'descriptive', false, true));
    }
    const blocks = data['blocks'];
    if (Array.isArray(blocks)) {
      blocks.forEach((b, i) => {
        if (!isPlainObject(b)) return;
        if (b['type'] === 'h') return; // headings are never analyzed
        const t = b['text'];
        if (typeof t === 'string') out.push(...fieldUnits(seg, ['blocks', i, 'text'], t, 'descriptive', false, false));
        const items = b['items'];
        if (Array.isArray(items)) {
          items.forEach((it, j) => {
            if (typeof it === 'string') out.push(...fieldUnits(seg, ['blocks', i, 'items', j], it, 'descriptive', false, false));
          });
        }
      });
    }
    return out;
  }

  if (seg.kind === 'pullquote') {
    const t = data['text'];
    if (typeof t === 'string') out.push(...fieldUnits(seg, ['text'], t, 'descriptive', false, false));
    return out;
  }

  walkTextFields(seg, data, [], out);
  return out;
}

/**
 * Lines to skip for YAML frontmatter (`---` on the document's first line
 * through its closing `---`/`...`), or 0 when there is none. Frontmatter is
 * metadata, never author prose.
 */
function frontmatterLines(text: string): number {
  const lines = text.split('\n');
  if ((lines[0] ?? '').trim() !== '---') return 0;
  for (let i = 1; i < lines.length; i++) {
    const t = (lines[i] as string).trim();
    if (t === '---' || t === '...') return i + 1;
  }
  return 0;
}

/** Collects every analyzable prose unit of a document, in source order. */
export function collectProseUnits(doc: Document): ProseUnit[] {
  const units: ProseUnit[] = [];
  const fence: FenceState = { open: undefined };
  let first = true;
  for (const seg of doc.segments as readonly Segment[]) {
    if (seg.kind === 'markdown') {
      let text = seg.text;
      let line = seg.line;
      if (first && seg.line === 1) {
        const skip = frontmatterLines(text);
        text = text.split('\n').slice(skip).join('\n');
        line += skip;
      }
      first = false;
      units.push(...markdownUnits(text, line, fence));
      continue;
    }
    first = false;
    // A typed segment inside an open markdown fence is example content.
    if (fence.open !== undefined) continue;
    if (seg.parseError !== undefined) continue;
    units.push(...blockUnits(seg));
  }
  return units;
}
