/**
 * THE insert picker — the one component behind every "add a block" entry
 * point, over one search implementation (`lib/pickerEngine`):
 *
 * - COMPACT: a keyboard-first ranked list. `/` opens it centered; a gap '+'
 *   opens it anchored to the gap (the insert then lands at that gap).
 *   ↑↓ + ⏎ inserts, Esc closes. Its footer expands IN PLACE to browse mode,
 *   keeping the search text.
 * - BROWSE: the full gallery — family sections of thumbnail cards, family
 *   pills, and a detail dialog with a rendered preview, the YAML starter
 *   template, and Insert/Copy. Search is autofocused; ⇥ reaches the roving
 *   card, ←↑↓→ move between cards, ⏎ opens the detail (⌘⏎ inserts from it),
 *   Esc walks back out (detail → gallery → closed). Focus is trapped while
 *   open and restored on close.
 *
 * Both faces share the "Import from file…" footer. Open state lives in the
 * store (`picker`); inserting resolves its index through the one rule in
 * `pickerInsertIndex` (pinned gap → that gap; else after the selection; else
 * the doc end).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { BLOCK_FAMILIES, parseDocument } from '@avodado/core';
import { renderDocumentSegments } from '@avodado/render';
import { insertBlockAt } from '../lib/actions.js';
import { openImportFilePicker } from '../lib/importActions.js';
import { insertBodyFor, INSERT_ITEMS, type InsertItem } from '../lib/insertEngine.js';
import {
  aliasPatchSummary,
  browseView,
  compactItems,
  hitInsertBody,
  isRoveKey,
  pickerInsertIndex,
  roveIndex,
  type FamilyFilter,
  type PickerHit,
} from '../lib/pickerEngine.js';
import { buildBlockSource, previewBlock } from '../lib/blockPreview.js';
import { derive, docSurface } from '../state/derive.js';
import { useStudio, type PickerOpenState } from '../state/store.js';
import {
  IconClose,
  IconDuplicate,
  IconImport,
  IconLibrary,
  IconSearch,
} from './Icons.js';
import { Thumb } from './Thumb.js';

const MAX_COMPACT = 9;
const COMPACT_W = 420;
const COMPACT_H = 420;

/** Family id → label (pills for families with no current matches need it). */
const FAMILY_LABELS: ReadonlyMap<string, string> = new Map(
  BLOCK_FAMILIES.map((f) => [f.id, f.label]),
);

/** Where the picker's insert lands, resolved against the store RIGHT NOW. */
function resolveIndex(pinned: number | null): number {
  const s = useStudio.getState();
  const { doc } = derive(s.source, s.currentSlug ?? 'untitled', s.theme, s.themeVars);
  return pickerInsertIndex(pinned, s.selection, doc.segments.length);
}

/**
 * Inserts `type` with `body` at the resolved index. Inserting is an EDIT
 * action: leave Present first, then close the picker and run the normal
 * fresh-template flow (the Edit Sheet opens on the new block).
 */
function insertFromPicker(pinned: number | null, type: InsertItem['type'], body: string): void {
  const s = useStudio.getState();
  if (s.currentSlug === null) return;
  const index = resolveIndex(pinned);
  if (s.mode !== 'edit') s.setMode('edit');
  s.closePicker();
  insertBlockAt(index, type, body);
}

/** The ONE "Import from file…" footer — compact and browse both render it. */
function ImportEntry({ pinned }: { pinned: number | null }): JSX.Element {
  const currentSlug = useStudio((s) => s.currentSlug);
  return (
    <button
      type="button"
      className="stu-picker-import"
      disabled={currentSlug === null}
      title={currentSlug === null ? 'Open a doc first' : undefined}
      onClick={() => {
        const s = useStudio.getState();
        const index = resolveIndex(pinned);
        if (s.mode !== 'edit') s.setMode('edit');
        s.closePicker();
        openImportFilePicker(index);
      }}
    >
      <IconImport size={13} />
      Import from file…
      <span className="stu-picker-import-hint">.csv → block · OpenAPI .yaml/.json → new doc</span>
    </button>
  );
}

