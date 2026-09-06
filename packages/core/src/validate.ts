/**
 * Validates a parsed {@link Document} against the block schemas and reports
 * structured {@link Diagnostic}s for malformed YAML, schema violations, suspect
 * fence tags, and empty bodies.
 *
 * Diagnostics carry precise positions (line + column within the document),
 * a one-line actionable `hint`, and "did you mean?" `suggestions` where a fix
 * is mechanically derivable — so the CLI and editors can show teachable errors
 * and offer quick-fixes.
 */

import type { z } from 'zod';
import type { Diagnostic } from './diagnostics.js';
import type { Document } from './types.js';
import { blockRegistry } from './blocks/registry.js';
import { BLOCK_ALIASES } from './blocks/aliases.js';
import { DIALECT_PARSE_CODE, DIALECT_PARSE_HINT, isDialectSource } from './dialects.js';
import { fieldNamesAt } from './blocks/schema-walk.js';
import { locateYamlPath } from './yaml.js';
import { closest } from './suggest.js';
import type { BlockType } from './types.js';

interface IssueRender {
  readonly message: string;
  readonly hint?: string;
  readonly suggestions?: readonly string[];
}

/**
 * Turns a single zod issue into a message + actionable hint + suggestions.
 * Handles the common cases precisely; everything else falls back to the zod
 * message with a generic hint.
 */
function renderIssue(kind: BlockType, issue: z.ZodIssue): IssueRender {
  const path = issue.path.join('.');
  const at = path.length > 0 ? `${path}: ` : '';

  if (issue.code === 'unrecognized_keys') {
    const bad = issue.keys[0] ?? '';
    const valid = fieldNamesAt(kind, issue.path);
    const suggestions = closest(bad, valid, 3);
    const did = suggestions.length > 0 ? `Did you mean \`${suggestions[0]}\`? ` : '';
    return {
      message: `${kind}: unknown field${issue.keys.length > 1 ? 's' : ''} ${issue.keys.map((k) => `'${k}'`).join(', ')}`,
      hint: `${did}Valid fields: ${valid.join(', ')}.`,
      ...(suggestions.length > 0 ? { suggestions } : {}),
    };
  }

  if (issue.code === 'invalid_enum_value') {
    const options = issue.options.map(String);
    const received = String(issue.received);
    const suggestions = closest(received, options, 3);
    const did = suggestions.length > 0 ? ` Did you mean \`${suggestions[0]}\`?` : '';
    return {
      message: `${kind}: ${at}invalid value "${received}"`,
      hint: `Use one of: ${options.join(' | ')}.${did}`,
      ...(suggestions.length > 0 ? { suggestions } : {}),
    };
  }

  if (issue.code === 'invalid_type') {
    // The classic "I wrote a number, the schema wants a string" trap.
    if (issue.expected === 'string' && issue.received === 'number') {
      return {
        message: `${kind}: ${at}expected a string but got a number`,
        hint: 'Quote the value to keep it a string (e.g. tech: "16").',
      };
    }
    return {
      message: `${kind}: ${at}expected ${issue.expected}, got ${issue.received}`,
    };
  }

  return { message: `${kind}: ${at}${issue.message}` };
}

/**
 * Flattens `invalid_union` issues into the issues of the arm that fits best
 * (the arm with the FEWEST issues — a message with a typo'd field is "a
 * message with one unknown key", not "not a frame"). Every other issue passes
 * through. Recursive: a union arm may itself contain a union.
 */
function flattenIssues(issues: readonly z.ZodIssue[]): z.ZodIssue[] {
  const out: z.ZodIssue[] = [];
  for (const issue of issues) {
    if (issue.code !== 'invalid_union') {
      out.push(issue);
      continue;
    }
    let best: z.ZodIssue[] | undefined;
    for (const err of issue.unionErrors) {
      const arm = flattenIssues(err.issues);
      if (best === undefined || arm.length < best.length) best = arm;
    }
    out.push(...(best ?? [issue]));
  }
  return out;
}

/** True when a sequence `messages` item is a frame marker of the given key. */
function hasKey(item: unknown, key: string): boolean {
  return typeof item === 'object' && item !== null && !Array.isArray(item) && key in item;
}

/**
 * Sequence frame markers must nest: every `else` / `end` needs an open frame
 * and every frame needs its `end`. Warnings only — the renderer still draws
 * an unclosed frame to the last row and ignores a stray marker.
 */
