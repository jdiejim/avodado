/**
 * The OpenAPI-import confirm dialog: "Create <slug>.md from this OpenAPI
 * spec?" with the slug prefilled from the spec's `info.title`. Confirming
 * generates the doc (core's `openapiToMarkdown`, client-side) and opens it
 * via the store's normal newDoc path; Esc / Cancel discards. Armed by
 * `lib/importActions.ts` through `store.pendingImport`.
 */

import { useEffect, useRef, useState } from 'react';
import { useStudio } from '../state/store.js';
import { IconImport } from './Icons.js';

export function ImportConfirm(): JSX.Element | null {
  const pending = useStudio((s) => s.pendingImport);
  const confirmImport = useStudio((s) => s.confirmImport);
  const cancelImport = useStudio((s) => s.cancelImport);
  const [slug, setSlug] = useState('');
  const slugRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const open = pending !== null;

  useEffect(() => {
    if (pending !== null) {
      setSlug(pending.defaultSlug);
      requestAnimationFrame(() => slugRef.current?.select());
    }
  }, [pending]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        cancelImport();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, cancelImport]);

  if (pending === null) return null;

  const create = (): void => {
    const clean = slug.trim().replace(/\.md$/, '');
    if (clean === '') {
      slugRef.current?.focus();
      return;
    }
    confirmImport(clean);
  };

  return (
    <div
      className="stu-sheet-backdrop"
      onMouseDown={(e) => {
        if (rootRef.current !== null && !rootRef.current.contains(e.target as Node)) {
          cancelImport();
        }
      }}
    >
      <div
        className="stu-import"
        ref={rootRef}
        role="dialog"
        aria-modal="true"
        aria-label="Create a doc from an OpenAPI spec"
      >
        <div className="stu-import-head">
          <span className="stu-import-glyph">
            <IconImport size={15} />
          </span>
          <h2>Import OpenAPI spec</h2>
        </div>
        <p className="stu-import-text">
          Create <code>{slug.trim() === '' ? pending.defaultSlug : slug.trim()}.md</code> from{' '}
          <strong>{pending.title}</strong>? The doc gets a cover, an endpoint table, one sequence
          diagram per endpoint, and an ERD of the schemas.
        </p>
        <input
          ref={slugRef}
          className="stu-import-slug"
          type="text"
          aria-label="Doc slug"
          placeholder="slug, e.g. api/orders"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              create();
            }
          }}
        />
        <div className="stu-import-foot">
          <span className="stu-import-hint">Enter creates · Esc cancels</span>
          <button type="button" className="stu-btn" onClick={cancelImport}>
            Cancel
          </button>
          <button type="button" className="stu-btn stu-btn-primary" onClick={create}>
            Create doc
          </button>
        </div>
      </div>
    </div>
  );
}
