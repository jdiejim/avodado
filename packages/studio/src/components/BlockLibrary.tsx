/**
 * The Block Library: a full-screen gallery of every insertable block — family
 * sections of thumbnail cards with a search (labels, slugs, descriptions AND
 * alias spellings) and family pills — plus a second-layer detail dialog with
 * a full-size rendered preview, the YAML starter template, and an
 * "Insert into doc" action.
 *
 * It is an OVERLAY, not a mode: it opens over Edit/Site/Present alike (store
 * flag `library`); only inserting requires Edit, so Insert switches back.
 * Keyboard: search is autofocused; ⇥ reaches the roving card, ←↑↓→ move
 * between cards, ⏎ opens the detail, esc walks back out. Focus is trapped
 * while open and restored on close.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { BLOCK_FAMILIES, parseDocument } from '@avodado/core';
import { renderDocumentSegments } from '@avodado/render';
import { insertBlockAt } from '../lib/actions.js';
import {
  aliasPatchSummary,
  hitInsertBody,
  insertGapIndex,
  isRoveKey,
  libraryView,
  roveIndex,
  type FamilyFilter,
  type LibraryHit,
} from '../lib/libraryEngine.js';
import { buildBlockSource, previewBlock } from '../lib/blockPreview.js';
import { derive, docSurface } from '../state/derive.js';
import { useStudio } from '../state/store.js';
import { IconClose, IconDuplicate, IconLibrary, IconSearch } from './Icons.js';
import { Thumb } from './Thumb.js';

/** Family id → label (pills for families with no current matches need it). */
const FAMILY_LABELS: ReadonlyMap<string, string> = new Map(
  BLOCK_FAMILIES.map((f) => [f.id, f.label]),
);

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

function LibraryCard({ hit, index, roving, onOpen, onRove }: {
  hit: LibraryHit;
  index: number;
  roving: boolean;
  onOpen: (hit: LibraryHit) => void;
  onRove: (index: number) => void;
}): JSX.Element {
  return (
    <button
      type="button"
      className="stu-card stu-lib-card"
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
      {hit.alias !== undefined && <span className="stu-lib-also">also: {hit.alias}</span>}
    </button>
  );
}

function DetailDialog({ hit, canInsert, onClose, onInsert }: {
  hit: LibraryHit;
  /** False when no doc is open — the Insert button disables. */
  canInsert: boolean;
  onClose: () => void;
  onInsert: (hit: LibraryHit) => void;
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
      className="stu-lib-detail-backdrop"
      onMouseDown={(e) => {
        if (rootRef.current !== null && !rootRef.current.contains(e.target as Node)) onClose();
      }}
    >
      <div
        className="stu-lib-detail"
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
        <header className="stu-lib-detail-head">
          <div className="stu-lib-detail-title">
            <h3>{hit.item.label}</h3>
            <span className="stu-card-type">{hit.item.type}</span>
            <span className="stu-lib-detail-fam">{hit.item.familyLabel}</span>
          </div>
          <button type="button" className="stu-lib-x" aria-label="Close details" onClick={onClose}>
            <IconClose size={13} />
          </button>
        </header>
        <p className="stu-lib-detail-desc">{hit.item.description}</p>
        {hit.alias !== undefined && (
          <p className="stu-lib-detail-alias">
            also answers to: <code>{hit.alias}</code>
            {aliasPatchSummary(hit.alias) !== '' && (
              <> — inserts as <code>{aliasPatchSummary(hit.alias)}</code></>
            )}
          </p>
        )}
        <div className="stu-lib-detail-body">
          <div className="stu-lib-pane stu-lib-pane-preview">
            <div className="stu-lib-pane-label">Preview</div>
            <div className="stu-lib-preview" data-doc-theme={docSurface(theme, themeVars)}>
              {preview.html !== '' ? (
                <div
                  className="docskin stu-lib-preview-doc"
                  dangerouslySetInnerHTML={{ __html: preview.html }}
                />
              ) : (
                <div className="stu-lib-preview-blank">{hit.item.type}</div>
              )}
            </div>
          </div>
          <div className="stu-lib-pane stu-lib-pane-yaml">
            <div className="stu-lib-pane-label">
              Template
              <button type="button" className="stu-lib-copy" onClick={copy}>
                <IconDuplicate size={12} />
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre className="stu-lib-yaml" tabIndex={0}>{snippet}</pre>
          </div>
        </div>
        <footer className="stu-lib-detail-foot">
          <span className="stu-lib-detail-hint">⏎ insert · esc back to the gallery</span>
          <button type="button" className="stu-btn" onClick={onClose}>
            Close
          </button>
          <button
            ref={insertRef}
            type="button"
            className="stu-btn stu-btn-primary"
            disabled={!canInsert}
            title={canInsert ? 'Insert after the selected block (or at the end)' : 'Open a doc first'}
            onClick={() => onInsert(hit)}
          >
            Insert into doc
          </button>
        </footer>
      </div>
    </div>
  );
}