/* ─── compact ─────────────────────────────────────────────────────────────── */

function CompactPicker({ picker, query, setQuery }: {
  picker: PickerOpenState;
  query: string;
  setQuery: (q: string) => void;
}): JSX.Element {
  const closePicker = useStudio((s) => s.closePicker);
  const expandPicker = useStudio((s) => s.expandPicker);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const items = useMemo(() => compactItems(query, MAX_COMPACT), [query]);

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    const el = listRef.current?.children[active];
    if (el instanceof HTMLElement) el.scrollIntoView({ block: 'nearest' });
  }, [active]);

  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      if (rootRef.current !== null && !rootRef.current.contains(e.target as Node)) closePicker();
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [closePicker]);

  const pick = (item: InsertItem): void =>
    insertFromPicker(picker.index, item.type, insertBodyFor(item));

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closePicker();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const item = items[active];
      if (item !== undefined) pick(item);
    }
  };

  // A gap '+' anchors the popover to its gap (clamped into the viewport);
  // '/' has no anchor and centers.
  const style = useMemo(() => {
    const a = picker.anchor;
    if (a === null) return undefined;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.min(Math.max(a.x - COMPACT_W / 2, 12), Math.max(12, vw - COMPACT_W - 12));
    const below = a.y + 10;
    const top = below + COMPACT_H > vh - 12 ? Math.max(12, a.y - COMPACT_H - 14) : below;
    return { left, top };
  }, [picker.anchor]);

  return (
    <div
      className={`stu-picker-compact ${picker.anchor === null ? 'stu-picker-compact-centered' : ''}`}
      ref={rootRef}
      {...(style !== undefined ? { style } : {})}
      role="dialog"
      aria-label="Insert a block"
    >
      <div className="stu-picker-search">
        <IconSearch size={14} />
        <input
          ref={inputRef}
          type="text"
          placeholder={`Search ${INSERT_ITEMS.length} block types…`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <kbd>esc</kbd>
      </div>
      <ul className="stu-picker-list" ref={listRef} role="listbox">
        {items.map((item, i) => (
          <li key={item.alias ?? item.type}>
            <button
              type="button"
              role="option"
              aria-selected={i === active}
              className={`stu-picker-item ${i === active ? 'stu-picker-item-active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(item)}
            >
              <span className="stu-picker-item-name">{item.label}</span>
              <span className="stu-card-type">{item.type}</span>
              <span className="stu-picker-item-fam">{item.familyLabel}</span>
            </button>
          </li>
        ))}
        {items.length === 0 && <li className="stu-picker-none">No matching blocks</li>}
      </ul>
      <div className="stu-picker-foot">
        <ImportEntry pinned={picker.index} />
        <button type="button" className="stu-picker-import" onClick={expandPicker}>
          <IconLibrary size={13} />
          Browse all blocks
          <span className="stu-picker-import-hint">gallery with previews →</span>
        </button>
      </div>
    </div>
  );
}

/* ─── browse ──────────────────────────────────────────────────────────────── */

/** Focusables that participate in the overlay's Tab cycle. */
function tabbablesIn(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>('button, input, [tabindex="0"]'),
  ).filter((el) => el.tabIndex >= 0 && !el.hasAttribute('disabled') && el.offsetParent !== null);
}

/** Wraps Tab/⇧Tab inside `root` (the focus trap). */
function trapTab(e: React.KeyboardEvent, root: HTMLElement | null): void {
  if (e.key !== 'Tab' || root === null) return;
  const els = tabbablesIn(root);
  const first = els[0];
  const last = els[els.length - 1];
  if (first === undefined || last === undefined) return;
  const active = document.activeElement;
  if (e.shiftKey && (active === first || !root.contains(active))) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
}

/** How many cards sit on the first row of `grid` (the responsive column count). */
function gridColumns(grid: HTMLElement | null): number {
  if (grid === null) return 1;
  const children = Array.from(grid.children) as HTMLElement[];
  const first = children[0];
  if (first === undefined) return 1;
  return Math.max(1, children.filter((c) => c.offsetTop === first.offsetTop).length);
}

function BrowseCard({ hit, index, roving, onOpen, onRove }: {
  hit: PickerHit;
  index: number;
  roving: boolean;
  onOpen: (hit: PickerHit) => void;
  onRove: (index: number) => void;
}): JSX.Element {
  return (
    <button
      type="button"
      className="stu-card stu-picker-card"
      data-libcard={index}
      tabIndex={roving ? 0 : -1}
      onFocus={() => onRove(index)}
      onClick={() => onOpen(hit)}
      aria-label={`${hit.item.label} (${hit.item.type}) — open details`}
      aria-haspopup="dialog"
    >
      <Thumb type={hit.item.type} />
      <span className="stu-card-head">
        <span className="stu-card-name">{hit.item.label}</span>
        <span className="stu-card-type">{hit.item.type}</span>
      </span>
      <span className="stu-card-desc">{hit.item.description}</span>
      {hit.alias !== undefined && <span className="stu-picker-also">also: {hit.alias}</span>}
    </button>
  );
}

function DetailDialog({ hit, canInsert, onClose, onInsert }: {
  hit: PickerHit;
  /** False when no doc is open — the Insert button disables. */
  canInsert: boolean;
  onClose: () => void;
  onInsert: (hit: PickerHit) => void;
}): JSX.Element {
  const theme = useStudio((s) => s.theme);
  const themeVars = useStudio((s) => s.themeVars);
  const rootRef = useRef<HTMLDivElement>(null);
  const insertRef = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);

  const body = useMemo(() => hitInsertBody(hit), [hit]);
  const snippet = useMemo(() => buildBlockSource(hit.item.type, body).trimEnd(), [hit, body]);
  const preview = useMemo(
    () => previewBlock(hit.item.type, body, theme, themeVars),
    [hit, body, theme, themeVars],
  );

  // Land on Insert: ⏎ from the card flows ⏎ → details → ⏎ → inserted.
  useEffect(() => {
    requestAnimationFrame(() => insertRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = (): void => {
    void navigator.clipboard?.writeText(snippet + '\n').then(
      () => setCopied(true),
      () => undefined,
    );
  };

  return (
    <div
      className="stu-picker-detail-backdrop"
      onMouseDown={(e) => {
        if (rootRef.current !== null && !rootRef.current.contains(e.target as Node)) onClose();
      }}
    >
      <div
        className="stu-picker-detail"
        ref={rootRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${hit.item.label} block details`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canInsert) {
            e.preventDefault();
            onInsert(hit);
            return;
          }
          trapTab(e, rootRef.current);
        }}
      >
        <header className="stu-picker-detail-head">
          <div className="stu-picker-detail-title">
            <h3>{hit.item.label}</h3>
            <span className="stu-card-type">{hit.item.type}</span>
            <span className="stu-picker-detail-fam">{hit.item.familyLabel}</span>
          </div>
          <button type="button" className="stu-picker-x" aria-label="Close details" onClick={onClose}>
            <IconClose size={13} />
          </button>
        </header>
        <p className="stu-picker-detail-desc">{hit.item.description}</p>
        {hit.alias !== undefined && (
          <p className="stu-picker-detail-alias">
            also answers to: <code>{hit.alias}</code>
            {aliasPatchSummary(hit.alias) !== '' && (
              <> — inserts as <code>{aliasPatchSummary(hit.alias)}</code></>
            )}
          </p>
        )}
        <div className="stu-picker-detail-body">
          <div className="stu-picker-pane stu-picker-pane-preview">
            <div className="stu-picker-pane-label">Preview</div>
            <div className="stu-picker-preview" data-doc-theme={docSurface(theme, themeVars)}>
              {preview.html !== '' ? (
                <div
                  className="docskin stu-picker-preview-doc"
                  dangerouslySetInnerHTML={{ __html: preview.html }}
                />
              ) : (
                <div className="stu-picker-preview-blank">{hit.item.type}</div>
              )}
            </div>
          </div>
          <div className="stu-picker-pane stu-picker-pane-yaml">
            <div className="stu-picker-pane-label">
              Template
              <button type="button" className="stu-picker-copy" onClick={copy}>
                <IconDuplicate size={12} />
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre className="stu-picker-yaml" tabIndex={0}>{snippet}</pre>
          </div>
        </div>
        <footer className="stu-picker-detail-foot">
          <span className="stu-picker-detail-hint">⏎ insert · esc back to the gallery</span>
          <button type="button" className="stu-btn" onClick={onClose}>
            Close
          </button>
          <button
            ref={insertRef}
            type="button"
            className="stu-btn stu-btn-primary"
            disabled={!canInsert}
            title={canInsert ? 'Insert into the doc' : 'Open a doc first'}
            onClick={() => onInsert(hit)}
          >
            Insert into doc
          </button>
        </footer>
      </div>
    </div>
  );
}

function BrowsePicker({ picker, query, setQuery }: {
  picker: PickerOpenState;
  query: string;
  setQuery: (q: string) => void;
}): JSX.Element {
  const closePicker = useStudio((s) => s.closePicker);
  const currentSlug = useStudio((s) => s.currentSlug);
  const theme = useStudio((s) => s.theme);
  const themeVars = useStudio((s) => s.themeVars);
  const [family, setFamily] = useState<FamilyFilter>('all');
  const [detail, setDetail] = useState<PickerHit | null>(null);
  const [focusIdx, setFocusIdx] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const detailRef = useRef<PickerHit | null>(null);
  detailRef.current = detail;

  const view = useMemo(() => browseView(query, family), [query, family]);
  const flat = useMemo(() => view.groups.flatMap((g) => g.hits), [view]);

  const focusIdxRef = useRef(0);
  focusIdxRef.current = focusIdx;

  const focusCard = (i: number): void => {
    const el = rootRef.current?.querySelector<HTMLElement>(`[data-libcard="${i}"]`);
    el?.focus();
    el?.scrollIntoView({ block: 'nearest' });
  };

  // The docskin stylesheet + theme vars for thumbnails and the preview pane —
  // injected here (scoped to the overlay) so the gallery is fully styled even
  // when the Canvas (which injects them for Edit mode) isn't mounted.
  const skin = useMemo(() => {
    const r = renderDocumentSegments(parseDocument('', 'picker-skin'), {
      theme,
      ...(themeVars !== undefined ? { themeVars } : {}),
    });
    return { css: r.css, vars: r.themeVars };
  }, [theme, themeVars]);

  // Autofocus the search; remember and restore the opener's focus.
  useEffect(() => {
    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    requestAnimationFrame(() => searchRef.current?.focus());
    return () => restoreRef.current?.focus();
  }, []);

  useEffect(() => setFocusIdx(0), [query, family]);

  // Esc walks back out: detail → gallery → closed. Capture-phase so the
  // app-level handlers (mode switches, deselect) never see it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      if (detailRef.current !== null) {
        setDetail(null);
        requestAnimationFrame(() => focusCard(focusIdxRef.current));
      } else {
        closePicker();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [closePicker]);

  const openDetail = (hit: PickerHit): void => setDetail(hit);

  const closeDetail = (): void => {
    setDetail(null);
    requestAnimationFrame(() => focusCard(focusIdxRef.current));
  };

  const insert = (hit: PickerHit): void =>
    insertFromPicker(picker.index, hit.item.type, hitInsertBody(hit));

  // Roving focus over the flat card order; columns are measured from the
  // focused card's own (responsive) grid row.
  const onGridKeyDown = (e: React.KeyboardEvent): void => {
    const target = e.target as HTMLElement;
    const attr = target.getAttribute('data-libcard');
    if (attr === null || !isRoveKey(e.key)) return;
    e.preventDefault();
    const cols = gridColumns(target.parentElement);
    const next = roveIndex(Number(attr), e.key, cols, flat.length);
    setFocusIdx(next);
    focusCard(next);
  };

  const pillLabel = (id: FamilyFilter, label: string, count: number): JSX.Element => (
    <button
      key={id}
      type="button"
      className={`stu-picker-pill ${family === id ? 'stu-picker-pill-active' : ''} ${count === 0 ? 'stu-picker-pill-empty' : ''}`}
      aria-pressed={family === id}
      onClick={() => setFamily(family === id ? 'all' : id)}
    >
      {label}
      <span className="stu-picker-pill-count">{count}</span>
    </button>
  );

  return (
    <div className="stu-picker-backdrop">
      <div
        className="stu-picker-browse"
        ref={rootRef}
        role="dialog"
        aria-modal="true"
        aria-label="Block library"
        onKeyDown={(e) => {
          // The detail dialog runs its own trap while open.
          if (detail === null) trapTab(e, rootRef.current);
        }}
      >
        <style>{skin.css}</style>
        <style>{`.stu-picker-browse .docskin{${skin.vars}}`}</style>
        <header className="stu-picker-head">
          <div className="stu-picker-title">
            <span className="stu-picker-title-icon">
              <IconLibrary size={16} />
            </span>
            <h2>Block library</h2>
            <span className="stu-picker-title-count">· {view.total} blocks</span>
            <button
              type="button"
              className="stu-picker-x"
              aria-label="Close the block library"
              onClick={closePicker}
            >
              <IconClose size={14} />
            </button>
          </div>
          <div className="stu-picker-browse-search">
            <IconSearch size={14} />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search blocks — try “waterfall”, “diagram”, “api”…"
              aria-label="Search blocks"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === 'ArrowDown') && flat.length > 0) {
                  e.preventDefault();
                  focusCard(0);
                }
              }}
            />
            <span className="stu-picker-showing" aria-live="polite">
              Showing {view.shown} of {view.total}
            </span>
          </div>
          <div className="stu-picker-pills" role="group" aria-label="Filter by family">
            {pillLabel('all', 'All', view.matched)}
            {[...view.familyCounts].map(([id, count]) =>
              pillLabel(id, FAMILY_LABELS.get(id) ?? id, count),
            )}
          </div>
        </header>
        <div className="stu-picker-body" onKeyDown={onGridKeyDown}>
          {flat.length === 0 ? (
            <div className="stu-picker-empty">
              Nothing matches “{query.trim()}”
              {family !== 'all' ? ' in this family' : ''} — try another word or clear the search.
            </div>
          ) : (
            (() => {
              let offset = 0;
              return view.groups.map((g) => {
                const start = offset;
                offset += g.hits.length;
                return (
                  <section key={g.family} className="stu-picker-fam" aria-label={g.label}>
                    <div className="stu-picker-famhead">
                      {g.label}
                      <span className="stu-picker-count">{g.hits.length}</span>
                    </div>
                    <div className="stu-cardgrid stu-picker-grid">
                      {g.hits.map((hit, i) => (
                        <BrowseCard
                          key={hit.item.type}
                          hit={hit}
                          index={start + i}
                          roving={start + i === focusIdx}
                          onOpen={openDetail}
                          onRove={setFocusIdx}
                        />
                      ))}
                    </div>
                  </section>
                );
              });
            })()
          )}
        </div>
        <div className="stu-picker-foot">
          <ImportEntry pinned={picker.index} />
        </div>
        {detail !== null && (
          <DetailDialog
            hit={detail}
            canInsert={currentSlug !== null}
            onClose={closeDetail}
            onInsert={insert}
          />
        )}
      </div>
    </div>
  );
}

/* ─── the mount ───────────────────────────────────────────────────────────── */

/**
 * The picker's host: mounts one face while the store's `picker` state is up.
 * The query lives HERE so "Browse all blocks" (compact → browse in place)
 * keeps the search text; it resets naturally on close (unmount).
 */
function PickerRoot({ picker }: { picker: PickerOpenState }): JSX.Element {
  const [query, setQuery] = useState('');
  return picker.view === 'compact' ? (
    <CompactPicker picker={picker} query={query} setQuery={setQuery} />
  ) : (
    <BrowsePicker picker={picker} query={query} setQuery={setQuery} />
  );
}

export function InsertPicker(): JSX.Element | null {
  const picker = useStudio((s) => s.picker);
  if (picker === null) return null;
  return <PickerRoot picker={picker} />;
}
