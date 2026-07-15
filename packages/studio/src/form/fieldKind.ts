/**
 * Pure field-intelligence rules shared by the FormTab and the MicroEditor:
 *
 * - {@link resolveControl} picks the smartest control for a field from its
 *   name, schema node, current value, and sibling context (color swatches,
 *   node-kind dropdowns, relational id dropdowns, steppers, toggles);
 * - {@link partitionFields} orders an object's fields essential-first and
 *   pushes `id` + rarely-touched empties into collapsed sections;
 * - {@link microVisibleFields} picks the handful of controls a micro-editor
 *   popover shows for an object item.
 *
 * Kept free of React/DOM so every rule is unit-testable.
 */

import type { FieldNode } from '@avodado/core';
import { KNOWN_LOGIC_KINDS, KNOWN_NODE_KINDS } from '@avodado/render';
import type { PathSeg } from '../direct/paths.js';
import { unionSimpleControl } from './union.js';

/** One entry of a smart dropdown: the committed value + an optional display label. */
export interface RefOption {
  readonly value: string;
  readonly label?: string;
}

/** The control the editors should render for a field. */
export type ResolvedControl =
  | { readonly kind: 'text'; readonly multiline: boolean }
  | { readonly kind: 'number' }
  | { readonly kind: 'boolean' }
  | { readonly kind: 'enum'; readonly options: readonly string[] }
  /** The house accent enum — rendered as color swatches, committed as names. */
  | { readonly kind: 'accent'; readonly options: readonly string[] }
  /** A CSS color value — swatch row + picker + hex field. */
  | { readonly kind: 'color' }
  /** A dropdown over known values (node kinds, sibling ids) + custom escape. */
  | { readonly kind: 'options'; readonly options: readonly RefOption[] }
  | { readonly kind: 'opaque' };

/** Field names that always hold prose — rendered as textareas. */
const MULTILINE_NAMES = new Set(['text', 'desc', 'description', 'content', 'body', 'summary', 'lede']);

const ACCENT_OPTIONS = ['navy', 'blue', 'teal', 'green', 'amber', 'purple', 'red', 'gray'] as const;

/** Color fields by NAME (string nodes only). */
const COLOR_NAME_RE = /^(color|fill|stroke|accent)$/i;
/** Color fields by VALUE — anything already holding a hex color. */
const COLOR_VALUE_RE = /^#[0-9a-f]{3,8}$/i;

/**
 * Blocks whose free-string node `kind` uses the shared architecture palette.
 * Segment kinds are canonical — `infra`/`event`/`ddd`/`network` fences parse
 * to `block` (with a `preset`), so only the canonical names appear here.
 */
const NODE_KIND_BLOCKS = new Set(['block', 'cluster']);
/**
 * Blocks whose free-string node `kind` uses the design-pattern vocabulary
 * (`belogic` fences parse to `felogic` with `variant: be`).
 */
const LOGIC_KIND_BLOCKS = new Set(['felogic']);

/**
 * Relational fields and where their targets live:
 * - `'other-arrays'` — any id-bearing top-level array except the one the
 *   field's own item sits in (edges reference nodes, not other edges);
 * - `'own-array'` — the item's own array (a tree node's `parent`);
 * - an explicit list of sibling array names;
 * - `{ arrays, idField }` — explicit arrays whose items carry their id in a
 *   named field other than `id`/`name` (e.g. statustable's `statuses`, where
 *   a row's `status` commits a vocabulary entry's `label`).
 */
type RefHint =
  | 'other-arrays'
  | 'own-array'
  | readonly string[]
  | { readonly arrays: readonly string[]; readonly idField: string };
