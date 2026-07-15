/**
 * Pure helpers for direct on-diagram editing. Rendered blocks carry
 * `data-bp="<path>"` (one addressable YAML value/item) and `data-bl="<path>"`
 * (array container) attributes; this module maps those dot-joined paths back
 * to schema nodes ({@link resolveFieldAt}), data values ({@link valueAt}),
 * human labels ({@link humanizePath}), and typed values ({@link coerceValue}).
 *
 * Kept free of React/DOM so every rule is unit-testable.
 */

import type { FieldNode } from '@avodado/core';
import { coerceUnionInput } from '../form/union.js';
import { defaultObject, defaultValue } from '../lib/defaults.js';

/** One path segment: an object key or an array index. */
export type PathSeg = string | number;

/** `"messages.2.text"` → `['messages', 2, 'text']`. Numeric segments become indices. */
export function parseBlockPath(path: string): PathSeg[] {
  if (path === '') return [];
  return path.split('.').map((s) => (/^\d+$/.test(s) ? Number(s) : s));
}

/** `['messages', 2, 'text']` → `"messages.2.text"`. */
export function joinBlockPath(path: ReadonlyArray<PathSeg>): string {
  return path.join('.');
}

/** True when the path addresses an array ITEM (its last segment is an index). */
export function isItemPath(path: ReadonlyArray<PathSeg>): boolean {
  return typeof path[path.length - 1] === 'number';
}

/**
 * Singular form of a list field name for "+ Add …" affordances.
 * `boundaries` → `boundary`, `entities` → `entity`, `actors` → `actor`;
 * non-plurals pass through unchanged.
 */
export function singularize(name: string): string {
  if (/(series|species)$/i.test(name)) return name; // invariant plurals
  if (/ies$/.test(name)) return name.replace(/ies$/, 'y');
  if (/(ses|xes|zes|ches|shes)$/.test(name)) return name.replace(/es$/, '');
  if (/s$/.test(name) && !/ss$/.test(name)) return name.replace(/s$/, '');
  return name;
}

/** `soThat` → "So that", `xAxis` → "X axis", `pros_label` → "Pros label". */
export function humanizeFieldName(name: string): string {
  const spaced = name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .trim();
  return spaced === '' ? name : spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Walks a {@link FieldNode} tree down a parsed path. Array descent consumes a
 * numeric segment into the array's `element` node; object descent consumes a
 * string segment into the named field. Returns `null` when the path cannot be
 * followed (unknown field, index into a non-array, descent into a scalar).
 * Descending INTO an opaque node yields `null`; landing ON one returns it.
 */
export function resolveFieldAt(root: FieldNode, path: ReadonlyArray<PathSeg>): FieldNode | null {
  let cur: FieldNode = root;
  for (const seg of path) {
    if (cur.kind === 'array' && typeof seg === 'number') {
      cur = cur.element;
      continue;
    }
    if (cur.kind === 'object' && typeof seg === 'string') {
      const f = cur.fields.find((x) => x.name === seg);
      if (f === undefined) return null;
      cur = f.node;
      continue;
    }
    if (cur.kind === 'union' && typeof seg === 'string') {
      // Descending into a union means its DETAILED (object) shape: resolve
      // the field through the single object arm (a table cell's `tone`).
      const arm = cur.arms.find((a) => a.kind === 'object');
      const f = arm !== undefined && arm.kind === 'object'
        ? arm.fields.find((x) => x.name === seg)
        : undefined;
      if (f === undefined) return null;
      cur = f.node;
      continue;
    }
    return null;
  }
  return cur;
}

/** Reads the value at a parsed path inside plain block data (undefined if absent). */
export function valueAt(data: unknown, path: ReadonlyArray<PathSeg>): unknown {
  let cur: unknown = data;
  for (const seg of path) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<PathSeg, unknown>)[seg];
  }
  return cur;
}

/**
 * Human label for a path chip: `actors.0` → "Actor 1",
 * `messages.2.text` → "Message 3 · Text", `rows.1.2` → "Row 2 · Item 3",
 * `title` → "Title".
 */
export function humanizePath(path: ReadonlyArray<PathSeg>): string {
  const parts: string[] = [];
  for (let i = 0; i < path.length; i++) {
    const seg = path[i] as PathSeg;
    if (typeof seg === 'string') {
      const next = path[i + 1];
      if (typeof next === 'number') {
        parts.push(`${humanizeFieldName(singularize(seg))} ${next + 1}`);
        i += 1;
      } else {
        parts.push(humanizeFieldName(seg));
      }
    } else {
      // An index not preceded by a field name (nested arrays, e.g. table cells).
      parts.push(`Item ${seg + 1}`);
    }
  }
  return parts.join(' · ');
}