function lintSequenceFrames(
  seg: { readonly data: unknown; readonly raw: string; readonly line: number },
  file: string,
  positioned: boolean,
): Diagnostic[] {
  const data = seg.data;
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return [];
  const messages = (data as Record<string, unknown>)['messages'];
  if (!Array.isArray(messages)) return [];

  const at = (i: number): { line: number; column?: number } => {
    const loc = positioned ? locateYamlPath(seg.raw, ['messages', i]) : undefined;
    return loc !== undefined
      ? { line: seg.line + loc.line, column: loc.column }
      : { line: seg.line };
  };
  const warn = (i: number, message: string, hint: string, value: string): Diagnostic => ({
    file,
    ...at(i),
    level: 'warn',
    code: 'W_SEQ_FRAME',
    message,
    hint,
    value,
  });

  const out: Diagnostic[] = [];
  const open: Array<{ readonly i: number; readonly kind: string }> = [];
  messages.forEach((item, i) => {
    if (hasKey(item, 'frame')) {
      open.push({ i, kind: String((item as Record<string, unknown>)['frame']) });
    } else if (hasKey(item, 'else')) {
      if (open.length === 0) {
        out.push(
          warn(
            i,
            `sequence: messages[${i}] is an \`else\` with no open frame`,
            'Add a frame line before it (`- alt: condition`), or remove the `else`.',
            'else',
          ),
        );
      }
    } else if (hasKey(item, 'end')) {
      if (open.length === 0) {
        out.push(
          warn(
            i,
            `sequence: messages[${i}] is an \`end\` with no open frame`,
            'Remove the `end`, or add the frame line it closes (`- alt: condition`).',
            'end',
          ),
        );
      } else {
        open.pop();
      }
    }
  });
  for (const f of open) {
    out.push(
      warn(
        f.i,
        `sequence: the \`${f.kind}\` frame at messages[${f.i}] is never closed`,
        'Add `- end` after the last message of the frame.',
        f.kind,
      ),
    );
  }
  return out;
}

/** A grid group as the nesting lint reads it (the shared `gridGroupSchema` shape). */
interface GroupCells {
  readonly id?: string;
  readonly parent?: string;
  readonly col: number;
  readonly row: number;
  readonly cols?: number;
  readonly rows?: number;
}

/**
 * Nested grid groups (`groups[].parent`) must resolve to a sibling `id`, and
 * a child's cell range must sit inside its parent's. Warnings only — the
 * renderer still draws both panels; the author moves the cells.
 */
function lintGroupNesting(
  seg: { readonly data: unknown; readonly raw: string; readonly line: number },
  file: string,
  positioned: boolean,
): Diagnostic[] {
  const data = seg.data;
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return [];
  const groups = (data as Record<string, unknown>)['groups'];
  if (!Array.isArray(groups)) return [];
  const list = groups.filter(
    (g): g is GroupCells => typeof g === 'object' && g !== null && !Array.isArray(g),
  );
  if (!list.some((g) => g.parent !== undefined)) return [];

  const byId = new Map<string, GroupCells>();
  for (const g of list) if (g.id !== undefined) byId.set(g.id, g);
  const warn = (i: number, message: string, hint: string, value: string): Diagnostic => {
    const loc = positioned ? locateYamlPath(seg.raw, ['groups', i, 'parent']) : undefined;
    return {
      file,
      ...(loc !== undefined ? { line: seg.line + loc.line, column: loc.column } : { line: seg.line }),
      level: 'warn',
      code: 'W_GROUP_NESTING',
      message,
      hint,
      value,
    };
  };

  const out: Diagnostic[] = [];
  list.forEach((g, i) => {
    if (g.parent === undefined) return;
    const p = byId.get(g.parent);
    if (p === undefined || p === g) {
      out.push(
        warn(
          i,
          `groups[${i}] names parent \`${g.parent}\`, which is not another group's id`,
          'Give the parent group an `id` and reference it, or remove `parent`.',
          g.parent,
        ),
      );
      return;
    }
    const inside =
      g.col >= p.col &&
      g.row >= p.row &&
      g.col + (g.cols ?? 1) <= p.col + (p.cols ?? 1) &&
      g.row + (g.rows ?? 1) <= p.row + (p.rows ?? 1);
    if (!inside) {
      out.push(
        warn(
          i,
          `groups[${i}] is not inside its parent \`${g.parent}\` (cells ${g.col},${g.row} +${g.cols ?? 1}×${g.rows ?? 1} vs ${p.col},${p.row} +${p.cols ?? 1}×${p.rows ?? 1})`,
          'Move the child inside the parent cell range, or grow the parent `cols` / `rows`.',
          g.parent,
        ),
      );
    }
  });
  return out;
}

