/**
 * The micro-editor: a compact popover anchored to a clicked diagram element,
 * editing exactly the YAML value that element represents.
 *
 * - scalar (string/number/boolean/enum) → one autofocused control; commit on
 *   Enter/blur, Esc closes without committing;
 * - object item → stacked compact fields (scalars/enums; nested structures
 *   defer to the full editor);
 * - array item → adds remove (🗑) and ↑/↓ reorder controls;
 * - opaque schema node → a scalar input when the current VALUE is scalar,
 *   otherwise a mini YAML textarea for just that subtree, with an
 *   "Edit block YAML" escape hatch.
 *
 * Commits route through the {@link DirectHost} — the canvas host makes one
 * undo step per commit; the sheet host writes into the sheet draft.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { FieldNode } from '@avodado/core';
import { IconTrash } from '../components/Icons.js';
import { SmartControl } from '../form/controls.js';
import { microVisibleFields, resolveControl } from '../form/fieldKind.js';
import { unionObjectArm } from '../form/union.js';
import { focusControl, focusablesIn } from '../lib/focus.js';
import type { DirectHost } from './host.js';
import {
  humanizeFieldName,
  humanizePath,
  isItemPath,
  resolveFieldAt,
  valueAt,
  type PathSeg,
} from './paths.js';

/** A rectangle in wrapper-relative coordinates. */
export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

const WIDTH = 264;

/** The name of the field a path addresses (its last string segment, or ''). */
function fieldNameOf(path: ReadonlyArray<PathSeg>): string {
  for (let i = path.length - 1; i >= 0; i--) {
    const seg = path[i];
    if (typeof seg === 'string') return seg;
  }
  return '';
}

function YamlControl({ value, onCommit }: {
  value: unknown;
  onCommit: (value: unknown) => void;
}): JSX.Element {
  const initial = value === undefined ? '' : stringifyYaml(value, { lineWidth: 0 }).replace(/\n$/, '');
  const [draft, setDraft] = useState(initial);
  const [err, setErr] = useState<string | null>(null);

  const commit = (): void => {
    if (draft === initial) return;
    try {
      onCommit(parseYaml(draft));
      setErr(null);
    } catch (e) {
      setErr((e as Error).message.split('\n')[0] ?? 'invalid YAML');
    }
  };

  return (
    <>
      <textarea
        className="stu-input stu-input-area stu-dx-yaml"
        value={draft}
        autoFocus
        rows={Math.min(8, Math.max(3, initial.split('\n').length + 1))}
        spellCheck={false}
        onChange={(e) => {
          setDraft(e.target.value);
          setErr(null);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            commit();
          }
        }}
      />
      {err !== null && <div className="stu-dx-err">{err}</div>}
    </>
  );
}

