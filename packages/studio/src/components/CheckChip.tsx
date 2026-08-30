/**
 * The top bar's check chips + their anchored results popovers:
 *
 * - {@link CheckChip} (a doc is open) — the live `avo check` of the open doc.
 *   The chip shows the error count (or a quiet pass); clicking it opens the
 *   popover: one row per diagnostic (severity border, mono code, message,
 *   line, hint) with "Open field →" jumping to the block and its offending
 *   field in the Edit Sheet. Diagnostics are LIVE — they re-run on every
 *   edit; there is nothing to re-run by hand.
 * - {@link HomeCheckChip} (the All-documents view) — the aggregate: per-doc
 *   `errorCount`s summed into "N errors" / "✓ pass"; its popover lists the
 *   failing docs (name + count), each row opening that doc.
 *
 * Esc / outside click closes; no scrim. Errors block publish; warnings never do.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { buildCheckRows, docCheckStatus, type CheckRow } from '../lib/checkView.js';
import { countLevels } from '../lib/segDiagnostics.js';
import { useDerived, useStudio } from '../state/store.js';
import { IconCheck } from './Icons.js';

/** Popover dismissal shared by both chips: outside click or Esc. No scrim. */
function usePopDismiss(
  open: boolean,
  rootRef: React.RefObject<HTMLDivElement>,
  close: () => void,
): void {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent): void => {
      if (rootRef.current !== null && !rootRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open, rootRef, close]);
}

function Row({ row, onOpen }: { row: CheckRow; onOpen: (row: CheckRow) => void }): JSX.Element {
  return (
    <div className={`stu-checkrow stu-checkrow-${row.level}`}>
      <span className="stu-checkrow-code">{row.code}</span>
      <span className="stu-checkrow-msg">
        {row.message}
        {row.line !== null && <span className="stu-checkrow-line"> · line {row.line}</span>}
        {row.hint !== null && <span className="stu-checkrow-hint">{row.hint}</span>}
      </span>
      {row.segIndex !== null && (
        <button type="button" className="stu-checkrow-open" onClick={() => onOpen(row)}>
          {row.segKind === 'markdown' ? 'Open block →' : 'Open field →'}
        </button>
      )}
    </div>
  );
}