/** Default value for a new item of an array node (object → seeded object, scalar → zero value). */
export function defaultItemFor(element: FieldNode): unknown {
  return element.kind === 'object' ? defaultObject(element) : defaultValue(element);
}

/** Fields that hold display text — a fresh item names itself through them. */
const LABELISH = new Set(['label', 'title', 'name', 'text', 'summary', 'term', 'question']);

/**
 * Builds a VISIBLE new item for the "+ Add" affordances. A bare
 * `defaultObject` often renders nothing (a sequence message with empty
 * `from`/`to` resolves no actors and is skipped), so this seeds context:
 *
 * - `id` fields get a fresh unique id (`<singular>2`, `<singular>3`, …);
 * - label-ish fields get `New <singular>`;
 * - other required fields copy the LAST sibling's value (e.g. a new message
 *   reuses the previous message's `from`/`to` — a valid, visible arrow);
 * - scalar elements become `New <singular>`; array elements (table rows)
 *   mirror the last row's width with empty cells.
 */
export function newItemForList(
  element: FieldNode,
  siblings: readonly unknown[],
  singularName: string,
): unknown {
  if (element.kind === 'array') {
    const last = siblings[siblings.length - 1];
    return Array.isArray(last) && last.length > 0 ? last.map(() => '') : [''];
  }
  if (element.kind !== 'object') {
    return element.kind === 'string' ? `New ${singularName}` : defaultValue(element);
  }
  const out = defaultObject(element);
  const last = siblings[siblings.length - 1];
  const lastRec =
    last !== null && typeof last === 'object' && !Array.isArray(last)
      ? (last as Record<string, unknown>)
      : null;
  for (const key of Object.keys(out)) {
    if (key === 'id') {
      out[key] = uniqueId(singularName, siblings);
    } else if (LABELISH.has(key)) {
      out[key] = `New ${singularName}`;
    } else if (lastRec !== null && lastRec[key] !== undefined && typeof lastRec[key] !== 'object') {
      out[key] = lastRec[key];
    } else if (out[key] === null) {
      out[key] = ''; // opaque required (e.g. a union) — keep it renderable
    }
  }
  return out;
}

/** `<singular>N`, bumped past any sibling that already uses it. */
function uniqueId(singularName: string, siblings: readonly unknown[]): string {
  const used = new Set(
    siblings.map((s) =>
      s !== null && typeof s === 'object' ? String((s as { id?: unknown }).id ?? '') : '',
    ),
  );
  let n = siblings.length + 1;
  let id = `${singularName}${n}`;
  while (used.has(id)) {
    n += 1;
    id = `${singularName}${n}`;
  }
  return id;
}

/**
 * Coerces a text-input value back into the YAML type it replaces:
 * - schema says `number` → `Number(input)` when finite, else `null` (reject);
 * - schema says `boolean` → true/false for those literals, else `null`;
 * - schema says `union` → the natural type an arm allows (numeric-looking
 *   input stays a number when a number arm exists — table cells, stats
 *   values);
 * - otherwise the CURRENT value's type wins: numbers stay numbers when the
 *   input parses, booleans stay booleans for true/false literals;
 * - everything else stays a string.
 * Returns `{ ok: true, value }` or `{ ok: false }` (don't commit).
 */
export function coerceValue(
  input: string,
  current: unknown,
  node: FieldNode | null,
): { ok: boolean; value?: unknown } {
  if (node !== null && node.kind === 'union') return coerceUnionInput(input, node);
  const kind = node?.kind;
  if (kind === 'number') {
    const n = Number(input);
    return Number.isFinite(n) && input.trim() !== '' ? { ok: true, value: n } : { ok: false };
  }
  if (kind === 'boolean') {
    if (input === 'true') return { ok: true, value: true };
    if (input === 'false') return { ok: true, value: false };
    return { ok: false };
  }
  if (typeof current === 'number') {
    const n = Number(input);
    if (Number.isFinite(n) && input.trim() !== '') return { ok: true, value: n };
    return { ok: true, value: input };
  }
  if (typeof current === 'boolean') {
    if (input === 'true') return { ok: true, value: true };
    if (input === 'false') return { ok: true, value: false };
    return { ok: true, value: input };
  }
  return { ok: true, value: input };
}