export function MicroEditor({ host, root, data, path, anchor, focusField, onClose, onMovedTo, onRemoveItem }: {
  host: DirectHost;
  root: FieldNode;
  data: unknown;
  path: ReadonlyArray<PathSeg>;
  anchor: Rect;
  /** Object items: open with THIS field focused (forced visible) instead of the first. */
  focusField?: string | undefined;
  onClose: () => void;
  /** Called after the ↑/↓ reorder buttons with the item's NEW path (selection follow). */
  onMovedTo?: ((newPath: string) => void) | undefined;
  /**
   * Overrides the remove-item action (compound deletions — a table column
   * must remove its cell from every row too). Default: delete `path`.
   */
  onRemoveItem?: (() => void) | undefined;
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const node = resolveFieldAt(root, path);
  const value = valueAt(data, path);
  const itemPath = isItemPath(path);
  const parentPath = itemPath ? path.slice(0, -1) : null;
  const siblings = parentPath !== null ? asArray(valueAt(data, parentPath)).length : 0;
  const index = itemPath ? (path[path.length - 1] as number) : -1;

  // Position: below the anchor, clamped into the viewport, flipped above when
  // there is no room below. Computed after mount (needs the popover's height).
  useLayoutEffect(() => {
    const el = ref.current;
    const wrap = el?.offsetParent as HTMLElement | null;
    if (el === null || wrap === null) return;
    const wrapRect = wrap.getBoundingClientRect();
    const h = el.offsetHeight;
    const margin = 8;
    let left = anchor.left;
    const maxLeft = wrapRect.width - WIDTH - 4;
    if (left > maxLeft) left = Math.max(0, maxLeft);
    // Clamp against the viewport horizontally too.
    const vpLeft = wrapRect.left + left;
    if (vpLeft + WIDTH > window.innerWidth - margin) {
      left -= vpLeft + WIDTH - (window.innerWidth - margin);
    }
    let top = anchor.top + anchor.height + 6;
    const vpTop = wrapRect.top + top;
    if (vpTop + h > window.innerHeight - margin && anchor.top - h - 6 >= 0) {
      top = anchor.top - h - 6; // flip above
    }
    setPos({ left: Math.max(0, left), top });
  }, [anchor.left, anchor.top, anchor.height, path.join('.')]);

  // Focus the intended control once the popover is POSITIONED — `autoFocus`
  // fires while the popover is still `visibility: hidden` (pre-measure) and
  // browsers refuse to focus hidden elements.
  useEffect(() => {
    if (pos === null) return;
    const el = ref.current;
    if (el === null || el.contains(document.activeElement)) return;
    const scope =
      focusField !== undefined
        ? el.querySelector(`[data-dx-field="${CSS.escape(focusField)}"]`)
        : el;
    (scope ?? el).querySelector<HTMLElement>('textarea, input, select')?.focus();
  }, [pos, focusField]);

  // Esc closes just the popover (capture, so the canvas/sheet never see it) —
  // unless an open combobox owns it (revert + close list first).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        const t = e.target instanceof HTMLElement ? e.target : null;
        if (t !== null && t.closest('[data-combo-open="true"]') !== null) return;
        e.stopPropagation();
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  /** Keyboard: Tab cycles the popover's fields; ⏎ advances / closes on last. */
  const onPopKeyDown = (e: React.KeyboardEvent): void => {
    const pop = ref.current;
    if (pop === null) return;
    const target = e.target as HTMLElement;
    if (e.key === 'Tab') {
      const fields = focusablesIn(pop);
      if (fields.length === 0) return;
      const idx = fields.indexOf(target);
      e.preventDefault();
      const next = e.shiftKey
        ? (fields[idx <= 0 ? fields.length - 1 : idx - 1] as HTMLElement)
        : (fields[idx < 0 || idx >= fields.length - 1 ? 0 : idx + 1] as HTMLElement);
      focusControl(next);
      return;
    }
    if (e.key === 'Enter') {
      const mod = e.metaKey || e.ctrlKey;
      if (target.tagName === 'TEXTAREA' && !mod) return; // ⏎ stays a newline
      // The control's own handler commits; we route the focus.
      window.setTimeout(() => {
        const fields = focusablesIn(pop);
        const idx = fields.indexOf(document.activeElement as HTMLElement);
        if (idx >= 0 && idx < fields.length - 1) {
          focusControl(fields[idx + 1] as HTMLElement);
        } else {
          onClose();
        }
      }, 0);
    }
  };

  // Outside pointerdown closes (any focused input blurs first, committing).
  useEffect(() => {
    const onDown = (e: PointerEvent): void => {
      const el = ref.current;
      if (el !== null && e.target instanceof Node && !el.contains(e.target)) {
        // Let blur-commit fire before unmounting.
        setTimeout(onClose, 0);
      }
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [onClose]);

  const move = (delta: number): void => {
    if (parentPath === null) return;
    const arr = asArray(valueAt(data, parentPath)).slice();
    const j = index + delta;
    if (j < 0 || j >= arr.length) return;
    const [moved] = arr.splice(index, 1);
    arr.splice(j, 0, moved);
    host.commitPath(parentPath, arr);
    onMovedTo?.([...parentPath, j].join('.'));
    onClose();
  };

  // A union node behaves like its current value's shape: scalar values get
  // the one smart input (below); a DETAILED value (object) edits through the
  // union's object arm like any object item.
  const unionArm = node !== null && node.kind === 'union' ? unionObjectArm(node) : null;
  const objectNode =
    node !== null && node.kind === 'object'
      ? node
      : unionArm !== null && value !== null && typeof value === 'object' && !Array.isArray(value)
        ? unionArm
        : null;

  let body: JSX.Element;
  if (node !== null && (node.kind === 'string' || node.kind === 'number' || node.kind === 'boolean' || node.kind === 'enum')) {
    body = (
      <SmartControl
        resolved={resolveControl({ blockKind: host.kind, name: fieldNameOf(path), node, value, data, path })}
        node={node}
        value={value}
        optional={node.optional}
        autoFocus
        handlers={{
          onCommit: (v) => host.commitPath(path, v),
          onDelete: () => host.deletePath(path),
          onDone: onClose,
        }}
      />
    );
  } else if (objectNode !== null) {
    const rec = asRecord(value);
    const { visible, hidden } = microVisibleFields(objectNode.fields, value, 4, focusField);
    const focus =
      focusField !== undefined && visible.some((f) => f.name === focusField)
        ? focusField
        : visible[0]?.name;
    body = (
      <div className="stu-dx-fields">
        {visible.map((f) => (
          <div key={f.name} className="stu-dx-field" data-dx-field={f.name}>
            <label className="stu-dx-label">{humanizeFieldName(f.name)}</label>
            <SmartControl
              resolved={resolveControl({
                blockKind: host.kind,
                name: f.name,
                node: f.node,
                value: rec[f.name],
                data,
                path: [...path, f.name],
              })}
              node={f.node}
              value={rec[f.name]}
              optional={f.node.optional}
              autoFocus={f.name === focus}
              handlers={{
                onCommit: (v) => host.commitPath([...path, f.name], v),
                onDelete: () => host.deletePath([...path, f.name]),
              }}
            />
          </div>
        ))}
        {hidden > 0 && (
          <button type="button" className="stu-linkbtn stu-dx-more" tabIndex={-1} onClick={() => { onClose(); host.openFull(); }}>
            More fields in the editor…
          </button>
        )}
      </div>
    );
  } else if (value === undefined || value === null || typeof value !== 'object') {
    // Opaque schema node over a scalar value (e.g. a table cell): plain input,
    // type preserved from the current value.
    const leafNode = node !== null && node.kind !== 'array' ? node : null;
    body = (
      <SmartControl
        resolved={resolveControl({ blockKind: host.kind, name: fieldNameOf(path), node: leafNode, value, data, path })}
        node={leafNode}
        value={value}
        optional={leafNode?.optional ?? true}
        autoFocus
        handlers={{
          onCommit: (v) => host.commitPath(path, v),
          onDone: onClose,
        }}
      />
    );
  } else {
    // Opaque structured value: edit just this subtree as YAML.
    body = (
      <>
        <YamlControl value={value} onCommit={(v) => host.commitPath(path, v)} />
        <button type="button" className="stu-linkbtn stu-dx-more" onClick={() => { onClose(); host.openFull(); }}>
          Edit block YAML
        </button>
      </>
    );
  }

  return (
    <div
      ref={ref}
      className="stu-dx-pop"
      role="dialog"
      aria-label={`Edit ${humanizePath(path)}`}
      style={{
        width: WIDTH,
        left: pos?.left ?? anchor.left,
        top: pos?.top ?? anchor.top + anchor.height + 6,
        visibility: pos === null ? 'hidden' : 'visible',
      }}
      onClick={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onKeyDown={onPopKeyDown}
    >
      <div className="stu-dx-pop-head">
        <span className="stu-dx-pop-title">{humanizePath(path)}</span>
        {itemPath && (
          <span className="stu-dx-pop-tools">
            <button type="button" aria-label="Move up" tabIndex={-1} disabled={index <= 0} onClick={() => move(-1)}>
              ↑
            </button>
            <button
              type="button"
              aria-label="Move down"
              tabIndex={-1}
              disabled={index >= siblings - 1}
              onClick={() => move(1)}
            >
              ↓
            </button>
            <button
              type="button"
              className="stu-dx-remove-btn"
              aria-label="Remove item"
              tabIndex={-1}
              onClick={() => {
                if (onRemoveItem !== undefined) onRemoveItem();
                else host.deletePath(path);
                onClose();
              }}
            >
              <IconTrash size={12} />
            </button>
          </span>
        )}
      </div>
      {body}
    </div>
  );
}

function asRecord(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