export function CheckChip(): JSX.Element {
  const source = useStudio((s) => s.source);
  const { doc, diagnostics } = useDerived();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  usePopDismiss(open, rootRef, () => setOpen(false));

  const { errors, warnings } = countLevels(diagnostics);
  const rows = useMemo(
    () => (open ? buildCheckRows(source, doc, diagnostics) : []),
    [open, source, doc, diagnostics],
  );

  const openRow = (row: CheckRow): void => {
    setOpen(false);
    if (row.segIndex === null) return;
    const s = useStudio.getState();
    if (row.segKind === 'markdown') {
      // Prose has no sheet — select the block and bring it into view.
      s.select(row.segIndex);
      document
        .querySelector(`[data-seg="${row.segIndex}"]`)
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    s.openSheet(row.segIndex, false, row.field ?? undefined);
  };

  const chipLabel =
    errors > 0 ? `${errors} error${errors === 1 ? '' : 's'}` : 'pass';

  return (
    <div className="stu-checkwrap" ref={rootRef}>
      <button
        type="button"
        className={`stu-checkchip ${errors > 0 ? 'stu-checkchip-err' : 'stu-checkchip-ok'}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={errors > 0 ? `${chipLabel} — click for details` : 'avo check passes — click for details'}
        onClick={() => setOpen(!open)}
      >
        {errors === 0 && <IconCheck size={10} />}
        {chipLabel}
        <span className="stu-checkchip-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <div className="stu-checkpop" role="dialog" aria-label="Check results">
          <span className="stu-checkpop-caret" aria-hidden="true" />
          <header className="stu-checkpop-head">
            <b>avo check</b>
            {errors > 0 && (
              <span className="stu-checkpop-chip stu-checkpop-chip-err">
                {errors} error{errors === 1 ? '' : 's'}
              </span>
            )}
            {warnings > 0 && (
              <span className="stu-checkpop-chip stu-checkpop-chip-warn">
                {warnings} warning{warnings === 1 ? '' : 's'}
              </span>
            )}
            {errors === 0 && warnings === 0 && (
              <span className="stu-checkpop-chip stu-checkpop-chip-ok">✓ pass</span>
            )}
          </header>
          <div className="stu-checkpop-rows">
            {rows.length === 0 ? (
              <div className="stu-checkpop-empty">No issues — this doc publishes clean.</div>
            ) : (
              rows.map((r, i) => <Row key={i} row={r} onOpen={openRow} />)
            )}
          </div>
          <footer className="stu-checkpop-foot">
            <span>Errors block publish · warnings never do</span>
            <span className="stu-checkpop-ran">checked live</span>
          </footer>
        </div>
      )}
    </div>
  );
}

/**
 * The All-documents view's AGGREGATE chip: per-doc `errorCount`s (server-
 * computed; the open doc uses the live in-editor diagnostics) summed into
 * one "N errors" / "✓ pass". Its popover lists the failing docs — clicking
 * a row opens that doc in Edit. Renders nothing when the server predates
 * `errorCount` (every status unknown) or there are no docs.
 */
export function HomeCheckChip(): JSX.Element | null {
  const docs = useStudio((s) => s.docs);
  const currentSlug = useStudio((s) => s.currentSlug);
  const { diagnostics } = useDerived();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  usePopDismiss(open, rootRef, () => setOpen(false));

  const liveErrors = diagnostics.filter((d) => d.level === 'error').length;
  const statuses = useMemo(
    () =>
      docs.map((d) => ({
        doc: d,
        status: docCheckStatus(d, { slug: currentSlug, errors: liveErrors }),
      })),
    [docs, currentSlug, liveErrors],
  );
  const known = statuses.some((s) => s.status.kind !== 'unknown');
  if (docs.length === 0 || !known) return null;

  const failing = statuses.filter(
    (s): s is { doc: (typeof docs)[number]; status: { kind: 'errors'; count: number } } =>
      s.status.kind === 'errors',
  );
  const total = failing.reduce((sum, f) => sum + f.status.count, 0);

  const openRow = (slug: string): void => {
    setOpen(false);
    const s = useStudio.getState();
    void s.openDoc(slug);
    s.setMode('edit');
  };

  const chipLabel = total > 0 ? `${total} error${total === 1 ? '' : 's'}` : 'pass';
  return (
    <div className="stu-checkwrap" ref={rootRef}>
      <button
        type="button"
        className={`stu-checkchip ${total > 0 ? 'stu-checkchip-err' : 'stu-checkchip-ok'}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={
          total > 0
            ? `${failing.length} doc${failing.length === 1 ? '' : 's'} failing — click for the list`
            : 'avo check passes across all docs'
        }
        onClick={() => setOpen(!open)}
      >
        {total === 0 && <IconCheck size={10} />}
        {chipLabel}
        <span className="stu-checkchip-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <div className="stu-checkpop" role="dialog" aria-label="Check results, all documents">
          <span className="stu-checkpop-caret" aria-hidden="true" />
          <header className="stu-checkpop-head">
            <b>avo check</b>
            {total > 0 ? (
              <span className="stu-checkpop-chip stu-checkpop-chip-err">
                {total} error{total === 1 ? '' : 's'} · {failing.length} doc
                {failing.length === 1 ? '' : 's'}
              </span>
            ) : (
              <span className="stu-checkpop-chip stu-checkpop-chip-ok">✓ pass</span>
            )}
          </header>
          <div className="stu-checkpop-rows">
            {failing.length === 0 ? (
              <div className="stu-checkpop-empty">All documents publish clean.</div>
            ) : (
              failing.map((f) => (
                <button
                  key={f.doc.slug}
                  type="button"
                  className="stu-checkpop-docrow"
                  title={f.doc.slug}
                  onClick={() => openRow(f.doc.slug)}
                >
                  <span className="stu-checkpop-docname">{f.doc.title}</span>
                  <span className="stu-checkpop-doccount">
                    {f.status.count} error{f.status.count === 1 ? '' : 's'}
                  </span>
                </button>
              ))
            )}
          </div>
          <footer className="stu-checkpop-foot">
            <span>Errors block publish · warnings never do</span>
            <span className="stu-checkpop-ran">checked live</span>
          </footer>
        </div>
      )}
    </div>
  );
}
