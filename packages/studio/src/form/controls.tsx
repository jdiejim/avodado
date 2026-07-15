/**
 * Shared smart field controls — the ONE implementation used by both the Edit
 * Sheet's FormTab and the on-diagram MicroEditor. {@link SmartControl}
 * dispatches on a {@link ResolvedControl} from `fieldKind.ts`:
 *
 * - text (input/textarea, type-preserving via coerceValue),
 * - number stepper (+/− affordance),
 * - boolean toggle,
 * - filterable comboboxes for enums (strict) and node-kind / relational
 *   dropdowns (free text allowed — the user is never trapped in a list):
 *   type → filter, ↑↓ → move, ⏎ → select, Esc → revert,
 * - accent enums as named swatches,
 * - color (house diagram palette swatches + native picker + hex field).
 *
 * Keyboard-first: mouse-only chrome (steppers' −/+, swatches, the native
 * color picker) carries `tabIndex={-1}` so Tab walks fields, not buttons.
 *
 * Commit semantics are the host's: `onCommit` lands a value, `onStage` streams
 * keystrokes to a live preview (sheet only), `onDelete` unsets an optional
 * field, `onDone` fires after an Enter-commit (micro-editor closes on it).
 */

import { useEffect, useRef, useState } from 'react';
import type { FieldNode } from '@avodado/core';
import { STATUS_COLOR_ALIASES } from '@avodado/core';
import { coerceValue } from '../direct/paths.js';
import type { RefOption, ResolvedControl } from './fieldKind.js';
import { filterComboOptions } from './keyboard.js';

/** What a control does with the values it produces. */
export interface ControlHandlers {
  readonly onCommit: (value: unknown) => void;
  /** Keystroke-level staging for live previews (optional). */
  readonly onStage?: ((value: unknown) => void) | undefined;
  /** Unsets an optional field (falls back to committing '' when absent). */
  readonly onDelete?: (() => void) | undefined;
  /** Fired after an explicit Enter-commit or a dropdown pick. */
  readonly onDone?: (() => void) | undefined;
}

/** Accent-name → hex, for the named-accent swatch row. */
export const ACCENT_HEX: Readonly<Record<string, string>> = {
  navy: '#0e54a1',
  blue: '#2563eb',
  teal: '#0f766e',
  green: '#1f9747',
  amber: '#b45309',
  purple: '#7c3aed',
  red: '#b91c1c',
  gray: '#6b7280',
};

/**
 * The hex an accent-enum option paints — semantic aliases (`success`,
 * `error`, …) show the swatch of the accent they normalize to, titled with
 * their own semantic name.
 */
export function accentOptionHex(option: string): string {
  const alias = (STATUS_COLOR_ALIASES as Readonly<Record<string, string>>)[option];
  return ACCENT_HEX[option] ?? (alias !== undefined ? ACCENT_HEX[alias] : undefined) ?? '#999';
}

/**
 * The house diagram palette — the exact accent hexes the block renderers use
 * (see `packages/render/src/svg/blockStyle.ts`), so a hand-picked color always
 * matches something the diagrams already speak.
 */
export const DIAGRAM_PALETTE: ReadonlyArray<{ readonly hex: string; readonly name: string }> = [
  { hex: '#0e54a1', name: 'navy' },
  { hex: '#1a6dbe', name: 'blue' },
  { hex: '#0369a1', name: 'sky' },
  { hex: '#0891b2', name: 'cyan' },
  { hex: '#0f766e', name: 'teal' },
  { hex: '#1f9747', name: 'green' },
  { hex: '#f7952c', name: 'orange' },
  { hex: '#b45309', name: 'amber' },
  { hex: '#991b1b', name: 'red' },
  { hex: '#7c3aed', name: 'violet' },
  { hex: '#6b21a8', name: 'purple' },
  { hex: '#4338ca', name: 'indigo' },
  { hex: '#475569', name: 'slate' },
  { hex: '#6b7280', name: 'gray' },
];

const HEX_RE = /^#[0-9a-f]{3,8}$/i;

function asString(value: unknown): string {
  return value === undefined || value === null
    ? ''
    : typeof value === 'string'
      ? value
      : String(value);
}

