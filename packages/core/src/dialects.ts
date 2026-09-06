/**
 * Input dialects — fence tags whose body is not YAML but converts to a typed
 * block at parse time: ```` ```mermaid ```` (five diagram grammars, see
 * `mermaid/`), ```` ```dbml ```` and ```` ```prisma ```` (both → `erd`, see
 * `import/dbml.ts` and `import/prisma.ts`). The converters emit exactly the
 * data the block schema accepts, so validation and rendering are identical
 * to a YAML block; YAML stays the canonical form on disk — an edit rewrites
 * the fence to the canonical tag (`edit.ts`).
 *
 * A segment records the tag it was written with in `sourceType`; this
 * module is the one place that knows which tags are dialects, which block
 * each one produces, and which diagnostic code a bad line gets.
 */

import { stringify as stringifyYaml } from 'yaml';
import type { BlockType } from './types.js';
import type { DiagnosticCode } from './diagnostics.js';
import { MERMAID_SOURCE, convertMermaid, detectMermaidKind } from './mermaid/index.js';
import type { MermaidResult } from './mermaid/lines.js';
import { convertDbml } from './import/dbml.js';
import { convertPrisma } from './import/prisma.js';

/** The fence tags that open a dialect body. */
export const DIALECT_SOURCES = [MERMAID_SOURCE, 'dbml', 'prisma'] as const;
export type DialectSource = (typeof DIALECT_SOURCES)[number];

/** True when `tag` is a dialect fence tag. */
export function isDialectSource(tag: string | undefined): tag is DialectSource {
  return tag !== undefined && (DIALECT_SOURCES as readonly string[]).includes(tag);
}

/**
 * The block type a dialect body converts to, or `undefined` when the fence
 * should stay prose (a Mermaid grammar the subset does not cover). A DBML or
 * Prisma fence is always an `erd`.
 */
export function detectDialectKind(tag: DialectSource, raw: string): BlockType | undefined {
  if (tag === MERMAID_SOURCE) return detectMermaidKind(raw);
  return 'erd';
}

/** Converts a dialect body to block data. Never throws — a bad line comes back as `{ ok: false, message, line }`. */
export function convertDialect(source: DialectSource, kind: BlockType, raw: string): MermaidResult {
  if (source === MERMAID_SOURCE) return convertMermaid(kind, raw);
  if (kind !== 'erd') return { ok: false, message: `a ${source} fence converts to \`erd\`, not \`${kind}\`` };
  return source === 'dbml' ? convertDbml(raw) : convertPrisma(raw);
}

/**
 * The canonical YAML body for a dialect segment — what an editor writes back
 * under the canonical fence tag. `undefined` when the body does not convert.
 */
export function dialectBodyYaml(source: DialectSource, kind: BlockType, raw: string): string | undefined {
  const r = convertDialect(source, kind, raw);
  if (!r.ok) return undefined;
  return stringifyYaml(r.data, { lineWidth: 0 }).replace(/\n$/, '');
}

/** The diagnostic code for a body line the dialect cannot read. */
export const DIALECT_PARSE_CODE: Readonly<Record<DialectSource, DiagnosticCode>> = {
  mermaid: 'E_PARSE_MERMAID',
  dbml: 'E_PARSE_DBML',
  prisma: 'E_PARSE_PRISMA',
};

/** The one-line hint attached to that diagnostic. */
export const DIALECT_PARSE_HINT: Readonly<Record<DialectSource, string>> = {
  mermaid: 'The Mermaid subset is in reference/mermaid.md. Fix the line, or write the block as YAML.',
  dbml: 'The DBML subset is in reference/mermaid.md (Input dialects). Fix the line, or write the block as an erd in YAML.',
  prisma: 'The Prisma subset is in reference/mermaid.md (Input dialects). Fix the line, or write the block as an erd in YAML.',
};