/**
 * The trailing ATX heading of a prose run, if the run ends with one (ignoring
 * trailing blank lines). Returns the heading text and its 0-based line offset
 * within the run.
 *
 * Exported for the renderer: a prose run that ends with a heading TITLES the
 * block that follows — the section head suppresses a near-duplicate block
 * `title`, and a title-less block inherits the heading for the sections nav.
 */
/**
 * Heading markers — `## Title {split}`, `{top}`, `{source: …}`.
 *
 * They are authored on the heading but belong to the SLIDE, not to the text,
 * so every consumer strips them before displaying a title. One definition
 * here, because the renderer, the deck and the nav all have to agree: a marker
 * that one of them fails to strip shows up verbatim in front of a reader.
 */
const ALIGN_MARKER = /\s*\{(top|center|middle|bottom|split)\}\s*$/i;
const SOURCE_MARKER = /\s*\{source:\s*([^}]+)\}\s*$/i;

/** The heading text with any trailing markers removed. */
export function stripHeadingMarkers(text: string): string {
  let out = text;
  for (let pass = 0; pass < 3; pass++) {
    const next = out.replace(SOURCE_MARKER, '').replace(ALIGN_MARKER, '');
    if (next === out) break;
    out = next;
  }
  return out.replace(/\s+$/, '');
}

/** The `{source: …}` marker's text, if the heading carries one. */
export function readSourceMarker(text: string): string | undefined {
  const m = SOURCE_MARKER.exec(text);
  return m === null ? undefined : (m[1] ?? '').trim();
}

/** The `{top|center|bottom|split}` marker, if the heading carries one. */
export function readAlignMarker(text: string): string | undefined {
  // The source marker may sit outside it: `## T {top} {source: x}`.
  const m = ALIGN_MARKER.exec(text.replace(SOURCE_MARKER, ''));
  return m === null ? undefined : (m[1] ?? '').toLowerCase();
}

export function trailingHeading(text: string): { readonly text: string; readonly offset: number } | undefined {
  const lines = text.split('\n');
  let i = lines.length - 1;
  while (i >= 0 && (lines[i] ?? '').trim() === '') i--;
  if (i < 0) return undefined;
  const m = /^#{1,6}\s+(.+?)\s*#*\s*$/.exec((lines[i] ?? '').trim());
  if (m === null) return undefined;
  return { text: stripHeadingMarkers((m[1] ?? '').trim()), offset: i };
}

