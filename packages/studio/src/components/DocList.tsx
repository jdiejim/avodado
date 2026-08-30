/**
 * "All documents" — the rail's root selection: every doc as a table row
 * (name · folder · edited · check status), most recently edited first.
 * Clicking a row opens it in Edit. With no docs at all, an empty-state hero
 * offers the template picker directly.
 *
 * The Status column shows errors only ("✓ pass" / "N errors") — warnings
 * never block publish, so they never change a doc's status. The count comes
 * from the doc-list payload (`errorCount`, server-computed with an mtime
 * cache); the open doc uses the live in-editor diagnostics instead.
 */

import { useMemo, useState } from 'react';
import { useDerived, useStudio } from '../state/store.js';
import { docCheckStatus, type DocCheckStatus } from '../lib/checkView.js';
import { docFolder, editedAgo } from '../lib/docList.js';
import { IconDoc } from './Icons.js';
import { TemplatePicker } from './TemplatePicker.js';

/** The Status cell: quiet pass, filled error chip, or nothing (old server). */
function StatusChip({ status }: { status: DocCheckStatus }): JSX.Element {
  // An empty cell keeps the grid columns aligned when the count is unknown.
  if (status.kind === 'unknown') return <span aria-hidden="true" />;
  if (status.kind === 'errors') {
    return (
      <span className="stu-doclist-status stu-doclist-status-err">
        {status.count} error{status.count === 1 ? '' : 's'}
      </span>
    );
  }
  return <span className="stu-doclist-status stu-doclist-status-ok">✓ pass</span>;
}

/** The empty state's quick-start templates: real ids from DOC_TEMPLATES. */
const STARTER_CHIPS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'system-design', label: 'system design' },
  { id: 'adr', label: 'ADR' },
  { id: 'api-spec', label: 'API spec' },
  { id: 'postmortem', label: 'postmortem' },
  { id: 'blank', label: 'blank' },
];

function EmptyState({ docsDir }: { docsDir: string }): JSX.Element {
  const [picker, setPicker] = useState<string | null>(null);
  return (
    <div className="stu-doclist-empty">
      <div className="stu-doclist-empty-inner">
        <div className="stu-doclist-empty-icon">
          <IconDoc size={26} />
        </div>
        <div className="stu-doclist-empty-title">No documents yet</div>
        <p className="stu-doclist-empty-sub">
          Every doc is a Markdown file in <code>{docsDir}/</code>. Start from a template — delete
          what you don&rsquo;t need.
        </p>
        <button
          type="button"
          className="stu-btn stu-btn-primary"
          onClick={() => setPicker('blank')}
        >
          Create your first doc
        </button>
        <div className="stu-doclist-empty-chips">
          {STARTER_CHIPS.map((c) => (
            <button
              key={c.id}
              type="button"
              className="stu-doclist-empty-chip"
              onClick={() => setPicker(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      {picker !== null && (
        <TemplatePicker initial={picker} onClose={() => setPicker(null)} />
      )}
    </div>
  );
}

export function DocList(): JSX.Element {
  const docs = useStudio((s) => s.docs);
  const meta = useStudio((s) => s.meta);
  const currentSlug = useStudio((s) => s.currentSlug);
  const openDoc = useStudio((s) => s.openDoc);
  const setMode = useStudio((s) => s.setMode);
  const { diagnostics } = useDerived();

  const docsDir = meta?.docsDir ?? 'docs';
  const liveErrors = diagnostics.filter((d) => d.level === 'error').length;
  const sorted = useMemo(() => [...docs].sort((a, b) => b.mtimeMs - a.mtimeMs), [docs]);

  if (docs.length === 0) return <EmptyState docsDir={docsDir} />;

  const open = (slug: string): void => {
    void openDoc(slug);
    setMode('edit');
  };

  return (
    <div className="stu-doclist">
      <div className="stu-doclist-inner">
        <div className="stu-doclist-table">
          <div className="stu-doclist-head" aria-hidden="true">
            <span>Document</span>
            <span>Folder</span>
            <span>Edited</span>
            <span>Status</span>
            <span />
          </div>
          {sorted.map((d) => (
            <button
              key={d.slug}
              type="button"
              className="stu-doclist-row"
              title={d.slug}
              onClick={() => open(d.slug)}
            >
              <span className="stu-doclist-name">{d.title}</span>
              <span className="stu-doclist-folder">{docFolder(d.slug, docsDir)}</span>
              <span className="stu-doclist-edited stu-num">{editedAgo(d.mtimeMs)}</span>
              <StatusChip status={docCheckStatus(d, { slug: currentSlug, errors: liveErrors })} />
              <span className="stu-doclist-chev">›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
