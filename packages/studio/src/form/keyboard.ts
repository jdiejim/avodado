/**
 * Keyboard-first authoring rules — the pure logic behind the sheet's Tab
 * order, the Enter-per-row rhythm in arrays, the filterable comboboxes, and
 * the contextual shortcut footer. DOM glue lives in the components; every
 * decision here is unit-testable.
 */

import type { FieldNode } from '@avodado/core';
import { partitionFields, type FieldSpec, type RefOption } from './fieldKind.js';

type ObjectNode = Extract<FieldNode, { kind: 'object' }>;

function asRecord(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function isScalar(node: FieldNode): boolean {
  return (
    node.kind === 'string' ||
    node.kind === 'number' ||
    node.kind === 'boolean' ||
    node.kind === 'enum' ||
    // Unions get one smart input (or a Simple/Detailed toggle) — they hold a
    // place in the keyboard order like any scalar.
    node.kind === 'union'
  );
}

/* ─── tab order ───────────────────────────────────────────────────────────── */

/**
 * The canonical keyboard order of a block form: top-level PRIMARY fields in
 * partition order; object arrays expand to each item's primary scalar paths.
 * Collapsed sections (More/Advanced — including `id`) never appear.
 */
export function tabOrderPaths(root: ObjectNode, value: unknown): string[] {
  const rec = asRecord(value);
  const out: string[] = [];
  for (const f of partitionFields(root.fields, value).primary) {
    if (f.node.kind === 'array' && f.node.element.kind === 'object') {
      const element = f.node.element;
      const items = Array.isArray(rec[f.name]) ? (rec[f.name] as unknown[]) : [];
      items.forEach((item, i) => {
        for (const p of partitionFields(element.fields, item).primary) {
          if (isScalar(p.node)) out.push(`${f.name}.${i}.${p.name}`);
        }
      });
    } else if (isScalar(f.node) || f.node.kind === 'array') {
      out.push(f.name);
    }
  }
  return out;
}

/** The top-level primary field AFTER `afterName` (form order), or null. */
export function nextPrimaryField(
  root: ObjectNode,
  value: unknown,
  afterName: string,
): FieldSpec | null {
  const primary = partitionFields(root.fields, value).primary;
  const i = primary.findIndex((f) => f.name === afterName);
  if (i < 0) return null;
  return primary[i + 1] ?? null;
}

/* ─── enter semantics in array rows ───────────────────────────────────────── */

/** What ⏎ does inside an array item row. */
export type RowEnterAction = 'advance' | 'append' | 'exit';

/**
 * The Enter-per-row rhythm:
 * - a pristine row (still the seed / entirely empty) → delete it and EXIT the
 *   array toward the next primary field;
 * - the last field of a filled row → APPEND a fresh seeded row;
 * - anywhere else → ADVANCE to the next field in the row.
 */
export function rowEnterAction(args: {
  readonly isLastField: boolean;
  readonly pristine: boolean;
}): RowEnterAction {
  if (args.pristine) return 'exit';
  return args.isLastField ? 'append' : 'advance';
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  return ka.every((k) =>
    deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
  );
}

function isEmptyLeaf(v: unknown): boolean {
  return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
}

/**
 * A row the user never touched: deep-equal to its seed (what `newItemForList`
 * generated), or with every field empty. Numbers and booleans count as
 * touched — only the seed-equality path treats them as pristine.
 */
export function isPristineRow(row: unknown, seed: unknown): boolean {
  if (deepEqual(row, seed)) return true;
  if (isEmptyLeaf(row)) return true;
  if (typeof row !== 'object' || row === null || Array.isArray(row)) return false;
  return Object.values(row as Record<string, unknown>).every(isEmptyLeaf);
}

/* ─── combobox filtering ──────────────────────────────────────────────────── */

/**
 * Filters dropdown options for a combobox draft. An empty query — or one that
 * still equals the committed value (the user just focused, nothing typed) —
 * shows everything; otherwise case-insensitive substring match on value OR
 * label.
 */
export function filterComboOptions(
  options: readonly RefOption[],
  query: string,
  committed: string,
): readonly RefOption[] {
  const q = query.trim().toLowerCase();
  if (q === '' || q === committed.trim().toLowerCase()) return options;
  return options.filter(
    (o) =>
      o.value.toLowerCase().includes(q) || (o.label?.toLowerCase().includes(q) ?? false),
  );
}

/* ─── contextual shortcut footer ──────────────────────────────────────────── */

/** Which surface currently owns the keyboard. */
export type ShortcutContext = 'canvas' | 'canvas-selected' | 'part' | 'sheet' | 'home' | 'present';

/** One footer hint: the key chord and what it does. */
export interface ShortcutHint {
  readonly keys: string;
  readonly label: string;
}

const SHORTCUTS: Readonly<Record<ShortcutContext, readonly ShortcutHint[]>> = {
  canvas: [
    { keys: '↑↓', label: 'select' },
    { keys: '/', label: 'insert' },
    { keys: '⌘S', label: 'save' },
    { keys: '?', label: 'shortcuts' },
  ],
  'canvas-selected': [
    { keys: '⏎', label: 'edit' },
    { keys: '/', label: 'insert' },
    { keys: '⌘D', label: 'duplicate' },
    { keys: '⌘↑↓', label: 'move' },
    { keys: '?', label: 'shortcuts' },
  ],
  part: [
    { keys: '⏎', label: 'edit' },
    { keys: '←↑↓→', label: 'move' },
    { keys: '⇥', label: 'next part' },
    { keys: '⌫', label: 'delete' },
    { keys: 'esc', label: 'back' },
  ],
  sheet: [
    { keys: '⇥', label: 'next field' },
    { keys: '⏎', label: 'next row' },
    { keys: '⌘⏎', label: 'done (in text: next)' },
    { keys: 'esc', label: 'cancel' },
  ],
  home: [
    { keys: 'click', label: 'open a doc' },
    { keys: '⇧⌘P', label: 'present' },
    { keys: '?', label: 'shortcuts' },
  ],
  present: [
    { keys: '← →', label: 'previous / next slide' },
    { keys: 'home end', label: 'first / last slide' },
    { keys: 'esc · ⇧⌘P', label: 'back to Edit' },
  ],
};

/**
 * The 4-6 hints the footer shows for a context. With a block selected whose
 * diagram has draggable parts, a "drag → move parts" hint slots in after Edit.
 * With a block whose render carries tagged parts at all, a "click a part →
 * select" hint slots in after Edit (the retired one-time canvas note, folded
 * into the keybar). With a diagram NODE selected on a connectable kind
 * (flow/dfd/state/c4/block), a "drag a dot → connect" hint slots in after Move.
 */
export function shortcutsFor(
  ctx: ShortcutContext,
  opts?: {
    readonly dragParts?: boolean;
    readonly connectDots?: boolean;
    readonly parts?: boolean;
  },
): readonly ShortcutHint[] {
  const base = SHORTCUTS[ctx];
  if (ctx === 'canvas-selected' && (opts?.dragParts === true || opts?.parts === true)) {
    const slotted: ShortcutHint[] = [];
    if (opts.dragParts === true) slotted.push({ keys: 'drag', label: 'move parts' });
    else if (opts.parts === true) slotted.push({ keys: 'click a part', label: 'select it' });
    return [base[0] as ShortcutHint, ...slotted, ...base.slice(1)];
  }
  if (ctx === 'part' && opts?.connectDots === true) {
    return [
      ...base.slice(0, 2),
      { keys: 'drag a dot', label: 'connect' },
      ...base.slice(2),
    ];
  }
  return base;
}
