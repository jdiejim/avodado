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
 * The trailing ATX heading of a prose run, if the run ends with one (ignoring
 * trailing blank lines). Returns the heading text and its 0-based line offset
 * within the run.
 *
 * Exported for the renderer: a prose run that ends with a heading TITLES the
 * block that follows — the section head suppresses a near-duplicate block
 * `title`, and a title-less block inherits the heading for the sections nav.
 */
export function trailingHeading(text: string): { readonly text: string; readonly offset: number } | undefined {
  const lines = text.split('\n');
  let i = lines.length - 1;
  while (i >= 0 && (lines[i] ?? '').trim() === '') i--;
  if (i < 0) return undefined;
  const m = /^#{1,6}\s+(.+?)\s*#*\s*$/.exec((lines[i] ?? '').trim());
  if (m === null) return undefined;
  return { text: (m[1] ?? '').trim(), offset: i };
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
    // A warning only — warnings never fail `avo check`.
    if (seg.sourceType !== undefined) {
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
        code: 'E_PARSE_YAML',
        message: `${seg.kind}: ${seg.parseError}`,
        hint: 'Often an unquoted special character (, : # | & *). Wrap the value in quotes.',
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
    if (!result.success) {
      for (const issue of result.error.issues) {
        const rendered = renderIssue(seg.kind, issue);
        // Point at the offending token. For a missing required field the exact
        // path won't resolve, so fall back to the containing object/array.
        const loc =
          locateYamlPath(seg.raw, issue.path) ??
          (issue.path.length > 0
            ? locateYamlPath(seg.raw, issue.path.slice(0, -1))
            : undefined);
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
