/**
 * Schema-driven form editing for a typed block: walks
 * `describeBlockSchema(kind)` against the block's parsed data and commits
 * each field via the sheet's draft (`setYamlPath`, format-preserving).
 * Text fields also stage keystrokes so the sheet's live preview can follow.
 *
 * Fields render essential-first (`partitionFields`): required + valued +
 * signature fields up top, everything else in collapsed "More fields" /
 * "Advanced" sections — `id` never appears in the primary form. Controls are
 * the shared smart set (`SmartControl`): color swatches, kind and relational
 * dropdowns, steppers, toggles.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { describeBlockSchema, type Diagnostic, type FieldNode, type TypedSegment } from '@avodado/core';
import { humanizeFieldName, newItemForList, singularize } from '../direct/paths.js';
import { SmartControl } from '../form/controls.js';
import { partitionFields, resolveControl, type FieldSpec } from '../form/fieldKind.js';
import { GridField } from '../form/GridField.js';
import { isPristineRow, nextPrimaryField, rowEnterAction, tabOrderPaths } from '../form/keyboard.js';
import { toDetailedValue, toSimpleValue, unionObjectArm } from '../form/union.js';
import { focusControl, focusablesIn } from '../lib/focus.js';

export { humanizeFieldName };

/** A path into a YAML body. */
export type YamlPath = ReadonlyArray<string | number>;

/** A preview→form reveal request (nonce so repeat clicks re-trigger). */
export interface RevealRequest {
  readonly path: string;
  readonly n: number;
}