/** `#abc` → `#aabbcc`, `#rrggbbaa` → `#rrggbb` — what `<input type=color>` accepts. */
export function pickerHex(value: string): string | null {
  if (!HEX_RE.test(value)) return null;
  const h = value.slice(1);
  if (h.length === 3 || h.length === 4) {
    const [r, g, b] = [h[0] ?? '', h[1] ?? '', h[2] ?? ''];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return `#${h.slice(0, 6)}`.toLowerCase();
}

/* ─── text ────────────────────────────────────────────────────────────────── */

function TextControl({ node, value, optional, multiline, autoFocus, handlers }: {
  node: FieldNode | null;
  value: unknown;
  optional: boolean;
  multiline: boolean;
  autoFocus?: boolean | undefined;
  handlers: ControlHandlers;
}): JSX.Element {
  const current = asString(value);
  const [draft, setDraft] = useState(current);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => setDraft(current), [current]);

  const commit = (done: boolean): void => {
    if (draft !== current) {
      if (draft === '' && optional && handlers.onDelete !== undefined) {
        handlers.onDelete();
      } else {
        const c = coerceValue(draft, value, node);
        if (!c.ok) {
          setInvalid(true);
          return;
        }
        handlers.onCommit(c.value);
      }
    }
    if (done) handlers.onDone?.();
  };

  const onChange = (next: string): void => {
    setDraft(next);
    setInvalid(false);
    handlers.onStage?.(next);
  };

  if (multiline) {
    return (
      <textarea
        className="stu-input stu-input-area"
        value={draft}
        autoFocus={autoFocus}
        rows={3}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => commit(false)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            // Commit only — advancing/done is the container's decision.
            commit(false);
          }
        }}
      />
    );
  }
  return (
    <input
      className={`stu-input ${invalid ? 'stu-input-invalid' : ''}`}
      type="text"
      value={draft}
      autoFocus={autoFocus}
      spellCheck={false}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => commit(false)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit(true);
        }
      }}
    />
  );
}

/* ─── number stepper ──────────────────────────────────────────────────────── */

function NumberStepper({ value, optional, autoFocus, handlers }: {
  value: unknown;
  optional: boolean;
  autoFocus?: boolean | undefined;
  handlers: ControlHandlers;
}): JSX.Element {
  const current = typeof value === 'number' ? String(value) : '';
  const [draft, setDraft] = useState(current);
  useEffect(() => setDraft(current), [current]);

  const commit = (done: boolean): void => {
    if (draft !== current) {
      if (draft.trim() === '' && optional && handlers.onDelete !== undefined) {
        handlers.onDelete();
      } else {
        const n = Number(draft);
        if (Number.isFinite(n) && draft.trim() !== '') handlers.onCommit(n);
      }
    }
    if (done) handlers.onDone?.();
  };

  const step = (delta: number): void => {
    const base = draft.trim() !== '' && Number.isFinite(Number(draft)) ? Number(draft) : 0;
    handlers.onCommit(base + delta);
  };

  return (
    <div className="stu-stepper">
      <button
        type="button"
        className="stu-step-btn"
        aria-label="Decrement"
        tabIndex={-1}
        onClick={() => step(-1)}
      >
        −
      </button>
      <input
        className="stu-input stu-input-num"
        type="text"
        inputMode="decimal"
        value={draft}
        autoFocus={autoFocus}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = Number(e.target.value);
          if (Number.isFinite(n) && e.target.value.trim() !== '') handlers.onStage?.(n);
        }}
        onBlur={() => commit(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit(true);
          }
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            step(e.key === 'ArrowUp' ? 1 : -1);
          }
        }}
      />
      <button
        type="button"
        className="stu-step-btn"
        aria-label="Increment"
        tabIndex={-1}
        onClick={() => step(1)}
      >
        +
      </button>
    </div>
  );
}

/* ─── boolean / accent ────────────────────────────────────────────────────── */

function Toggle({ value, handlers }: { value: unknown; handlers: ControlHandlers }): JSX.Element {
  const checked = value === true;
  return (
    <label className="stu-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => handlers.onCommit(e.target.checked)} />
      <span className="stu-switch" aria-hidden="true" />
      <span className="stu-toggle-label">{checked ? 'yes' : 'no'}</span>
    </label>
  );
}

