/**
 * Builds a sensible default value from a {@link FieldNode} — used when the
 * form adds an item to an array of objects (or fills a missing nested value).
 * Scalars get their zero value, enums their first option, containers recurse.
 */

import type { FieldNode } from '@avodado/core';

/** The default value for a single schema node. */
export function defaultValue(node: FieldNode): unknown {
  switch (node.kind) {
    case 'string':
      return '';
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'enum':
      return node.options[0] ?? '';
    case 'array':
      return [];
    case 'object':
      return defaultObject(node);
    case 'union': {
      // The first arm is the union's "natural" shape (schemas list the simple
      // form first: a table cell's string, a stats value's string).
      const first = node.arms[0];
      return first !== undefined ? defaultValue(first) : '';
    }
    case 'opaque':
      return null;
  }
}

/**
 * Default value for an object node: every REQUIRED field gets its default
 * (optional fields are omitted — an empty string can violate `min(1)` and
 * noise the YAML). If nothing is required, seed the first scalar field so the
 * new item is visible and editable rather than a bare `{}`.
 */
export function defaultObject(
  node: Extract<FieldNode, { kind: 'object' }>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of node.fields) {
    if (!f.node.optional) out[f.name] = defaultValue(f.node);
  }
  if (Object.keys(out).length === 0) {
    const first = node.fields.find(
      (f) => f.node.kind === 'string' || f.node.kind === 'number' || f.node.kind === 'enum',
    );
    if (first !== undefined) out[first.name] = defaultValue(first.node);
  }
  return out;
}