export interface Ctx {
  /** The block type — picks kind vocabularies for smart dropdowns. */
  blockKind: string;
  /** The WHOLE block's parsed data — sibling context for relational dropdowns. */
  rootData: unknown;
  /** The block's ROOT schema node (sibling lookups, e.g. the grid's columns). */
  rootNode: FieldNode;
  /** True right after an insert — arrays open their first item, ready to type. */
  fresh: boolean;
  commitPath: (path: YamlPath, value: unknown) => void;
  deletePath: (path: YamlPath) => void;
  /** Keystroke-level updates (debounced by the sheet into the live preview). */
  stagePath: (path: YamlPath, value: unknown) => void;
  openYaml: () => void;
  /** Preview-click linkage: auto-expand the array item containing this path. */
  reveal?: RevealRequest | null | undefined;
  /** Internal focus routing: expand + focus the field/item at this path. */
  focusReq: RevealRequest | null;
  requestFocus: (path: string) => void;
  /** ⏎ on a pristine row: leave the array at `arrayPath` toward the next primary field. */
  exitArray: (arrayPath: YamlPath) => void;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/* ---------- arrays ---------- */

function PrimitiveArrayField({ path, value, element, ctx }: {
  path: YamlPath;
  value: unknown;
  element: FieldNode;
  ctx: Ctx;
}): JSX.Element {
  const items = asArray(value);
  const [draft, setDraft] = useState('');

  const add = (): void => {
    const t = draft.trim();
    if (t === '') return;
    const numeric =
      Number.isFinite(Number(t)) &&
      (element.kind === 'number' ||
        (element.kind === 'union' && element.arms.some((a) => a.kind === 'number')));
    ctx.commitPath(path, [...items, numeric ? Number(t) : t]);
    setDraft('');
  };

  /** Chip label — object items (a union's detailed arm) show their primary text. */
  const chipLabel = (it: unknown): string => {
    if (it !== null && typeof it === 'object' && element.kind === 'union') {
      const arm = unionObjectArm(element);
      if (arm !== null) return String(toSimpleValue(it, arm));
    }
    return String(it);
  };

  return (
    <div className="stu-chips">
      {items.map((it, i) => (
        <span key={i} className="stu-chip-item">
          {chipLabel(it)}
          <button
            type="button"
            aria-label={`Remove ${chipLabel(it)}`}
            onClick={() => ctx.commitPath(path, items.filter((_, j) => j !== i))}
          >
            ×
          </button>
        </span>
      ))}
      {element.kind === 'enum' ? (
        <select
          className="stu-input stu-input-select stu-chips-add"
          value=""
          onChange={(e) => {
            if (e.target.value !== '') ctx.commitPath(path, [...items, e.target.value]);
          }}
        >
          <option value="">+ add…</option>
          {element.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          className="stu-input stu-chips-add"
          type="text"
          placeholder="+ add…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={add}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
      )}
    </div>
  );
}

/** Fields that hold display text — preferred for an item's summary line. */
const LABELISH = ['name', 'label', 'title', 'text', 'summary', 'term', 'question', 'value'];

/** Summary line for a collapsed array item: its best label-ish string field. */
function itemSummary(item: unknown, element: FieldNode, index: number): string {
  if (element.kind === 'object') {
    const rec = asRecord(item);
    for (const name of LABELISH) {
      const v = rec[name];
      if (typeof v === 'string' && v !== '') return v;
    }
    for (const f of element.fields) {
      const v = rec[f.name];
      if (typeof v === 'string' && v !== '') return v;
    }
  }
  if (typeof item === 'string' && item !== '') return item;
  return `Item ${index + 1}`;
}

function ObjectArrayField({ name, path, value, element, ctx }: {
  name: string;
  path: YamlPath;
  value: unknown;
  element: Extract<FieldNode, { kind: 'object' }>;
  ctx: Ctx;
}): JSX.Element {
  const items = asArray(value);
  // Fresh (just-inserted) blocks open their first row, ready to type into.
  const [open, setOpen] = useState<number | null>(() =>
    ctx.fresh && asArray(value).length > 0 ? 0 : null,
  );
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // A preview click on `messages.2.…` auto-expands item 2 of `messages`;
  // internal focus requests (`focusReq`) expand the same way — a request for
  // the ARRAY itself lands on item 0.
  const reveal = ctx.reveal;
  const joined = path.join('.');
  useEffect(() => {
    if (reveal === null || reveal === undefined) return;
    if (reveal.path !== joined && !reveal.path.startsWith(`${joined}.`)) return;
    const rest = reveal.path.slice(joined.length + 1);
    const idx = Number(rest.split('.')[0]);
    if (Number.isInteger(idx) && idx >= 0) setOpen(idx);
  }, [reveal, joined]);
  const focusReq = ctx.focusReq;
  useEffect(() => {
    if (focusReq === null) return;
    if (focusReq.path === joined) {
      if (itemsRef.current.length > 0) setOpen(0);
      return;
    }
    if (!focusReq.path.startsWith(`${joined}.`)) return;
    const idx = Number(focusReq.path.slice(joined.length + 1).split('.')[0]);
    if (Number.isInteger(idx) && idx >= 0) setOpen(idx);
  }, [focusReq, joined]);

  const commitAll = (next: unknown[]): void => ctx.commitPath(path, next);

  /**
   * The Enter-per-row rhythm. Runs on a microtask so the field's own Enter
   * handler commits its draft (and the form re-renders) first.
   */
  const onRowKey = (e: React.KeyboardEvent, i: number): void => {
    if (e.key !== 'Enter') return;
    const target = e.target as HTMLElement;
    const mod = e.metaKey || e.ctrlKey;
    if (target.tagName === 'TEXTAREA' && !mod) return; // ⏎ stays a newline
    const container = e.currentTarget as HTMLElement;
    window.setTimeout(() => {
      const fields = focusablesIn(container);
      const idx = fields.indexOf(document.activeElement as HTMLElement);
      const row = itemsRef.current[i];
      const seed = newItemForList(element, itemsRef.current.slice(0, i), singularize(name));
      const action = rowEnterAction({
        isLastField: idx < 0 || idx === fields.length - 1,
        pristine: isPristineRow(row, seed),
      });
      if (action === 'advance') {
        const next = fields[idx + 1];
        if (next !== undefined) focusControl(next);
        return;
      }
      if (action === 'append') {
        const all = itemsRef.current;
        if (i < all.length - 1) {
          // Not the last row — "next row" means the one that already exists.
          setOpen(i + 1);
          ctx.requestFocus(`${joined}.${i + 1}`);
          return;
        }
        ctx.commitPath([...path, all.length], newItemForList(element, all, singularize(name)));
        setOpen(all.length);
        ctx.requestFocus(`${joined}.${all.length}`);
        return;
      }
      // exit — drop the untouched row, close the array, move past it.
      ctx.deletePath([...path, i]);
      setOpen(null);
      ctx.exitArray(path);
    }, 0);
  };

  return (
    <div className="stu-items">
      {items.map((item, i) => (
        <div
          key={i}
          className={`stu-item ${open === i ? 'stu-item-open' : ''}`}
          data-field-path={`${joined}.${i}`}
        >
          <div className="stu-item-row">
            <button
              type="button"
              className="stu-item-summary"
              tabIndex={-1}
              onClick={() => setOpen(open === i ? null : i)}
            >
              <span className={`stu-item-caret ${open === i ? 'stu-item-caret-open' : ''}`} aria-hidden="true">
                ▸
              </span>
              <span className="stu-item-title">{itemSummary(item, element, i)}</span>
            </button>
            <div className="stu-item-tools">
              <button
                type="button"
                aria-label="Move up"
                tabIndex={-1}
                disabled={i === 0}
                onClick={() => {
                  const next = items.slice();
                  const [moved] = next.splice(i, 1);
                  next.splice(i - 1, 0, moved);
                  commitAll(next);
                }}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label="Move down"
                tabIndex={-1}
                disabled={i === items.length - 1}
                onClick={() => {
                  const next = items.slice();
                  const [moved] = next.splice(i, 1);
                  next.splice(i + 1, 0, moved);
                  commitAll(next);
                }}
              >
                ↓
              </button>
              <button
                type="button"
                aria-label="Remove"
                className="stu-item-remove"
                tabIndex={-1}
                onClick={() => ctx.deletePath([...path, i])}
              >
                ×
              </button>
            </div>
          </div>
          {open === i && (
            <div className="stu-item-fields" onKeyDown={(e) => onRowKey(e, i)}>
              <PartitionedFields node={element} path={[...path, i]} value={item} ctx={ctx} />
            </div>
          )}
        </div>
      ))}
      <button
        type="button"
        className="stu-addbtn"
        onClick={() => {
          // newItemForList seeds ids, labels, and copies the last sibling's
          // relational fields — the new item is visible and needs no id typing.
          commitAll([...items, newItemForList(element, items, singularize(name))]);
          setOpen(items.length);
          ctx.requestFocus(`${joined}.${items.length}`);
        }}
      >
        + Add {singularize(name)}
      </button>
    </div>
  );
}

/* ---------- unions (Simple ⇄ Detailed) ---------- */

/**
 * A union field with an object alternative: a Simple | Detailed segmented
 * toggle. Simple is the one smart input over the primitive arms; Detailed is
 * the object arm's fieldset. Flipping CONVERTS the value (scalar ⇄ object via
 * the arm's primary field) — the mode is derived from the value's shape, so
 * external edits stay in sync.
 */
function UnionField({ name, node, path, value, ctx }: {
  name: string;
  node: Extract<FieldNode, { kind: 'union' }>;
  path: YamlPath;
  value: unknown;
  ctx: Ctx;
}): JSX.Element {
  const arm = unionObjectArm(node);
  const detailed =
    arm !== null && value !== null && typeof value === 'object' && !Array.isArray(value);

  const control = detailed ? null : (
    <SmartControl
      resolved={resolveControl({
        blockKind: ctx.blockKind,
        name,
        node,
        value,
        data: ctx.rootData,
        path,
      })}
      node={node}
      value={value}
      optional={node.optional}
      handlers={{
        onCommit: (v) => ctx.commitPath(path, v),
        onDelete: () => ctx.deletePath(path),
        onStage: (v) => ctx.stagePath(path, v),
      }}
    />
  );
  if (arm === null) return control ?? <OpaqueNote ctx={ctx} />;

  return (
    <div className="stu-union">
      <div className="stu-union-toggle" role="group" aria-label={`${humanizeFieldName(name)} shape`}>
        <button
          type="button"
          className={`stu-union-seg ${detailed ? '' : 'stu-union-seg-active'}`}
          aria-pressed={!detailed}
          tabIndex={-1}
          onClick={() => {
            if (detailed) ctx.commitPath(path, toSimpleValue(value, arm));
          }}
        >
          Simple
        </button>
        <button
          type="button"
          className={`stu-union-seg ${detailed ? 'stu-union-seg-active' : ''}`}
          aria-pressed={detailed}
          tabIndex={-1}
          onClick={() => {
            if (!detailed) ctx.commitPath(path, toDetailedValue(value, arm));
          }}
        >
          Detailed
        </button>
      </div>
      {detailed ? (
        <div className="stu-union-fields">
          <ObjectFields node={arm} path={path} value={value} ctx={ctx} />
        </div>
      ) : (
        control
      )}
    </div>
  );
}

/**
 * An array of union items with a detailed (object) alternative — e.g. archmap
 * area tiles (`string | { name, status }`). Each item is one row hosting the
 * union's Simple | Detailed control; rows add/remove like any list.
 */
function UnionArrayField({ name, path, value, element, ctx }: {
  name: string;
  path: YamlPath;
  value: unknown;
  element: Extract<FieldNode, { kind: 'union' }>;
  ctx: Ctx;
}): JSX.Element {
  const items = asArray(value);
  return (
    <div className="stu-items stu-union-items">
      {items.map((item, i) => (
        <div key={i} className="stu-union-item" data-field-path={`${path.join('.')}.${i}`}>
          <UnionField name={singularize(name)} node={element} path={[...path, i]} value={item} ctx={ctx} />
          <button
            type="button"
            aria-label={`Remove ${singularize(name)} ${i + 1}`}
            className="stu-union-item-remove"
            tabIndex={-1}
            onClick={() => ctx.deletePath([...path, i])}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="stu-addbtn"
        onClick={() => ctx.commitPath([...path, items.length], '')}
      >
        + Add {singularize(name)}
      </button>
    </div>
  );
}

/* ---------- objects & dispatch ---------- */

function ObjectFields({ node, path, value, ctx, fieldDiags }: {
  node: Extract<FieldNode, { kind: 'object' }>;
  path: YamlPath;
  value: unknown;
  ctx: Ctx;
  fieldDiags?: ReadonlyMap<string, readonly Diagnostic[]> | undefined;
}): JSX.Element {
  const rec = asRecord(value);
  return (
    <>
      {node.fields.map((f) => (
        <FieldRow
          key={f.name}
          name={f.name}
          node={f.node}
          path={[...path, f.name]}
          value={rec[f.name]}
          ctx={ctx}
          diags={fieldDiags?.get(f.name)}
        />
      ))}
    </>
  );
}

/** A collapsible section of secondary fields ("More fields", "Advanced"). */
function CollapsedSection({ label, count, defaultOpen, openSignal, children }: {
  label: string;
  count: number;
  defaultOpen: boolean;
  /** Bump (a reveal nonce) forces the section open. */
  openSignal: number;
  children: React.ReactNode;
}): JSX.Element {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    if (openSignal > 0) setOpen(true);
  }, [openSignal]);
  return (
    <div className={`stu-collapse ${open ? 'stu-collapse-open' : ''}`}>
      <button type="button" className="stu-collapse-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className={`stu-item-caret ${open ? 'stu-item-caret-open' : ''}`} aria-hidden="true">
          ▸
        </span>
        {label}
        <span className="stu-collapse-count">{count}</span>
      </button>
      {open && <div className="stu-collapse-body">{children}</div>}
    </div>
  );
}

/**
 * An object's fields, essential-first: primary rows, then collapsed
 * "More fields (N)" and "Advanced (N)" (ids, empty layout plumbing).
 */
function PartitionedFields({ node, path, value, ctx, fieldDiags }: {
  node: Extract<FieldNode, { kind: 'object' }>;
  path: YamlPath;
  value: unknown;
  ctx: Ctx;
  fieldDiags?: ReadonlyMap<string, readonly Diagnostic[]> | undefined;
}): JSX.Element {
  const rec = asRecord(value);
  const { primary, more, advanced } = useMemo(
    () => partitionFields(node.fields, value),
    [node, value],
  );

  // A reveal targeting a collapsed field forces its section open.
  const reveal = ctx.reveal;
  const joined = path.join('.');
  let revealName: string | null = null;
  if (reveal !== null && reveal !== undefined) {
    if (joined === '') revealName = reveal.path.split('.')[0] ?? null;
    else if (reveal.path.startsWith(`${joined}.`)) {
      revealName = reveal.path.slice(joined.length + 1).split('.')[0] ?? null;
    }
  }
  const signalFor = (fields: readonly FieldSpec[]): number =>
    revealName !== null && fields.some((f) => f.name === revealName) ? (reveal?.n ?? 0) : 0;
  const hasDiags = (fields: readonly FieldSpec[]): boolean =>
    fields.some((f) => (fieldDiags?.get(f.name)?.length ?? 0) > 0);

  // A top-level `columns` array whose sibling is a rows-of-cells grid is
  // edited IN the grid's header — the standalone field row would duplicate it.
  const gridOwnsColumns =
    path.length === 0 &&
    node.fields.some(
      (f) => f.node.kind === 'array' && f.node.element.kind === 'array',
    ) &&
    node.fields.some((f) => f.name === 'columns' && f.node.kind === 'array');

  const row = (f: FieldSpec): JSX.Element | null =>
    gridOwnsColumns && f.name === 'columns' && path.length === 0 ? null : (
      <FieldRow
        key={f.name}
        name={f.name}
        node={f.node}
        path={[...path, f.name]}
        value={rec[f.name]}
        ctx={ctx}
        diags={fieldDiags?.get(f.name)}
      />
    );

  return (
    <>
      {primary.map(row)}
      {more.length > 0 && (
        <CollapsedSection
          label="More fields"
          count={more.length}
          defaultOpen={hasDiags(more)}
          openSignal={signalFor(more)}
        >
          {more.map(row)}
        </CollapsedSection>
      )}
      {advanced.length > 0 && (
        <CollapsedSection
          label="Advanced"
          count={advanced.length}
          defaultOpen={hasDiags(advanced)}
          openSignal={signalFor(advanced)}
        >
          {advanced.map(row)}
        </CollapsedSection>
      )}
    </>
  );
}

function FieldDiags({ diags }: { diags: readonly Diagnostic[] | undefined }): JSX.Element | null {
  if (diags === undefined || diags.length === 0) return null;
  return (
    <div className="stu-field-diags">
      {diags.map((d, i) => (
        <div key={i} className={`stu-field-diag stu-field-diag-${d.level}`}>
          {d.message}
        </div>
      ))}
    </div>
  );
}

function FieldRow({ name, node, path, value, ctx, diags }: {
  name: string;
  node: FieldNode;
  path: YamlPath;
  value: unknown;
  ctx: Ctx;
  diags?: readonly Diagnostic[] | undefined;
}): JSX.Element {
  const label = (
    <label className="stu-field-label">
      {humanizeFieldName(name)}
      {node.optional && <span className="stu-optional">optional</span>}
    </label>
  );

  let control: JSX.Element | null;
  switch (node.kind) {
    case 'string':
    case 'number':
    case 'boolean':
    case 'enum': {
      const resolved = resolveControl({
        blockKind: ctx.blockKind,
        name,
        node,
        value,
        data: ctx.rootData,
        path,
      });
      control = (
        <SmartControl
          resolved={resolved}
          node={node}
          value={value}
          optional={node.optional}
          handlers={{
            onCommit: (v) => ctx.commitPath(path, v),
            onDelete: () => ctx.deletePath(path),
            onStage: (v) => ctx.stagePath(path, v),
          }}
        />
      );
      break;
    }
    case 'union':
      control = <UnionField name={name} node={node} path={path} value={value} ctx={ctx} />;
      break;
    case 'array':
      if (node.element.kind === 'object') {
        return (
          <div className="stu-field stu-field-block" data-field-path={path.join('.')}>
            {label}
            <ObjectArrayField name={name} path={path} value={value} element={node.element} ctx={ctx} />
            <FieldDiags diags={diags} />
          </div>
        );
      }
      if (node.element.kind === 'array') {
        // Rows-of-cells (table.rows): the dedicated grid editor.
        return (
          <div className="stu-field stu-field-block" data-field-path={path.join('.')}>
            {label}
            <GridField path={path} value={value} element={node.element} ctx={ctx} />
            <FieldDiags diags={diags} />
          </div>
        );
      }
      if (node.element.kind === 'opaque') {
        control = <OpaqueNote ctx={ctx} />;
      } else if (node.element.kind === 'union' && unionObjectArm(node.element) !== null) {
        control = (
          <UnionArrayField name={name} path={path} value={value} element={node.element} ctx={ctx} />
        );
      } else {
        control = <PrimitiveArrayField path={path} value={value} element={node.element} ctx={ctx} />;
      }
      break;
    case 'object':
      return (
        <fieldset className="stu-fieldset" data-field-path={path.join('.')}>
          <legend>
            {humanizeFieldName(name)}
            {node.optional && <span className="stu-optional">optional</span>}
          </legend>
          <ObjectFields node={node} path={path} value={value} ctx={ctx} />
          <FieldDiags diags={diags} />
        </fieldset>
      );
    case 'opaque':
      control = <OpaqueNote ctx={ctx} />;
      break;
  }
  return (
    <div className="stu-field" data-field-path={path.join('.')}>
      {label}
      {control}
      <FieldDiags diags={diags} />
    </div>
  );
}

function OpaqueNote({ ctx }: { ctx: Ctx }): JSX.Element {
  return (
    <div className="stu-opaque">
      This field holds free-form content —{' '}
      <button type="button" className="stu-linkbtn" onClick={ctx.openYaml}>
        open the YAML tab
      </button>{' '}
      to edit it.
    </div>
  );
}

export function FormTab({ seg, fresh = false, commitPath, deletePath, stagePath, openYaml, fieldDiags, reveal }: {
  seg: TypedSegment;
  /** True when the sheet opened right after inserting this block. */
  fresh?: boolean;
  commitPath: Ctx['commitPath'];
  deletePath: Ctx['deletePath'];
  stagePath: Ctx['stagePath'];
  openYaml: Ctx['openYaml'];
  fieldDiags?: ReadonlyMap<string, readonly Diagnostic[]> | undefined;
  reveal?: RevealRequest | null | undefined;
}): JSX.Element {
  const root = describeBlockSchema(seg.kind);
  const rootRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef(seg.data);
  dataRef.current = seg.data;
  const [focusReq, setFocusReq] = useState<RevealRequest | null>(null);
  const focusSeq = useRef(0);
  const requestFocus = (path: string): void => setFocusReq({ path, n: ++focusSeq.current });

  const ctx: Ctx = {
    blockKind: seg.kind,
    rootData: seg.data,
    rootNode: root,
    fresh,
    commitPath,
    deletePath,
    stagePath,
    openYaml,
    reveal,
    focusReq,
    requestFocus,
    exitArray: (arrayPath) => {
      // Only top-level arrays route onward; nested rows just close.
      if (arrayPath.length !== 1 || typeof arrayPath[0] !== 'string' || root.kind !== 'object') {
        return;
      }
      const next = nextPrimaryField(root, dataRef.current, arrayPath[0]);
      if (next === null) return;
      if (next.node.kind === 'array' && next.node.element.kind === 'object') {
        const items = asArray(asRecord(dataRef.current)[next.name]);
        // Items → land in the first row; empty → land on its "+ Add" button
        // (never seed silently — Done must not commit junk rows).
        requestFocus(items.length > 0 ? `${next.name}.0` : next.name);
      } else {
        requestFocus(next.name);
      }
    },
  };

  // Land ready to type: focus the first field of the keyboard order on mount.
  // Fresh blocks whose FIRST primary field is an empty array get one seeded
  // row so there is something to type into.
  useEffect(() => {
    if (root.kind !== 'object') return;
    const first = partitionFields(root.fields, dataRef.current).primary[0];
    if (
      fresh &&
      first !== undefined &&
      first.node.kind === 'array' &&
      first.node.element.kind === 'object' &&
      asArray(asRecord(dataRef.current)[first.name]).length === 0
    ) {
      commitPath([first.name, 0], newItemForList(first.node.element, [], singularize(first.name)));
      requestFocus(`${first.name}.0`);
      return;
    }
    const paths = tabOrderPaths(root, dataRef.current);
    if (paths[0] !== undefined) requestFocus(paths[0]);
  }, []);

  // Consume focus requests once the expansion (if any) has rendered. An array
  // with no rows lands on its "+ Add" button instead of a field.
  useEffect(() => {
    if (focusReq === null) return;
    const t = setTimeout(() => {
      const pane = rootRef.current;
      if (pane === null) return;
      const el = pane.querySelector(`[data-field-path="${CSS.escape(focusReq.path)}"]`);
      if (el === null) return;
      const target = focusablesIn(el)[0] ?? el.querySelector<HTMLElement>('.stu-addbtn');
      if (target !== null && target !== undefined) focusControl(target);
    }, 60);
    return () => clearTimeout(t);
  }, [focusReq]);

  if (root.kind !== 'object') {
    return (
      <div className="stu-opaque stu-opaque-block">
        This block&apos;s schema has no structural form description —{' '}
        <button type="button" className="stu-linkbtn" onClick={openYaml}>
          edit it as YAML
        </button>
        .
      </div>
    );
  }
  return (
    <div className="stu-form" ref={rootRef}>
      <PartitionedFields node={root} path={[]} value={seg.data} ctx={ctx} fieldDiags={fieldDiags} />
    </div>
  );
}
