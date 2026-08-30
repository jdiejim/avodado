/**
 * The persistent left rail — the app's one navigation surface: brand, doc
 * search, the single "New doc" entry, the "All documents" root view, and the
 * project's docs grouped by folder. Footer: Site ↗ (when a server is behind
 * the docs) and Settings (autosave lives there now, out of the top bar).
 *
 * Narrow windows (≤820px) collapse the rail to a 52px icon strip; the search
 * icon (or ⌘K) opens the full rail as a temporary drawer over the canvas.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import markUrl from '../assets/mark.png';
import { hasServer } from '../api/client.js';
import { docCheckStatus } from '../lib/checkView.js';
import { groupDocs } from '../lib/docList.js';
import { useDerived, useStudio } from '../state/store.js';
import { IconGrid, IconPlus, IconSearch } from './Icons.js';
import { TemplatePicker } from './TemplatePicker.js';

function SettingsPop({ onClose }: { onClose: () => void }): JSX.Element {
  const autosave = useStudio((s) => s.autosave);
  const setAutosave = useStudio((s) => s.setAutosave);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      if (rootRef.current !== null && !rootRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [onClose]);

  return (
    <div className="stu-rail-settings" ref={rootRef} role="dialog" aria-label="Settings">
      <div className="stu-rail-settings-title">Settings</div>
      <label className="stu-autosave" data-tour="autosave">
        <input
          type="checkbox"
          checked={autosave}
          onChange={(e) => setAutosave(e.target.checked)}
        />
        <span className="stu-switch" aria-hidden="true" />
        Autosave
      </label>
      <p className="stu-rail-settings-hint">
        Off: ⌘S reviews every change before it touches the disk.
      </p>
    </div>
  );
}

export function Rail(): JSX.Element {
  const docs = useStudio((s) => s.docs);
  const meta = useStudio((s) => s.meta);
  const mode = useStudio((s) => s.mode);
  const currentSlug = useStudio((s) => s.currentSlug);
  const openDoc = useStudio((s) => s.openDoc);
  const setMode = useStudio((s) => s.setMode);
  const { diagnostics } = useDerived();
  const [query, setQuery] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  /** Narrow-width drawer: the full rail shown over the canvas. */
  const [drawer, setDrawer] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLElement>(null);

  const docsDir = meta?.docsDir ?? 'docs';
  // Per-doc error dots: the OPEN doc uses the live in-editor diagnostics
  // (they track unsaved edits); every other doc uses the errorCount the
  // doc-list payload carries (absent on older servers → no dot).
  const liveErrors = diagnostics.filter((d) => d.level === 'error').length;

  // The doc-search logic DocSwitcher/HomeView used: title or slug contains.
  const q = query.trim().toLowerCase();
  const groups = useMemo(() => {
    const filtered =
      q === ''
        ? docs
        : docs.filter(
            (d) => d.title.toLowerCase().includes(q) || d.slug.toLowerCase().includes(q),
          );
    return groupDocs(filtered, docsDir);
  }, [docs, q, docsDir]);

  // ⌘K focuses the doc search (and opens the drawer on narrow widths).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setDrawer(true);
        requestAnimationFrame(() => searchRef.current?.focus());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // The drawer dismisses like a popover: click outside or Esc.
  useEffect(() => {
    if (!drawer) return;
    const onDown = (e: MouseEvent): void => {
      if (rootRef.current !== null && !rootRef.current.contains(e.target as Node)) {
        setDrawer(false);
      }
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setDrawer(false);
      }
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [drawer]);

  const goHome = (): void => {
    setDrawer(false);
    setMode('home');
  };

  const openRow = (slug: string): void => {
    setDrawer(false);
    void openDoc(slug);
    if (useStudio.getState().mode !== 'edit') setMode('edit');
  };

  const siteHref =
    mode !== 'home' && currentSlug !== null ? `/site/${currentSlug}.html` : '/site/';

  return (
    <nav
      className={`stu-rail ${drawer ? 'stu-rail-drawer' : ''}`}
      aria-label="Documents"
      ref={rootRef}
      data-tour="rail"
    >
      {/* 52px icon strip — the whole rail on narrow windows (CSS-gated). */}
      <div className="stu-rail-mini" aria-hidden={drawer}>
        <button type="button" className="stu-rail-mini-mark" title="All documents" onClick={goHome}>
          <img src={markUrl} alt="" />
        </button>
        <button
          type="button"
          className="stu-rail-mini-btn"
          title="Search docs (⌘K)"
          onClick={() => {
            setDrawer(true);
            requestAnimationFrame(() => searchRef.current?.focus());
          }}
        >
          <IconSearch size={15} />
        </button>
        <button
          type="button"
          className={`stu-rail-mini-btn ${mode === 'home' ? 'stu-rail-mini-on' : ''}`}
          title="All documents"
          onClick={goHome}
        >
          <IconGrid size={15} />
        </button>
        <button
          type="button"
          className="stu-rail-mini-btn"
          title="New doc"
          onClick={() => setPickerOpen(true)}
        >
          <IconPlus size={15} />
        </button>
      </div>

      <div className="stu-rail-full">
        <button type="button" className="stu-rail-brand" title="All documents" onClick={goHome}>
          <img src={markUrl} alt="" className="stu-rail-mark" aria-hidden="true" />
          <span className="stu-rail-name">
            avodado <em>studio</em>
          </span>
        </button>

        <label className={`stu-rail-search ${docs.length === 0 ? 'stu-rail-search-off' : ''}`}>
          <IconSearch size={13} />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search docs"
            aria-label="Search docs"
            disabled={docs.length === 0}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              const first = groups[0]?.docs[0];
              if (e.key === 'Enter' && q !== '' && first !== undefined) openRow(first.slug);
            }}
          />
          <kbd>⌘K</kbd>
        </label>

        <button type="button" className="stu-rail-new" onClick={() => setPickerOpen(true)}>
          <IconPlus size={12} />
          New doc
        </button>

        <button
          type="button"
          className={`stu-rail-doc stu-rail-root ${mode === 'home' ? 'stu-rail-doc-on' : ''}`}
          onClick={goHome}
        >
          <IconGrid size={14} />
          <span className="stu-rail-doc-name">All documents</span>
        </button>

        <div className="stu-rail-scroll">
          {groups.map((g) => (
            <div key={g.key === '' ? '.' : g.key}>
              <div className="stu-rail-group">
                <span>{g.label}</span>
                <span className="stu-num">{g.docs.length}</span>
              </div>
              {g.docs.map((d) => {
                const on = mode !== 'home' && d.slug === currentSlug;
                return (
                  <button
                    key={d.slug}
                    type="button"
                    className={`stu-rail-doc ${on ? 'stu-rail-doc-on' : ''}`}
                    title={d.slug}
                    onClick={() => openRow(d.slug)}
                  >
                    <span className="stu-rail-doc-name">{d.title}</span>
                    {docCheckStatus(d, { slug: currentSlug, errors: liveErrors }).kind ===
                      'errors' && <span className="stu-rail-dot" aria-label="has errors" />}
                  </button>
                );
              })}
            </div>
          ))}
          {q !== '' && groups.length === 0 && (
            <div className="stu-rail-none">No matching docs</div>
          )}
        </div>

        <div className="stu-rail-foot">
          {hasServer && (
            <a href={siteHref} target="_blank" rel="noreferrer" title="Open the built site in a new tab">
              Site ↗
            </a>
          )}
          <div className="stu-rail-foot-settings">
            <button type="button" onClick={() => setSettingsOpen(!settingsOpen)}>
              Settings
            </button>
            {settingsOpen && <SettingsPop onClose={() => setSettingsOpen(false)} />}
          </div>
        </div>
      </div>

      {pickerOpen && <TemplatePicker onClose={() => setPickerOpen(false)} />}
    </nav>
  );
}