function AccentSwatches({ value, options, optional, handlers }: {
  value: unknown;
  options: readonly string[];
  optional: boolean;
  handlers: ControlHandlers;
}): JSX.Element {
  const current = typeof value === 'string' ? value : '';
  return (
    <div className="stu-swatches" role="radiogroup">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={current === o}
          className={`stu-swatch ${current === o ? 'stu-swatch-active' : ''}`}
          style={{ background: accentOptionHex(o) }}
          title={o}
          tabIndex={-1}
          onClick={() => handlers.onCommit(o)}
        />
      ))}
      {optional && current !== '' && (
        <button
          type="button"
          className="stu-swatch-clear"
          title="Unset"
          tabIndex={-1}
          onClick={() => handlers.onDelete?.()}
        >
          ×
        </button>
      )}
    </div>
  );
}

/* ─── color ───────────────────────────────────────────────────────────────── */

function ColorControl({ value, optional, handlers }: {
  value: unknown;
  optional: boolean;
  handlers: ControlHandlers;
}): JSX.Element {
  const current = asString(value);
  const [draft, setDraft] = useState(current);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => setDraft(current), [current]);

  const commitHex = (hex: string, done = false): void => {
    if (hex === current) {
      if (done) handlers.onDone?.();
      return;
    }
    if (hex === '' && optional && handlers.onDelete !== undefined) {
      handlers.onDelete();
    } else if (HEX_RE.test(hex)) {
      handlers.onCommit(hex.toLowerCase());
    } else {
      setInvalid(true);
      return;
    }
    if (done) handlers.onDone?.();
  };

  const active = current.toLowerCase();
  return (
    <div className="stu-colorctl">
      <div className="stu-swatches stu-swatches-wrap" role="radiogroup">
        {DIAGRAM_PALETTE.map((p) => (
          <button
            key={p.hex}
            type="button"
            role="radio"
            aria-checked={active === p.hex}
            className={`stu-swatch stu-swatch-sm ${active === p.hex ? 'stu-swatch-active' : ''}`}
            style={{ background: p.hex }}
            title={`${p.name} ${p.hex}`}
            tabIndex={-1}
            onClick={() => handlers.onCommit(p.hex)}
          />
        ))}
        {optional && current !== '' && (
          <button
            type="button"
            className="stu-swatch-clear"
            title="Unset"
            tabIndex={-1}
            onClick={() => handlers.onDelete?.()}
          >
            ×
          </button>
        )}
      </div>
      <div className="stu-colorrow">
        <input
          type="color"
          className="stu-colorpick"
          aria-label="Pick a color"
          tabIndex={-1}
          value={pickerHex(draft) ?? '#0e54a1'}
          onChange={(e) => {
            setDraft(e.target.value);
            setInvalid(false);
            handlers.onStage?.(e.target.value);
          }}
          onBlur={(e) => commitHex(e.target.value)}
        />
        <input
          className={`stu-input stu-colorhex ${invalid ? 'stu-input-invalid' : ''}`}
          type="text"
          value={draft}
          placeholder="#0e54a1"
          spellCheck={false}
          onChange={(e) => {
            setDraft(e.target.value);
            setInvalid(false);
            if (HEX_RE.test(e.target.value)) handlers.onStage?.(e.target.value);
          }}
          onBlur={() => commitHex(draft)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitHex(draft, true);
            }
          }}
        />
      </div>
    </div>
  );
}

/* ─── combobox (enums + kinds + relational ids) ───────────────────────────── */

/**
 * A filterable combobox. `strict` (enums) only commits known options — junk
 * reverts on blur; non-strict (kinds, relational ids) commits free text, so
 * the closed list never traps the user.
 *
 * Keyboard: type → filter · ↑↓ → move · ⏎ → select active (or commit the
 * draft) · Esc → revert + close (swallowed while the list is open — sheets
 * and popovers check `[data-combo-open]` before treating Esc as cancel).
 */
