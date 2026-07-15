/**
 * Review-before-write: the modal that opens when a save happens with
 * autosave OFF (⌘S, save-chip click, or flipping autosave back ON while
 * dirty). Shows the block-level change summary from `state/changes.ts`;
 * Apply routes through the normal save path (409/conflict flow untouched),
 * Cancel keeps the doc dirty and writes nothing.
 */

import { useEffect, useMemo, useRef } from 'react';
import { BLOCK_LABELS } from '@avodado/core';
import { changesSummary, type ChangeItem } from '../state/changes.js';
import { docSurface } from '../state/derive.js';
import { useStudio } from '../state/store.js';
import { IconEdit, IconPlus, IconTrash } from './Icons.js';

function Glyph({ change }: { change: ChangeItem['change'] }): JSX.Element {
  return (
    <span className={`stu-review-glyph stu-review-glyph-${change}`} aria-hidden="true">
      {change === 'edited' && <IconEdit size={11} />}
      {change === 'added' && <IconPlus size={11} />}
      {change === 'removed' && <IconTrash size={11} />}
      {change === 'reordered' && '⇅'}
    </span>
  );
}

export function ReviewDialog(): JSX.Element | null {
  const review = useStudio((s) => s.review);
  const slug = useStudio((s) => s.currentSlug);
  const savedSource = useStudio((s) => s.savedSource);
  const source = useStudio((s) => s.source);
  const docs = useStudio((s) => s.docs);
  const theme = useStudio((s) => s.theme);
  const themeVars = useStudio((s) => s.themeVars);
  const applyReview = useStudio((s) => s.applyReview);
  const cancelReview = useStudio((s) => s.cancelReview);
  const applyRef = useRef<HTMLButtonElement>(null);
  const open = review !== null && slug !== null;

  const items = useMemo(
    () => (open ? changesSummary(savedSource, source, slug) : []),
    [open, savedSource, source, slug],
  );

  // Apply is the primary action: autofocused, ⏎ applies.
  useEffect(() => {
    if (open) requestAnimationFrame(() => applyRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cancelReview();
      } else if (e.key === 'Enter' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's')) {
        e.preventDefault();
        e.stopPropagation();
        void applyReview();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, applyReview, cancelReview]);

  if (!open) return null;
  const file = docs.find((d) => d.slug === slug)?.file ?? `${slug}.md`;

  return (
    <div
      className="stu-review-backdrop"
      data-surface={docSurface(theme, themeVars)}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) cancelReview();
      }}
    >
      <div className="stu-review" role="dialog" aria-modal="true" aria-label="Review changes">
        <header className="stu-review-head">
          <h2>
            Apply changes to <code>{file}</code>?
          </h2>
          <p className="stu-review-sub">
            {items.length === 0 ? (
              'Nothing structural changed.'
            ) : (
              <>
                <strong className="stu-review-count">
                  {items.length} change{items.length === 1 ? '' : 's'}
                </strong>{' '}
                since the last save
              </>
            )}
          </p>
        </header>
        <div className="stu-review-list">
          {items.length === 0 ? (
            <div className="stu-review-empty">Formatting-only changes (whitespace)</div>
          ) : (
            <ul>
              {items.map((it, i) => (
                <li key={i} className="stu-review-item">
                  <Glyph change={it.change} />
                  <span className="stu-review-label">{it.label}</span>
                  <span className="stu-review-kind">
                    {it.kind === 'markdown' ? 'Text' : BLOCK_LABELS[it.kind]} · {it.change}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <footer className="stu-review-foot">
          <button type="button" className="stu-btn" onClick={cancelReview}>
            Cancel
          </button>
          <button
            type="button"
            ref={applyRef}
            className="stu-btn stu-btn-primary"
            onClick={() => void applyReview()}
          >
            Apply ▸
          </button>
        </footer>
      </div>
    </div>
  );
}