const REF_HINTS: Readonly<Record<string, RefHint>> = {
  from: 'other-arrays',
  to: 'other-arrays',
  source: 'other-arrays',
  target: 'other-arrays',
  parent: 'own-array',
  cluster: ['clusters'],
  status: { arrays: ['statuses'], idField: 'label' },
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/**
 * True for the house accent enum OR a superset of it (e.g. statustable's
 * status colors, which add semantic aliases like `success`/`error`) — any
 * enum whose vocabulary contains all 8 accents renders as swatches.
 */
function isAccentEnum(options: readonly string[]): boolean {
  return (
    options.length >= ACCENT_OPTIONS.length && ACCENT_OPTIONS.every((a) => options.includes(a))
  );
}

/** The name of the array holding the item this path descends through (or null). */
export function ownerArrayName(path: ReadonlyArray<PathSeg>): string | null {
  for (let i = path.length - 1; i >= 1; i--) {
    if (typeof path[i] === 'number' && typeof path[i - 1] === 'string') {
      return path[i - 1] as string;
    }
  }
  return null;
}

/**
 * Reads the id options out of one candidate array. Items may be plain strings
 * (the string IS the id) or objects with a string `id` (fallback: `name`, so
 * ERD entities qualify). A hint may name a different `idField` (e.g.
 * statustable's `statuses` commit their `label`). Items without an id are
 * skipped (a half-filled new row must not kill the dropdown); arrays whose
 * items aren't strings/objects (table rows) yield nothing.
 */
function idOptionsOf(arr: readonly unknown[], idField?: string): RefOption[] {
  const out: RefOption[] = [];
  for (const item of arr) {
    if (typeof item === 'string') {
      if (item !== '') out.push({ value: item });
      continue;
    }
    const rec = asRecord(item);
    if (rec === null) return []; // nested arrays etc. — not an id list
    if (idField !== undefined) {
      const v = rec[idField];
      if (typeof v === 'string' && v !== '') out.push({ value: v });
      continue;
    }
    const id =
      typeof rec['id'] === 'string' && rec['id'] !== ''
        ? rec['id']
        : typeof rec['name'] === 'string' && rec['name'] !== '' && rec['id'] === undefined
          ? rec['name']
          : null;
    if (id === null) continue;
    const label = [rec['name'], rec['label'], rec['title']].find(
      (v): v is string => typeof v === 'string' && v !== '' && v !== id,
    );
    out.push(label !== undefined ? { value: id, label } : { value: id });
  }
  return out;
}

/**
 * Resolves the dropdown options for a relational field (`from`, `to`, …) from
 * the block's own parsed data. Returns `null` when the name isn't relational
 * or no sibling ids exist — the caller falls back to free text.
 */
export function refOptionsFor(
  name: string,
  data: unknown,
  path: ReadonlyArray<PathSeg>,
): readonly RefOption[] | null {
  const hint = REF_HINTS[name];
  if (hint === undefined) return null;
  const rec = asRecord(data);
  if (rec === null) return null;
  const owner = ownerArrayName(path);
  let keys: readonly string[];
  let idField: string | undefined;
  if (hint === 'other-arrays') keys = Object.keys(rec).filter((k) => k !== owner);
  else if (hint === 'own-array') keys = owner !== null ? [owner] : [];
  else if ('arrays' in hint) {
    keys = hint.arrays;
    idField = hint.idField;
  } else keys = hint;
  const seen = new Set<string>();
  const out: RefOption[] = [];
  for (const key of keys) {
    const arr = rec[key];
    if (!Array.isArray(arr)) continue;
    for (const opt of idOptionsOf(arr, idField)) {
      if (!seen.has(opt.value)) {
        seen.add(opt.value);
        out.push(opt);
      }
    }
  }
  return out.length > 0 ? out : null;
}

/** The documented kind vocabulary for a block's free-string `kind` fields (or null). */
export function kindOptionsFor(blockKind: string): readonly string[] | null {
  if (NODE_KIND_BLOCKS.has(blockKind)) return KNOWN_NODE_KINDS;
  if (LOGIC_KIND_BLOCKS.has(blockKind)) return KNOWN_LOGIC_KINDS;
  return null;
}

/**
 * Picks the control for one field.
 *
 * Priority: schema scalars keep their native control (boolean toggle, number
 * stepper, enum select — accent enums as swatches); string fields upgrade to
 * a color control (by name or current hex value), a node-kind dropdown (field
 * named `kind` on a graph-family block), or a relational dropdown (`from` /
 * `to` / `source` / `target` / `parent` / `cluster` with id-bearing sibling
 * arrays, `status` against a sibling `statuses` vocabulary); everything else
 * is free text. Dropdowns always keep a custom-text escape (handled by the
 * control itself).
 *
 * @param args.name - Field name ('' when unnamed, e.g. a table cell).
 * @param args.node - Schema node, or null when unknown (opaque subtree).
 * @param args.value - Current value of the field.
 * @param args.data - The WHOLE block's parsed data (sibling context).
 * @param args.path - Path of this field within the block data.
 * @param args.blockKind - The block type (picks the kind vocabulary).
 */
export function resolveControl(args: {
  readonly blockKind: string;
  readonly name: string;
  readonly node: FieldNode | null;
  readonly value: unknown;
  readonly data: unknown;
  readonly path: ReadonlyArray<PathSeg>;
}): ResolvedControl {
  const { name, node, value } = args;
  const k = node?.kind;
  if (k === 'boolean') return { kind: 'boolean' };
  if (k === 'number') return { kind: 'number' };
  if (k === 'enum') {
    const options = node !== null && node.kind === 'enum' ? node.options : [];
    return isAccentEnum(options) ? { kind: 'accent', options } : { kind: 'enum', options };
  }
  if (k === 'array' || k === 'object') return { kind: 'opaque' };
  if (node !== null && node.kind === 'union') {
    // A DETAILED (object) value has no single input — the hosts render the
    // object arm's fields (FormTab's Simple/Detailed toggle, the micro-
    // editor's compact fieldset) instead of a control from here.
    if (value !== null && typeof value === 'object') return { kind: 'opaque' };
    const simple = unionSimpleControl(node);
    if (simple.kind === 'enum') {
      return isAccentEnum(simple.options)
        ? { kind: 'accent', options: simple.options }
        : simple;
    }
    if (simple.kind !== 'text') return simple;
    // String-bearing unions keep the smart string upgrades below (relational
    // dropdowns like statustable's `status`, color-by-value, …); the text
    // control stays type-preserving via coerceValue's union handling.
  }

  // string schema node, or no schema over a scalar value.
  if (typeof value !== 'string' && value !== undefined && value !== null && k === undefined) {
    // Opaque node over a number/boolean — keep the plain coercing text input.
    return { kind: 'text', multiline: false };
  }
  if (COLOR_NAME_RE.test(name) || (typeof value === 'string' && COLOR_VALUE_RE.test(value))) {
    return { kind: 'color' };
  }
  if (name === 'kind') {
    const kinds = kindOptionsFor(args.blockKind);
    if (kinds !== null) return { kind: 'options', options: kinds.map((v) => ({ value: v })) };
  }
  const refs = refOptionsFor(name, args.data, args.path);
  if (refs !== null) return { kind: 'options', options: refs };
  const multiline =
    MULTILINE_NAMES.has(name) ||
    (typeof value === 'string' && (value.length > 60 || value.includes('\n')));
  return { kind: 'text', multiline };
}

/* ─── essential-first partition ───────────────────────────────────────────── */

/** One named field of an object node. */
export interface FieldSpec {
  readonly name: string;
  readonly node: FieldNode;
}

/** The three sections of a form: visible, collapsed extras, collapsed plumbing. */
export interface FieldPartition {
  readonly primary: readonly FieldSpec[];
  readonly more: readonly FieldSpec[];
  readonly advanced: readonly FieldSpec[];
}

/** Text-ish names that identify a thing — shown even when empty (max 3). */
const SIGNATURE_NAMES = [
  'title',
  'label',
  'name',
  'text',
  'value',
  'summary',
  'desc',
  'description',
  'question',
  'term',
  'caption',
  'subtitle',
];

/** Plumbing fields that hide in "Advanced" while empty (layout tuning etc.). */
const ADVANCED_WHEN_EMPTY_RE = /^(col|row|w|x|y|layer|span|family|external|figure)$/;

function isEmptyValue(v: unknown): boolean {
  return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
}

/**
 * Partitions an object's fields essential-first:
 *
 * - `primary` — required fields, optional fields that HAVE a value, arrays
 *   (they're the block's content, and collapse to a single add button when
 *   empty), and up to 3 empty "signature" fields (title/label/name-ish);
 * - `advanced` — `id` (always: it's auto-generated, never a first-run
 *   concern) and empty layout plumbing (`col`, `row`, `w`, `layer`, …);
 * - `more` — every other empty optional field.
 *
 * Order within each section follows the schema's field order.
 */
export function partitionFields(
  fields: ReadonlyArray<FieldSpec>,
  value: unknown,
): FieldPartition {
  const rec = asRecord(value) ?? {};
  const signature = new Set<string>();
  for (const sig of SIGNATURE_NAMES) {
    if (signature.size >= 3) break;
    const f = fields.find((x) => x.name === sig);
    if (f === undefined || !f.node.optional || !isEmptyValue(rec[f.name])) continue;
    if (f.node.kind !== 'string' && f.node.kind !== 'enum' && f.node.kind !== 'union') continue;
    signature.add(f.name);
  }

  const primary: FieldSpec[] = [];
  const more: FieldSpec[] = [];
  const advanced: FieldSpec[] = [];
  for (const f of fields) {
    if (f.name === 'id') {
      advanced.push(f);
      continue;
    }
    const empty = isEmptyValue(rec[f.name]);
    if (!f.node.optional || !empty || f.node.kind === 'array' || signature.has(f.name)) {
      primary.push(f);
      continue;
    }
    if (ADVANCED_WHEN_EMPTY_RE.test(f.name)) {
      advanced.push(f);
      continue;
    }
    more.push(f);
  }
  return { primary, more, advanced };
}

/**
 * Scalar-ish nodes a micro-editor can host inline. Unions count while their
 * CURRENT value is scalar (a detailed table cell defers to the full editor).
 */
function isMicroScalar(node: FieldNode, value?: unknown): boolean {
  if (node.kind === 'union') return value === null || typeof value !== 'object';
  return (
    node.kind === 'string' ||
    node.kind === 'number' ||
    node.kind === 'boolean' ||
    node.kind === 'enum'
  );
}

/**
 * Picks the fields a micro-editor popover shows for an object item: the first
 * `cap` scalar fields of the primary partition. `hidden` counts everything
 * else (deferred to the full editor).
 *
 * @param ensure - A field name that MUST be visible when it exists and is
 *   scalar (a caller wants it focused — e.g. `summary` from the step-
 *   descriptions chip); appended even past the cap.
 */
export function microVisibleFields(
  fields: ReadonlyArray<FieldSpec>,
  value: unknown,
  cap = 4,
  ensure?: string,
): { readonly visible: readonly FieldSpec[]; readonly hidden: number } {
  const rec = asRecord(value) ?? {};
  const { primary } = partitionFields(fields, value);
  let visible = primary.filter((f) => isMicroScalar(f.node, rec[f.name])).slice(0, cap);
  if (ensure !== undefined && !visible.some((f) => f.name === ensure)) {
    const extra = fields.find((f) => f.name === ensure && isMicroScalar(f.node, rec[f.name]));
    if (extra !== undefined) visible = [...visible, extra];
  }
  return { visible, hidden: fields.length - visible.length };
}
