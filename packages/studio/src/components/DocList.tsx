/**
 * "All documents" — the rail's root selection: every doc as a card with a
 * thumbnail of its first structural block (name · folder · edited · check
 * status), most recently edited first. Clicking a card opens it in Edit.
 * With no docs at all, an empty-state hero offers the template picker.
 *
 * Status shows errors only ("✓ pass" / "N errors") — warnings never block
 * publish, so they never change a doc's status. The count comes from the
 * doc-list payload (`errorCount`, server-computed with an mtime cache); the
 * open doc uses the live in-editor diagnostics instead.
 */

import { useMemo, useState } from 'react';
import { parseDocument } from 'chiltepin-core';
import { renderDocumentSegments } from 'chiltepin-render';
import { useDerived, useStudio } from '../state/store.js';
import { docCheckStatus } from '../lib/checkView.js';
import { docFolder, editedAgo } from '../lib/docList.js';
import { DocCard } from './DocCard.js';
import { IconDoc } from './Icons.js';
import { TemplatePicker } from './TemplatePicker.js';

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
      {picker !== null && <TemplatePicker initial={picker} onClose={() => setPicker(null)} />}
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
  // The docskin stylesheet for the card thumbnails — the canvas injects its
  // own only once a document is open, and the home grid comes first.
  const skinCss = useMemo(() => renderDocumentSegments(parseDocument('', 'home-skin')).css, []);

  if (docs.length === 0) return <EmptyState docsDir={docsDir} />;

  const open = (slug: string): void => {
    void openDoc(slug);
    setMode('edit');
  };

  return (
    <div className="stu-doclist">
      <style>{skinCss}</style>
      <div className="stu-doclist-inner stu-doclist-inner-wide">
        <div className="stu-doclist-grid">
          {sorted.map((d) => (
            <DocCard
              key={d.slug}
              doc={d}
              folder={docFolder(d.slug, docsDir)}
              edited={editedAgo(d.mtimeMs)}
              status={docCheckStatus(d, { slug: currentSlug, errors: liveErrors })}
              onOpen={() => open(d.slug)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
