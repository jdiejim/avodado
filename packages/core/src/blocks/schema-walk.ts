/**
 * Shared zod schema-walking helpers: unwrap wrapper schemas and resolve the
 * schema node (or its field names) at an issue path. Used by `validate.ts` for
 * precise diagnostics and by `introspect.ts` to describe block schemas.
 *
 * Note: like the rest of the schema tooling, this couples to zod v3 internals
 * (`instanceof` checks + `._def.innerType`).
 */

import { z } from 'zod';
import { blockSchemas } from './schemas.js';
import type { BlockType } from '../types.js';

/**
 * Strips wrappers (optional / nullable / default / effects) to reach the inner
 * schema. `ZodEffects` (a `superRefine`d schema — e.g. `gallery`,
 * `statustable`) unwraps to its inner object: the refinement adds checks, not
 * structure, so field introspection and path walking stay accurate.
 */
export function unwrap(schema: z.ZodTypeAny): z.ZodTypeAny {
  let cur = schema;
  for (;;) {
    if (cur instanceof z.ZodOptional || cur instanceof z.ZodNullable) cur = cur.unwrap();
    else if (cur instanceof z.ZodDefault) cur = cur._def.innerType as z.ZodTypeAny;
    else if (cur instanceof z.ZodEffects) cur = cur.innerType() as z.ZodTypeAny;
    else return cur;
  }
}

/**
 * Resolves the schema node at a zod issue path, walking objects by key and
 * arrays by index. Returns `undefined` if the path leaves the known shape.
 */
export function schemaAt(
  kind: BlockType,
  path: ReadonlyArray<string | number>,
): z.ZodTypeAny | undefined {
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
 * True when the schema position at `path` is a bare `z.string()` — i.e. NOT a
 * union with number/boolean (table cells, stats.value, endpoint status, dfd
 * num), NOT an enum, and NOT outside the known shape. These are the only
 * positions where the normalize step may safely coerce a scalar
 * number/boolean to its string form: the author unambiguously meant a string,
 * YAML just typed their `16` as a number.
 */
export function stringOnlyAt(kind: BlockType, path: ReadonlyArray<string | number>): boolean {
  // `schemaAt` returns `undefined` when the path traverses a union or leaves
  // the shape, and returns the (unwrapped) union itself for union leaves — so
  // a plain instanceof check encodes "bare string position" exactly.
  return schemaAt(kind, path) instanceof z.ZodString;
}

/**
 * Field names valid at a given path. For `unrecognized_keys`, the issue path is
 * the *object that owns the bad key*, so this returns that object's fields —
 * giving accurate "did you mean?" suggestions even for nested records.
 */
export function fieldNamesAt(kind: BlockType, path: ReadonlyArray<string | number>): string[] {
  const schema = schemaAt(kind, path) ?? blockSchemas[kind];
  return schema instanceof z.ZodObject
    ? Object.keys(schema.shape as Record<string, unknown>)
    : [];
}
