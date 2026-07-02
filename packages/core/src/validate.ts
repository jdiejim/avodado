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

import { z } from 'zod';
import type { Diagnostic } from './diagnostics.js';
import type { Document } from './types.js';
import { blockRegistry } from './blocks/registry.js';
import { blockSchemas } from './blocks/schemas.js';
import { locateYamlPath } from './yaml.js';
import { closest } from './suggest.js';
import type { BlockType } from './types.js';

/** Strips wrappers (optional / nullable / default) to reach the inner schema. */
function unwrap(schema: z.ZodTypeAny): z.ZodTypeAny {
  let cur = schema;
  for (;;) {
    if (cur instanceof z.ZodOptional || cur instanceof z.ZodNullable) cur = cur.unwrap();
    else if (cur instanceof z.ZodDefault) cur = cur._def.innerType as z.ZodTypeAny;
    else return cur;
  }
}

/**
 * Resolves the schema node at a zod issue path, walking objects by key and
 * arrays by index. Returns `undefined` if the path leaves the known shape.
 */
function schemaAt(kind: BlockType, path: ReadonlyArray<string | number>): z.ZodTypeAny | undefined {
  let cur: z.ZodTypeAny = blockSchemas[kind];
  for (const seg of path) {
    cur = unwrap(cur);
    if (typeof seg === 'number') {
      if (!(cur instanceof z.ZodArray)) return undefined;
      cur = cur.element as z.ZodTypeAny;
    } else {
      if (!(cur instanceof z.ZodObject)) return undefined;
      const next = (cur.shape as Record<string, z.ZodTypeAny>)[seg];
      if (next === undefined) return undefined;
      cur = next;
    }
  }
  return unwrap(cur);
}

/**
 * Field names valid at a given path. For `unrecognized_keys`, the issue path is
 * the *object that owns the bad key*, so this returns that object's fields —
 * giving accurate "did you mean?" suggestions even for nested records.
 */
function fieldNamesAt(kind: BlockType, path: ReadonlyArray<string | number>): string[] {
  const schema = schemaAt(kind, path) ?? blockSchemas[kind];
  return schema instanceof z.ZodObject
    ? Object.keys(schema.shape as Record<string, unknown>)
    : [];
}

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
 * Validates a document. Returns diagnostics — never throws for expected failures.
 *
 * @param doc - The parsed document.
 * @param file - The file path to use in diagnostics.
 */
export function validateDocument(doc: Document, file: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

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