function LibraryOverlay(): JSX.Element {
  const closeLibrary = useStudio((s) => s.closeLibrary);
  const currentSlug = useStudio((s) => s.currentSlug);
  const theme = useStudio((s) => s.theme);
  const themeVars = useStudio((s) => s.themeVars);
  const [query, setQuery] = useState('');
  const [family, setFamily] = useState<FamilyFilter>('all');
  const [detail, setDetail] = useState<LibraryHit | null>(null);
  const [focusIdx, setFocusIdx] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const detailRef = useRef<LibraryHit | null>(null);
  detailRef.current = detail;

  const view = useMemo(() => libraryView(query, family), [query, family]);
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
    const r = renderDocumentSegments(parseDocument('', 'library-skin'), {
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
        closeLibrary();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [closeLibrary]);

  const openDetail = (hit: LibraryHit): void => setDetail(hit);

  const closeDetail = (): void => {
    setDetail(null);
    requestAnimationFrame(() => focusCard(focusIdxRef.current));
  };

  const insert = (hit: LibraryHit): void => {
    const s = useStudio.getState();
    if (s.currentSlug === null) return;
    const { doc } = derive(s.source, s.currentSlug, s.theme, s.themeVars);
    const index = insertGapIndex(s.selection, doc.segments.length);
    // Inserting is an EDIT action: leave Site/Present first, then close the
    // overlay and run the normal empty-template flow (sheet opens fresh).
    if (s.mode !== 'edit') s.setMode('edit');
    s.closeLibrary();
    insertBlockAt(index, hit.item.type, hitInsertBody(hit));
  };

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
      className={`stu-lib-pill ${family === id ? 'stu-lib-pill-active' : ''} ${count === 0 ? 'stu-lib-pill-empty' : ''}`}
      aria-pressed={family === id}
      onClick={() => setFamily(family === id ? 'all' : id)}
    >
      {label}
      <span className="stu-lib-pill-count">{count}</span>
    </button>
  );

  return (
    <div className="stu-lib-backdrop">
      <div
        className="stu-lib"
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
        <style>{`.stu-lib .docskin{${skin.vars}}`}</style>
        <header className="stu-lib-head">
          <div className="stu-lib-title">
            <span className="stu-lib-title-icon">
              <IconLibrary size={16} />
            </span>
            <h2>Block library</h2>
            <span className="stu-lib-title-count">· {view.total} blocks</span>
            <button
              type="button"
              className="stu-lib-x"
              aria-label="Close the block library"
              onClick={closeLibrary}
            >
              <IconClose size={14} />
            </button>
          </div>
          <div className="stu-lib-search">
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
            <span className="stu-lib-showing" aria-live="polite">
              Showing {view.shown} of {view.total}
            </span>
          </div>
          <div className="stu-lib-pills" role="group" aria-label="Filter by family">
            {pillLabel('all', 'All', view.matched)}
            {[...view.familyCounts].map(([id, count]) =>
              pillLabel(id, FAMILY_LABELS.get(id) ?? id, count),
            )}
          </div>
        </header>
        <div className="stu-lib-body" onKeyDown={onGridKeyDown}>
          {flat.length === 0 ? (
            <div className="stu-lib-none">
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
                  <section key={g.family} className="stu-lib-fam" aria-label={g.label}>
                    <div className="stu-lib-famhead">
                      {g.label}
                      <span className="stu-insert-count">{g.hits.length}</span>
                    </div>
                    <div className="stu-cardgrid stu-lib-grid">
                      {g.hits.map((hit, i) => (
                        <LibraryCard
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

/** Mounts the gallery while the store's `library` flag is up. */
export function BlockLibrary(): JSX.Element | null {
  const open = useStudio((s) => s.library);
  if (!open) return null;
  return <LibraryOverlay />;
}