function Combobox({ value, options, optional, strict, autoFocus, handlers }: {
  value: unknown;
  options: readonly RefOption[];
  optional: boolean;
  strict: boolean;
  autoFocus?: boolean | undefined;
  handlers: ControlHandlers;
}): JSX.Element {
  const current = typeof value === 'string' ? value : '';
  const [draft, setDraft] = useState(current);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [invalid, setInvalid] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => setDraft(current), [current]);

  const opts = filterComboOptions(options, draft, current);

  useEffect(() => {
    const el = listRef.current?.children[active];
    if (el instanceof HTMLElement) el.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  /** Commits `v`; returns false when a strict list rejects it. */
  const commitVal = (v: string): boolean => {
    if (v === current) return true;
    if (v === '') {
      if (optional) {
        (handlers.onDelete ?? (() => handlers.onCommit('')))();
        return true;
      }
      return false;
    }
    if (strict && !options.some((o) => o.value === v)) return false;
    handlers.onCommit(v);
    return true;
  };

  const pick = (v: string): void => {
    setDraft(v);
    commitVal(v);
    setOpen(false);
    handlers.onDone?.();
  };

  /** Opens the list with the CURRENT value highlighted (⏎ re-picks it → no-op). */
  const openList = (): void => {
    const i = opts.findIndex((o) => o.value === current);
    setActive(i >= 0 ? i : 0);
    setOpen(true);
  };

  return (
    <div className="stu-combo" data-combo-open={open ? 'true' : undefined}>
      <input
        className={`stu-input ${invalid ? 'stu-input-invalid' : ''}`}
        type="text"
        role="combobox"
        aria-expanded={open}
        value={draft}
        autoFocus={autoFocus}
        spellCheck={false}
        onFocus={openList}
        onChange={(e) => {
          setDraft(e.target.value);
          setInvalid(false);
          setActive(0);
          setOpen(true);
        }}
        onBlur={() => {
          if (!commitVal(draft)) setDraft(current);
          setOpen(false);
          setInvalid(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!open) {
              openList();
              return;
            }
            setActive((a) =>
              e.key === 'ArrowDown' ? Math.min(a + 1, opts.length - 1) : Math.max(a - 1, 0),
            );
            return;
          }
          if (e.key === 'Enter') {
            e.preventDefault();
            const sel = open ? opts[active] : undefined;
            if (sel !== undefined) {
              setDraft(sel.value);
              commitVal(sel.value);
              setOpen(false);
            } else if (commitVal(draft)) {
              setOpen(false);
            } else {
              setInvalid(true);
              return; // keep focus; the row handler still sees the Enter
            }
            handlers.onDone?.();
            return;
          }
          if (e.key === 'Escape' && open) {
            e.preventDefault();
            e.stopPropagation();
            setDraft(current);
            setOpen(false);
          }
        }}
      />
      <span className="stu-combo-caret" aria-hidden="true">
        ▾
      </span>
      {open && opts.length > 0 && (
        <ul className="stu-combo-list" role="listbox" ref={listRef}>
          {opts.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={i === active}
              className={`stu-combo-item ${i === active ? 'stu-combo-item-active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault(); // beat the input's blur
                pick(o.value);
              }}
            >
              <span className="stu-combo-value">{o.value}</span>
              {o.label !== undefined && <span className="stu-combo-label">{o.label}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ─── dispatcher ──────────────────────────────────────────────────────────── */

/**
 * Renders the control picked by `fieldKind.resolveControl`. Both editors go
 * through this — one visual language everywhere.
 */
export function SmartControl({ resolved, node, value, optional, autoFocus, handlers }: {
  resolved: ResolvedControl;
  node: FieldNode | null;
  value: unknown;
  optional: boolean;
  autoFocus?: boolean | undefined;
  handlers: ControlHandlers;
}): JSX.Element | null {
  switch (resolved.kind) {
    case 'boolean':
      return <Toggle value={value} handlers={handlers} />;
    case 'number':
      return <NumberStepper value={value} optional={optional} autoFocus={autoFocus} handlers={handlers} />;
    case 'enum':
      return (
        <Combobox
          value={value}
          options={resolved.options.map((o) => ({ value: o }))}
          optional={optional}
          strict
          autoFocus={autoFocus}
          handlers={handlers}
        />
      );
    case 'accent':
      return <AccentSwatches value={value} options={resolved.options} optional={optional} handlers={handlers} />;
    case 'color':
      return <ColorControl value={value} optional={optional} handlers={handlers} />;
    case 'options':
      return (
        <Combobox
          value={value}
          options={resolved.options}
          optional={optional}
          strict={false}
          autoFocus={autoFocus}
          handlers={handlers}
        />
      );
    case 'text':
      return (
        <TextControl node={node} value={value} optional={optional} multiline={resolved.multiline} autoFocus={autoFocus} handlers={handlers} />
      );
    case 'opaque':
      return null;
  }
}