/** Lowercases and strips punctuation/whitespace so near-duplicates compare equal. */
function normalizeTitle(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

/**
 * True when a markdown heading and the following block's title read as the
 * same thing: equal after normalization, or one contains the other. Mere
 * adjacency with different texts never fires.
 *
 * Used by the renderer to suppress a block title under a same-text heading
 * ("the heading titles the block"), and by generators (e.g. the CLI's OpenAPI
 * importer) to avoid emitting a redundant title in the first place.
 */
export function isNearDuplicateTitle(heading: string, title: string): boolean {
  const a = normalizeTitle(heading);
  const b = normalizeTitle(title);
  if (a.length === 0 || b.length === 0) return false;
  return a === b || a.includes(b) || b.includes(a);
}

/**
 * Validates a document. Returns diagnostics — never throws for expected failures.
 *
 * @param doc - The parsed document.
 * @param file - The file path to use in diagnostics.
 */
export function validateDocument(doc: Document, file: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // Note on heading/title adjacency: a prose run that ends with a heading
  // TITLES the block that follows — the renderer suppresses a near-duplicate
  // block `title` (and a title-less block inherits the heading in the sections
  // nav), so duplication is healed at render time rather than warned about
  // here (the old W_DUP_HEADING).

  // Suspect fence tags (typos of real block types) → warnings.
  for (const sf of doc.suspectFences ?? []) {
    diagnostics.push({
      file,
      line: sf.line,
      column: 1,
      level: 'warn',
      code: 'W_SUSPECT_BLOCK',
      message: `Unknown block type "${sf.tag}" — rendered as plain text`,
      hint: `Did you mean \`\`\`${sf.suggestion}? Use one of the documented block types.`,
      value: sf.tag,
      suggestions: [sf.suggestion],
    });
  }

  for (const seg of doc.segments) {
    if (seg.kind === 'markdown') continue;

    // Alias fences: informational nudge toward the canonical spelling.
    // A warning only — warnings never fail `avo check`. A dialect fence
    // (mermaid / dbml / prisma) is not an alias (`BLOCK_ALIASES` has no entry
    // for it by design) — it never warns.
    const dialect = isDialectSource(seg.sourceType) ? seg.sourceType : undefined;
    // A dialect body has no YAML positions — its diagnostics sit on the fence.
    const isMermaid = dialect !== undefined;
    if (seg.sourceType !== undefined && dialect === undefined) {
      const alias = BLOCK_ALIASES[seg.sourceType];
      if (alias !== undefined) {
        const patch = Object.entries(alias.patch ?? {})
          .map(([k, v]) => `${k}: ${String(v)}`)
          .join(', ');
        const target = patch.length > 0 ? `\`${alias.type}\` (${patch})` : `\`${alias.type}\``;
        diagnostics.push({
          file,
          line: seg.line,
          column: 1,
          level: 'warn',
          code: 'W_ALIAS_TYPE',
          message: `\`${seg.sourceType}\` now lives in ${target} — both spellings work; no change needed`,
          value: seg.sourceType,
          suggestions: [alias.type],
        });
      }
    }

    if (seg.parseError !== undefined) {
      // Translate body-relative parse position to a document-absolute one.
      const line =
        seg.parseErrorLine !== undefined ? seg.line + seg.parseErrorLine : seg.line;
      diagnostics.push({
        file,
        line,
        ...(seg.parseErrorColumn !== undefined ? { column: seg.parseErrorColumn } : {}),
        level: 'error',
        code: dialect !== undefined ? DIALECT_PARSE_CODE[dialect] : 'E_PARSE_YAML',
        message: `${seg.kind}: ${seg.parseError}`,
        hint:
          dialect !== undefined
            ? DIALECT_PARSE_HINT[dialect]
            : 'Often an unquoted special character (, : # | & *). Wrap the value in quotes.',
      });
      continue;
    }

    if (seg.data === null || seg.data === undefined) {
      diagnostics.push({
        file,
        line: seg.line,
        level: 'warn',
        code: 'W_EMPTY_BLOCK',
        message: `${seg.kind}: empty body`,
        hint: 'Add the fields this block needs, or remove the block.',
      });
      continue;
    }

    const def = blockRegistry[seg.kind];
    // `id` is an envelope concern handled by the parser; strip it before
    // per-schema validation so strict schemas don't flag it as unknown.
    const dataForSchema =
      typeof seg.data === 'object' && !Array.isArray(seg.data) && 'id' in seg.data
        ? Object.fromEntries(
            Object.entries(seg.data as Record<string, unknown>).filter(([k]) => k !== 'id'),
          )
        : seg.data;
    const result = def.schema.safeParse(dataForSchema);
    if (result.success && seg.kind === 'sequence') {
      diagnostics.push(...lintSequenceFrames(seg, file, !isMermaid));
    }
    if (result.success) {
      diagnostics.push(...lintGroupNesting(seg, file, !isMermaid));
    }
    if (!result.success) {
      for (const issue of flattenIssues(result.error.issues)) {
        const rendered = renderIssue(seg.kind, issue);
        // Point at the offending token. For a missing required field the exact
        // path won't resolve, so fall back to the containing object/array. A
        // Mermaid body has no YAML positions — its diagnostics sit on the fence.
        const loc = isMermaid
          ? undefined
          : (locateYamlPath(seg.raw, issue.path) ??
            (issue.path.length > 0
              ? locateYamlPath(seg.raw, issue.path.slice(0, -1))
              : undefined));
        const position =
          loc !== undefined
            ? {
                line: seg.line + loc.line,
                column: loc.column,
                ...(loc.endColumn !== undefined ? { endColumn: loc.endColumn } : {}),
              }
            : { line: seg.line };
        diagnostics.push({
          file,
          ...position,
          level: 'error',
          code: 'E_SCHEMA',
          message: rendered.message,
          ...(rendered.hint !== undefined ? { hint: rendered.hint } : {}),
          ...(rendered.suggestions !== undefined ? { suggestions: rendered.suggestions } : {}),
        });
      }
    }
  }

  return diagnostics;
}
