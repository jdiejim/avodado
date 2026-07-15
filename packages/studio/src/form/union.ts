/**
 * Pure rules for `union` FieldNodes (schema alternatives like a table cell's
 * `string | number | { v, tone, … }`):
 *
 * - {@link unionObjectArm} finds the (single) object alternative — it drives
 *   the Simple ⇄ Detailed toggle in forms;
 * - {@link unionSimpleControl} picks the one smart control for the union's
 *   primitive arms (a type-preserving input for string|number mixes, a
 *   stepper for number-only, a merged dropdown for enum-only);
 * - {@link coerceUnionInput} turns typed text back into the value the arms
 *   allow (numeric-looking input stays a number when a number arm exists);
 * - {@link toDetailedValue} / {@link toSimpleValue} convert between the
 *   scalar and object representations when the user flips the toggle —
 *   the scalar lands in the object arm's primary text field, and
 *   simplifying reads it back (extra detail fields drop, by design).
 *
 * Kept free of React/DOM so every rule is unit-testable.
 */

import type { FieldNode } from '@avodado/core';
import type { ResolvedControl } from './fieldKind.js';

type ObjectNode = Extract<FieldNode, { kind: 'object' }>;
type UnionNode = Extract<FieldNode, { kind: 'union' }>;

/** Scalar arm kinds a single input can host. */
const PRIMITIVE_KINDS = new Set(['string', 'number', 'boolean', 'enum']);

/** The union's primitive arms (string/number/boolean/enum), in arm order. */
export function unionPrimitiveArms(node: UnionNode): readonly FieldNode[] {
  return node.arms.filter((a) => PRIMITIVE_KINDS.has(a.kind));
}

/**
 * The union's object alternative, or null. Only a SINGLE object arm supports
 * the Simple ⇄ Detailed toggle — with several object arms there is no one
 * "detailed form" to show, so callers fall back to opaque handling.
 */
export function unionObjectArm(node: UnionNode): ObjectNode | null {
  const objects = node.arms.filter((a): a is ObjectNode => a.kind === 'object');
  return objects.length === 1 ? (objects[0] ?? null) : null;
}

/** True when one of the union's arms has this scalar kind. */
export function unionAllows(node: UnionNode, kind: 'string' | 'number' | 'boolean'): boolean {
  return node.arms.some((a) => a.kind === kind);
}

/** Names that hold display text — the object arm's primary field candidates. */
const PRIMARYISH = ['v', 'value', 'text', 'label', 'name', 'title'];

/**
 * The object arm's PRIMARY field — where a scalar lands when the user flips
 * Simple → Detailed (`"42 ms"` → `{ v: "42 ms" }`), and what Simple reads
 * back. Preference: a known text-ish name (`v`, `value`, `text`, `label`,
 * `name`, `title`), then the first required string/union field, then the
 * first field.
 */
export function unionPrimaryField(arm: ObjectNode): string {
  for (const name of PRIMARYISH) {
    if (arm.fields.some((f) => f.name === name)) return name;
  }
  const required = arm.fields.find(
    (f) => !f.node.optional && (f.node.kind === 'string' || f.node.kind === 'union'),
  );
  return required?.name ?? arm.fields[0]?.name ?? 'value';
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Converts a union value to its DETAILED (object) form: scalars land in the
 * arm's primary field, objects pass through untouched, empty values become
 * an object with an empty primary.
 */
export function toDetailedValue(value: unknown, arm: ObjectNode): Record<string, unknown> {
  if (isRecord(value)) return value;
  const primary = unionPrimaryField(arm);
  return { [primary]: value === undefined || value === null ? '' : value };
}

/**
 * Converts a union value to its SIMPLE (scalar) form: an object yields its
 * primary field's value (detail fields drop — the user chose the simple
 * shape); scalars pass through; empties become ''.
 */
export function toSimpleValue(value: unknown, arm: ObjectNode): unknown {
  if (isRecord(value)) {
    const primary = value[unionPrimaryField(arm)];
    return primary === undefined || primary === null ? '' : primary;
  }
  return value === undefined || value === null ? '' : value;
}

/**
 * The one smart control for a union's primitive arms:
 *
 * - number-only → the stepper;
 * - boolean-only → the toggle;
 * - enum-only → one dropdown over the merged option vocabulary;
 * - anything with a string arm (or a mixed bag) → a plain type-preserving
 *   text input ({@link coerceUnionInput} keeps `42` a number when a number
 *   arm allows it);
 * - no primitive arms at all → opaque (raw YAML).
 */
export function unionSimpleControl(node: UnionNode): ResolvedControl {
  const prims = unionPrimitiveArms(node);
  if (prims.length === 0) return { kind: 'opaque' };
  const kinds = new Set(prims.map((a) => a.kind));
  if (kinds.size === 1 && kinds.has('number')) return { kind: 'number' };
  if (kinds.size === 1 && kinds.has('boolean')) return { kind: 'boolean' };
  if (kinds.size === 1 && kinds.has('enum')) {
    const options: string[] = [];
    for (const a of prims) {
      if (a.kind !== 'enum') continue;
      for (const o of a.options) if (!options.includes(o)) options.push(o);
    }
    return { kind: 'enum', options };
  }
  return { kind: 'text', multiline: false };
}

/**
 * Coerces a text input against a union's arms, preserving the natural type:
 * numeric-looking input stays a number when a number arm allows it,
 * `true`/`false` stay booleans when a boolean arm allows it, and everything
 * else is a string when a string arm exists. Returns `{ ok: false }` when no
 * arm accepts the input (e.g. `abc` into a pure `number | boolean` union).
 */
export function coerceUnionInput(
  input: string,
  node: UnionNode,
): { ok: boolean; value?: unknown } {
  if (unionAllows(node, 'number') && input.trim() !== '') {
    const n = Number(input);
    if (Number.isFinite(n)) return { ok: true, value: n };
  }
  if (unionAllows(node, 'boolean') && (input === 'true' || input === 'false')) {
    return { ok: true, value: input === 'true' };
  }
  if (unionAllows(node, 'string')) return { ok: true, value: input };
  // Enum arms accept their exact options as strings.
  for (const a of node.arms) {
    if (a.kind === 'enum' && a.options.includes(input)) return { ok: true, value: input };
  }
  return { ok: false };
}
