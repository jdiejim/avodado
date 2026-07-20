/**
 * Home — the studio's landing surface, a front page for the project's docs:
 * a searchable card grid (most recently edited first), a dashed "New doc"
 * card that opens the template picker, and a shortcut into Site mode.
 * Clicking a card opens the doc in Edit; hovering reveals a Present action.
 */

import { useMemo, useState } from 'react';
import { useStudio } from '../state/store.js';
import { IconDoc, IconPlus, IconSearch } from './Icons.js';
import { TemplatePicker } from './TemplatePicker.js';

/** `mtimeMs` → a compact "edited …" phrase. */
export function editedAgo(mtimeMs: number, now = Date.now()): string {
  const s = Math.max(0, Math.floor((now - mtimeMs) / 1000));
  if (s < 60) return 'edited just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `edited ${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `edited ${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `edited ${d}d ago`;
  return `edited ${new Date(mtimeMs).toLocaleDateString()}`;
}

export function HomeView(): JSX.Element {
  const docs = useStudio((s) => s.docs);
  const meta = useStudio((s) => s.meta);
  const openDoc = useStudio((s) => s.openDoc);
  const setMode = useStudio((s) => s.setMode);
  const [query, setQuery] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  const q = query.trim().toLowerCase();
  const shown = useMemo(() => {
    const sorted = [...docs].sort((a, b) => b.mtimeMs - a.mtimeMs);
    if (q === '') return sorted;
    return sorted.filter(
      (d) => d.title.toLowerCase().includes(q) || d.slug.toLowerCase().includes(q),
    );
  }, [docs, q]);

  const open = (slug: string, mode: 'edit' | 'present'): void => {
    void openDoc(slug).then(() => setMode(mode));
  };

  return (
    <div className="stu-home">
      <header className="stu-home-hd">
        <div>
          <h1 className="stu-home-title">Your docs</h1>
          <p className="stu-home-sub">
            {docs.length} document{docs.length === 1 ? '' : 's'} in{' '}
            <code>{meta?.docsDir ?? 'docs'}/</code> — the files stay the source of truth
          </p>
        </div>
        <div className="stu-home-tools">
          <label className="stu-home-search">
            <IconSearch size={14} />
            <input
              type="text"
              placeholder="Find a doc…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <button type="button" className="stu-btn" onClick={() => setMode('site')}>
            Browse the site
          </button>
        </div>
      </header>

      <div className="stu-home-grid">
        <button type="button" className="stu-home-card stu-home-new" onClick={() => setPickerOpen(true)}>
          <span className="stu-home-new-icon">
            <IconPlus size={18} />
          </span>
          <span className="stu-home-card-title">New doc</span>
          <span className="stu-home-card-slug">from a template — ADR, API spec, runbook…</span>
        </button>
        {shown.map((d) => (
          <div key={d.slug} className="stu-home-card" role="button" tabIndex={0}
            onClick={() => open(d.slug, 'edit')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                open(d.slug, 'edit');
              }
            }}
          >
            <span className="stu-home-card-icon">
              <IconDoc size={16} />
            </span>
            <span className="stu-home-card-title">{d.title}</span>
            <span className="stu-home-card-slug">{d.slug}</span>
            <span className="stu-home-card-meta">{editedAgo(d.mtimeMs)}</span>
            <span className="stu-home-card-actions">
              <button
                type="button"
                className="stu-home-card-act"
                onClick={(e) => {
                  e.stopPropagation();
                  open(d.slug, 'present');
                }}
              >
                Present
              </button>
            </span>
          </div>
        ))}
        {shown.length === 0 && q !== '' && (
          <div className="stu-home-none">No docs match “{query}”</div>
        )}
      </div>
      {pickerOpen && <TemplatePicker onClose={() => setPickerOpen(false)} />}
    </div>
  );
}
