/**
 * The Edit Sheet — ONE component, presented per width (CSS + container):
 *
 * - Wide (>820px): a right-DOCKED inspector panel below the top bar, full
 *   height, beside the still-visible canvas (the live document IS the
 *   preview — the selected card updates on Done and keeps its ring). The
 *   block preview pane is collapsed by default; the header's Preview button
 *   toggles it open inside the panel.
 * - Narrow (≤820px): the bottom-sheet presentation over a scrim, form
 *   stacked above the always-visible preview.
 *
 * The form pane is schema-driven (or the raw YAML tab); the preview
 * re-renders through the real pipeline on every field commit (debounced on
 * keystrokes).
 *
 * Draft semantics: the sheet edits a copy of the block's YAML body. The
 * document is untouched until Done — ONE applyOp, one undo step, one
 * autosave. Cancel/Esc discards the draft.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  deleteYamlPath,
  setYamlPath,
  BLOCK_FAMILIES,
  BLOCK_FAMILY,
  BLOCK_LABELS,
  type Diagnostic,
  type TypedSegment,
} from '@avodado/core';
import { DirectLayer } from '../direct/DirectLayer.js';
import type { DirectHost } from '../direct/host.js';
import { mapDiagnosticsToFields, previewBlock } from '../lib/blockPreview.js';
import { docSurface } from '../state/derive.js';
import { useDerived, useStudio } from '../state/store.js';
import { emitTourAction } from '../tour/bus.js';
import { FormTab, type RevealRequest, type YamlPath } from './FormTab.js';

const PREVIEW_DEBOUNCE_MS = 250;

function DiagStrip({ diags }: { diags: readonly Diagnostic[] }): JSX.Element | null {
  if (diags.length === 0) return null;
  return (
    <div className="stu-sheet-diags">
      {diags.map((d, i) => (
        <div key={i} className={`stu-diag stu-diag-${d.level}`}>
          <span className="stu-diag-code">{d.code}</span>
          <div className="stu-diag-msg">{d.message}</div>
          {d.hint !== undefined && <div className="stu-diag-hint">{d.hint}</div>}
        </div>
      ))}
    </div>
  );
}

function SheetInner({ seg, revealField }: {
  seg: TypedSegment;
  /** Top-level YAML field to reveal on mount (from the check popover). */
  revealField: string | null;
}): JSX.Element {
  const theme = useStudio((s) => s.theme);
  const themeVars = useStudio((s) => s.themeVars);
  const closeSheet = useStudio((s) => s.closeSheet);
  const commitSheet = useStudio((s) => s.commitSheet);
  const setSheetDirty = useStudio((s) => s.setSheetDirty);
  const fresh = useStudio((s) => s.sheetFresh);

  const [draft, setDraft] = useState(seg.raw);
  /** What the preview renders — trails `draft` by a debounce on keystrokes. */
  const [previewRaw, setPreviewRaw] = useState(seg.raw);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dirty = draft !== seg.raw;
  useEffect(() => {
    setSheetDirty(dirty);
  }, [dirty, setSheetDirty]);
  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    },
    [],
  );

  /** Structural commit: draft + preview update immediately. The ref updates
   *  synchronously so several commits in one tick compose correctly. */
  const commitDraft = (next: string): void => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    draftRef.current = next;
    setDraft(next);
    setPreviewRaw(next);
  };

  /** Keystroke staging: preview refresh debounced. */
  const scheduleRefresh = (compute: () => string): void => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      try {
        setPreviewRaw(compute());
      } catch {
        /* a half-typed value that setYamlPath rejects — preview keeps the last good state */
      }
    }, PREVIEW_DEBOUNCE_MS);
  };

  // The draft parsed/validated/rendered as a one-block doc.
  const parsed = useMemo(
    () => previewBlock(seg.kind, draft, theme, themeVars),
    [seg.kind, draft, theme, themeVars],
  );
  const preview = useMemo(
    () =>
      previewRaw === draft ? parsed : previewBlock(seg.kind, previewRaw, theme, themeVars),
    [seg.kind, previewRaw, draft, parsed, theme, themeVars],
  );

  const parseError = parsed.seg?.parseError;
  const [tab, setTab] = useState<'form' | 'yaml'>(parseError !== undefined ? 'yaml' : 'form');
  /**
   * Wide/docked only: whether the in-panel preview pane is open (the canvas
   * beside the panel is the primary preview). CSS ignores this at ≤820px —
   * the bottom sheet always shows the pane.
   */
  const [previewOpen, setPreviewOpen] = useState(false);
  useEffect(() => {
    if (parseError !== undefined) setTab('yaml');
  }, [parseError]);

  const { byField, rest } = useMemo(
    () => mapDiagnosticsToFields(draft, parsed.diagnostics),
    [draft, parsed.diagnostics],
  );

  const done = (): void => {
    // Emit BEFORE the store updates so the tour advances off the sheet step
    // ahead of its sheet-closed break detection.
    emitTourAction('sheet-done');
    // Commit whatever field is mid-edit (its blur handler runs synchronously),
    // then read the ref — the `draft` state is one tick behind.
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
    const cur = draftRef.current;
    if (cur === seg.raw) closeSheet(true);
    else commitSheet(cur);
  };
  const cancel = (): void => closeSheet();

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      // The review dialog (⌘S with autosave off) floats above the sheet and
      // owns Esc/⏎ while open — don't tear the sheet down underneath it.
      if (useStudio.getState().review !== null) return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (e.key === 'Escape') {
        // An open combobox owns Esc (revert + close list) — and so do the
        // floating popovers (grid cell details, the preview micro-editor):
        // Esc closes THEM, not the sheet under them.
        if (target !== null && target.closest('[data-combo-open="true"]') !== null) return;
        if (document.querySelector('.stu-grid-pop, .stu-sheet .stu-dx-pop') !== null) return;
        e.stopPropagation();
        cancel();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        // Asymmetry: in an array-row TEXTAREA, ⌘⏎ advances the row instead
        // (the FormTab row handler owns it). Everywhere else it is Done.
        if (target?.tagName === 'TEXTAREA' && target.closest('.stu-item-fields') !== null) return;
        e.preventDefault();
        done();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [draft, dirty]);

  const commitPath = (path: YamlPath, value: unknown): void => {
    commitDraft(setYamlPath(draftRef.current, path, value));
    // Scalar commits are real typing (structural seeds commit objects/arrays)
    // — that's the "fill a field" action the tour advances on.
    if (typeof value !== 'object' || value === null) emitTourAction('field-commit');
  };
  const deletePath = (path: YamlPath): void => {
    commitDraft(deleteYamlPath(draftRef.current, path));
  };
  const stagePath = (path: YamlPath, value: unknown): void => {
    scheduleRefresh(() => setYamlPath(draftRef.current, path, value));
  };

  /* ---- direct editing inside the preview (always on) ---- */
  const formRef = useRef<HTMLDivElement>(null);
  const previewWrapRef = useRef<HTMLDivElement>(null);
  /** Path of the form field under the pointer → highlighted in the preview. */
  const [linkPath, setLinkPath] = useState<string | null>(null);
  /** Preview click → reveal (expand/scroll/flash/focus) the matching form field. */
  const [reveal, setReveal] = useState<RevealRequest | null>(
    revealField !== null ? { path: revealField, n: 1 } : null,
  );
  const revealSeq = useRef(revealField !== null ? 1 : 0);
  // The store's reveal request is one-shot: consume it so commits (which
  // remount this component — seg.raw is in the key) don't replay the flash.
  useEffect(() => {
    if (useStudio.getState().sheetReveal !== null) useStudio.setState({ sheetReveal: null });
  }, []);

  const previewHost = useMemo<DirectHost>(
    () => ({
      kind: seg.kind,
      commitPath: (path, value) => commitDraft(setYamlPath(draftRef.current, path, value)),
      commitPaths: (sets) => {
        let raw = draftRef.current;
        for (const s of sets) raw = setYamlPath(raw, s.path, s.value);
        commitDraft(raw);
      },
      deletePath: (path) => commitDraft(deleteYamlPath(draftRef.current, path)),
      openFull: () => setTab('yaml'),
      notify: (message) => useStudio.getState().toast(message),
    }),
    [seg.kind],
  );

  /** Longest `data-field-path` in the form pane matching (a prefix of) `path`. */
  const findFormField = (path: string): HTMLElement | null => {
    const pane = formRef.current;
    if (pane === null) return null;
    let best: HTMLElement | null = null;
    let bestLen = -1;
    for (const el of Array.from(pane.querySelectorAll<HTMLElement>('[data-field-path]'))) {
      const p = el.getAttribute('data-field-path') ?? '';
      if ((path === p || path.startsWith(`${p}.`)) && p.length > bestLen) {
        best = el;
        bestLen = p.length;
      }
    }
    return best;
  };

  /** Preview click on a tagged element: jump the form to it. */
  const onPreviewElementClick = (path: string): boolean => {
    if (tab !== 'form') return false;
    if (findFormField(path) === null) return false; // opaque → micro-editor fallback
    setReveal({ path, n: ++revealSeq.current });
    return true;
  };

  // After a reveal request re-renders the form (array items auto-expand),
  // scroll to the deepest matching field, flash it, and focus its control.
  useEffect(() => {
    if (reveal === null) return;
    const t = setTimeout(() => {
      const el = findFormField(reveal.path);
      if (el === null) return;
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.classList.add('stu-field-flash');
      el.querySelector<HTMLElement>('input, textarea, select')?.focus({ preventScroll: true });
      setTimeout(() => el.classList.remove('stu-field-flash'), 1400);
    }, 60);
    return () => clearTimeout(t);
  }, [reveal]);

  /** Delegated form-field hover → preview highlight. */
  const onFormOver = (e: React.MouseEvent): void => {
    const el = (e.target as HTMLElement).closest('[data-field-path]');
    setLinkPath(el !== null ? el.getAttribute('data-field-path') : null);
  };

  /** Keyboard parity: focusing a field (Tab/⏎ flow) lights its preview twin. */
  const onFormFocus = (e: React.FocusEvent): void => {
    const el = (e.target as HTMLElement).closest('[data-field-path]');
    if (el !== null) setLinkPath(el.getAttribute('data-field-path'));
  };

  const family = BLOCK_FAMILIES.find((f) => f.id === BLOCK_FAMILY[seg.kind]);

  return (
    <div
      className="stu-sheet-backdrop"
      onMouseDown={(e) => {
        // Backdrop click closes only a pristine sheet — never eats edits.
        if (e.target === e.currentTarget && !dirty) cancel();
      }}
    >
      <div className="stu-sheet" role="dialog" aria-modal="true" aria-label={`Edit ${BLOCK_LABELS[seg.kind]}`}>
        <header className="stu-sheet-head">
          <div className="stu-sheet-title">
            <h2>{BLOCK_LABELS[seg.kind]}</h2>
            <span className="stu-kind-chip">{seg.kind}</span>
            <span className="stu-family-label">{family?.label ?? ''}</span>
          </div>
          <div className="stu-tabs stu-sheet-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'form'}
              className={`stu-tab ${tab === 'form' ? 'stu-tab-active' : ''}`}
              onClick={() => setTab('form')}
              disabled={parseError !== undefined}
            >
              Form
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'yaml'}
              className={`stu-tab ${tab === 'yaml' ? 'stu-tab-active' : ''}`}
              onClick={() => setTab('yaml')}
            >
              YAML
            </button>
          </div>
          <div className="stu-sheet-actions">
            <button
              type="button"
              className="stu-btn stu-sheet-prevbtn"
              aria-pressed={previewOpen}
              title={previewOpen ? 'Hide the in-panel preview' : 'Show a preview of this block in the panel'}
              onClick={() => setPreviewOpen(!previewOpen)}
            >
              Preview
            </button>
            <button type="button" className="stu-btn" onClick={cancel}>
              Cancel
            </button>
            <button type="button" className="stu-btn stu-btn-primary" onClick={done}>
              Done
            </button>
          </div>
        </header>
        <div className="stu-sheet-body">
          <div
            className="stu-sheet-form"
            ref={formRef}
            onMouseOver={onFormOver}
            onMouseLeave={() => setLinkPath(null)}
            onFocusCapture={onFormFocus}
          >
            {tab === 'form' && parsed.seg !== undefined ? (
              <>
                <FormTab
                  seg={parsed.seg}
                  fresh={fresh}
                  commitPath={commitPath}
                  deletePath={deletePath}
                  stagePath={stagePath}
                  openYaml={() => setTab('yaml')}
                  fieldDiags={byField}
                  reveal={reveal}
                />
                <DiagStrip diags={rest} />
              </>
            ) : (
              <div className="stu-sheet-yaml">
                {parseError !== undefined && (
                  <div className="stu-diag stu-diag-error">
                    <span className="stu-diag-code">YAML</span>
                    <div className="stu-diag-msg">{parseError}</div>
                  </div>
                )}
                <textarea
                  className="stu-yaml-editor"
                  value={draft}
                  onChange={(e) => {
                    const next = e.target.value;
                    setDraft(next);
                    scheduleRefresh(() => next);
                  }}
                  spellCheck={false}
                />
                <DiagStrip diags={parseError === undefined ? rest : []} />
              </div>
            )}
          </div>
          <div className={`stu-sheet-preview ${previewOpen ? 'stu-sheet-preview-open' : ''}`}>
            <span className="stu-sheet-preview-label">Preview</span>
            <div className="stu-sheet-preview-scroll">
              {preview.html !== '' ? (
                <div
                  className="stu-sheet-preview-wrap"
                  data-doc-theme={docSurface(theme, themeVars)}
                  ref={previewWrapRef}
                >
                  <div className="docskin stu-sheet-preview-doc" dangerouslySetInnerHTML={{ __html: preview.html }} />
                  <DirectLayer
                    host={previewHost}
                    data={parsed.seg?.data}
                    html={preview.html}
                    wrapperRef={previewWrapRef}
                    linkPath={linkPath}
                    onElementClick={onPreviewElementClick}
                  />
                </div>
              ) : (
                <div className="stu-sheet-preview-empty">Nothing to preview yet — fill in the fields.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Mounts the sheet whenever the store points it at a typed segment. */
export function EditSheet(): JSX.Element | null {
  const index = useStudio((s) => s.sheet);
  const revealField = useStudio((s) => s.sheetReveal);
  const { doc } = useDerived();
  const seg = index !== null ? doc.segments[index] : undefined;
  if (index === null || seg === undefined || seg.kind === 'markdown') return null;
  // raw participates in the key so an external silent refetch (only possible
  // while the draft is pristine) remounts the sheet with fresh content.
  return <SheetInner key={`${index}:${seg.kind}:${seg.raw}`} seg={seg} revealField={revealField} />;
}
