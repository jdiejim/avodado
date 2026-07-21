/**
 * The single strip of chrome: wordmark + doc switcher + the Edit|Site|Present
 * mode switch on the left; save-state chip, autosave toggle, theme picker,
 * and undo/redo on the right. Everything else in the app is canvas (or, in
 * Site/Present mode, an iframe).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { themes, type ThemeName } from '@avodado/render';
import markUrl from '../assets/mark.png';
import { changesSummary } from '../state/changes.js';
import { exportDeckHtml, exportDocHtml, exportPdf, exportPptx } from '../lib/export.js';
import { useDerived, useStudio } from '../state/store.js';
import {
  IconCheck,
  IconChevronDown,
  IconDoc,
  IconExport,
  IconLibrary,
  IconPalette,
  IconPlus,
  IconRedo,
  IconSearch,
  IconUndo,
} from './Icons.js';
import { TemplatePicker } from './TemplatePicker.js';
import { ThemeGenerator } from './ThemeGenerator.js';

function SaveChip(): JSX.Element {
  const dirty = useStudio((s) => s.dirty);
  const saving = useStudio((s) => s.saving);
  const conflict = useStudio((s) => s.conflict);
  const savedAt = useStudio((s) => s.savedAt);
  const currentSlug = useStudio((s) => s.currentSlug);
  const autosave = useStudio((s) => s.autosave);
  const savedSource = useStudio((s) => s.savedSource);
  const source = useStudio((s) => s.source);
  const save = useStudio((s) => s.save);
  // Only the manual-save chip needs the summary — skip the parse entirely in
  // autosave mode so typing never pays for it.
  const manual = !autosave && dirty && conflict === null && !saving;
  const changeCount = useMemo(
    () =>
      manual && currentSlug !== null ? changesSummary(savedSource, source, currentSlug).length : 0,
    [manual, savedSource, source, currentSlug],
  );

  if (currentSlug === null) return <span className="stu-chip stu-chip-muted">No doc</span>;
  if (conflict !== null) return <span className="stu-chip stu-chip-conflict">Conflict</span>;
  if (saving) return <span className="stu-chip stu-chip-editing">Saving…</span>;
  if (dirty && !autosave) {
    // Manual-save mode: the chip is the save button — it opens the review.
    return (
      <button
        type="button"
        className="stu-chip stu-chip-editing stu-chip-action"
        title="Review and apply changes (⌘S)"
        onClick={() => void save()}
      >
        Unsaved{changeCount > 0 ? ` · ${changeCount} change${changeCount === 1 ? '' : 's'}` : ''}
      </button>
    );
  }
  if (dirty) return <span className="stu-chip stu-chip-editing">Editing…</span>;
  return (
    <span
      className="stu-chip stu-chip-saved"
      title={savedAt !== null ? new Date(savedAt).toLocaleTimeString() : undefined}
    >
      <IconCheck size={10} />
      Saved
    </span>
  );
}

function DocSwitcher(): JSX.Element {
  const docs = useStudio((s) => s.docs);
  const currentSlug = useStudio((s) => s.currentSlug);
  const openDoc = useStudio((s) => s.openDoc);
  const { doc } = useDerived();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const title = doc.meta?.title ?? currentSlug ?? 'No document';

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent): void => {
      if (rootRef.current !== null && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      // Focus after the popover paints.
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered =
    q === ''
      ? docs
      : docs.filter(
          (d) => d.title.toLowerCase().includes(q) || d.slug.toLowerCase().includes(q),
        );

  return (
    <div className="stu-switcher" ref={rootRef}>
      <button
        type="button"
        className="stu-switcher-btn"
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={currentSlug ?? undefined}
      >
        <span className="stu-switcher-title">{title}</span>
        <span className={`stu-switcher-caret ${open ? 'stu-switcher-caret-open' : ''}`}>
          <IconChevronDown size={12} />
        </span>
      </button>
      {open && (
        <div className="stu-switcher-pop">
          <div className="stu-switcher-search">
            <IconSearch size={13} />
            <input
              ref={searchRef}
              type="text"
              placeholder="Find a doc…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filtered.length > 0 && filtered[0] !== undefined) {
                  void openDoc(filtered[0].slug);
                  setOpen(false);
                }
              }}
            />
          </div>
          <ul className="stu-switcher-list" role="listbox">
            {filtered.map((d) => (
              <li key={d.slug}>
                <button
                  type="button"
                  role="option"
                  aria-selected={d.slug === currentSlug}
                  className={`stu-switcher-item ${d.slug === currentSlug ? 'stu-switcher-item-active' : ''}`}
                  onClick={() => {
                    void openDoc(d.slug);
                    setOpen(false);
                  }}
                >
                  <span className="stu-switcher-item-icon">
                    <IconDoc size={13} />
                  </span>
                  <span className="stu-switcher-item-text">
                    <span className="stu-switcher-item-title">{d.title}</span>
                    <span className="stu-switcher-item-slug">{d.slug}</span>
                  </span>
                  {d.slug === currentSlug && (
                    <span className="stu-switcher-item-check">
                      <IconCheck size={12} />
                    </span>
                  )}
                </button>
              </li>
            ))}
            {filtered.length === 0 && <li className="stu-switcher-none">No matching docs</li>}
          </ul>
          <div className="stu-switcher-foot">
            <button
              type="button"
              className="stu-switcher-add"
              onClick={() => {
                setOpen(false);
                setPickerOpen(true);
              }}
            >
              <IconPlus size={13} />
              New doc
            </button>
          </div>
        </div>
      )}
      {pickerOpen && <TemplatePicker onClose={() => setPickerOpen(false)} />}
    </div>
  );
}


/** Opens the Block Library — the browsable gallery of every block type. */
function LibraryButton(): JSX.Element {
  const openLibrary = useStudio((s) => s.openLibrary);
  return (
    <button
      type="button"
      className="stu-libbtn"
      title="Browse all block types"
      onClick={openLibrary}
    >
      <IconLibrary size={13} />
      Library
    </button>
  );
}

/**
 * The Export dropdown — the current doc (unsaved edits included) as a
 * downloadable HTML page, slide deck, or PDF. HTML and slides render here in
 * the browser; PDF is produced by the file bridge via headless Chromium, so it
 * shows a busy state (the first PDF export downloads Chromium and is slow).
 */
function ExportMenu(): JSX.Element {
  const currentSlug = useStudio((s) => s.currentSlug);
  const theme = useStudio((s) => s.theme);
  const themeVars = useStudio((s) => s.themeVars);
  const toast = useStudio((s) => s.toast);
  const { doc } = useDerived();
  const [open, setOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pptxBusy, setPptxBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent): void => {
      if (rootRef.current !== null && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const slug = currentSlug ?? 'document';
  const doHtml = (): void => {
    exportDocHtml(doc, slug, theme, themeVars);
    toast('Exported HTML page', 'info');
    setOpen(false);
  };
  const doSlides = (): void => {
    exportDeckHtml(doc, slug, theme, themeVars);
    toast('Exported slide deck', 'info');
    setOpen(false);
  };
  const doPdf = async (): Promise<void> => {
    setPdfBusy(true);
    try {
      await exportPdf(doc, slug, theme, themeVars);
      toast('Exported PDF', 'info');
      setOpen(false);
    } catch (err) {
      toast(`PDF export failed: ${(err as Error).message}`, 'error');
    } finally {
      setPdfBusy(false);
    }
  };
  const doPptx = async (): Promise<void> => {
    setPptxBusy(true);
    try {
      await exportPptx(doc, slug, theme, themeVars);
      toast('Exported PowerPoint deck', 'info');
      setOpen(false);
    } catch (err) {
      toast(`PowerPoint export failed: ${(err as Error).message}`, 'error');
    } finally {
      setPptxBusy(false);
    }
  };

  return (
    <div className="stu-export" ref={rootRef}>
      <button
        type="button"
        className="stu-libbtn"
        disabled={currentSlug === null}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Export this document"
        onClick={() => setOpen(!open)}
      >
        <IconExport size={13} />
        Export
        <IconChevronDown size={11} />
      </button>
      {open && (
        <div className="stu-export-pop" role="menu">
          <button type="button" role="menuitem" className="stu-export-item" onClick={doHtml}>
            HTML page
          </button>
          <button type="button" role="menuitem" className="stu-export-item" onClick={doSlides}>
            Slide deck (HTML)
          </button>
          <button
            type="button"
            role="menuitem"
            className="stu-export-item"
            disabled={pdfBusy}
            onClick={() => void doPdf()}
          >
            {pdfBusy ? 'Exporting PDF…' : 'PDF'}
          </button>
          <button
            type="button"
            role="menuitem"
            className="stu-export-item"
            disabled={pptxBusy}
            onClick={() => void doPptx()}
          >
            {pptxBusy ? 'Exporting PowerPoint…' : 'PowerPoint (.pptx)'}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Present — a primary action, not a mode to remember: shows the current doc
 * as a slide deck. Toggled by ⇧⌘P; Esc returns to editing.
 */
function PresentButton(): JSX.Element {
  const mode = useStudio((s) => s.mode);
  const setMode = useStudio((s) => s.setMode);
  const presenting = mode === 'present';
  return (
    <button
      type="button"
      className={`stu-libbtn stu-present ${presenting ? 'stu-present-on' : ''}`}
      title={presenting ? 'Back to editing (Esc)' : 'Present this doc as slides (⇧⌘P)'}
      onClick={() => setMode(presenting ? 'edit' : 'present')}
    >
      ▶ Present
    </button>
  );
}

/** Opens the built docs site in its own tab — it's a website, not a mode. */
function SiteLink(): JSX.Element {
  const currentSlug = useStudio((s) => s.currentSlug);
  const home = useStudio((s) => s.mode) === 'home';
  const href = !home && currentSlug !== null ? `/site/${currentSlug}.html` : '/site/';
  return (
    <a className="stu-libbtn" href={href} target="_blank" rel="noreferrer" title="Open the built site in a new tab">
      Site ↗
    </a>
  );
}

/**
 * The theme picker: the six built-ins, plus every installed (saved) theme
 * from `/api/meta`, plus a "custom" entry when avodado.theme.json holds
 * unmatched overrides. Its value mirrors what's on disk on load and after
 * every disk change; picking here is a session-local preview only.
 */
function ThemePicker(): JSX.Element {
  const themeChoice = useStudio((s) => s.themeChoice);
  const setTheme = useStudio((s) => s.setTheme);
  const meta = useStudio((s) => s.meta);
  const saved = meta?.savedThemes ?? [];
  const showCustom = meta?.active?.kind === 'custom' || themeChoice === 'custom';
  return (
    <select
      className="stu-select"
      data-tour="theme"
      value={themeChoice}
      onChange={(e) => setTheme(e.target.value)}
      title="Theme"
      aria-label="Theme"
    >
      {(Object.keys(themes) as ThemeName[]).map((t) => (
        <option key={t} value={t}>
          {themes[t].label}
        </option>
      ))}
      {saved.map((t) => (
        <option key={`saved:${t.slug}`} value={`saved:${t.slug}`}>
          {t.name}
        </option>
      ))}
      {showCustom && <option value="custom">{meta?.active?.name ?? 'Project theme'}</option>}
    </select>
  );
}

export function TopBar(): JSX.Element {
  const autosave = useStudio((s) => s.autosave);
  const setAutosave = useStudio((s) => s.setAutosave);
  const undo = useStudio((s) => s.undo);
  const redo = useStudio((s) => s.redo);
  const canUndo = useStudio((s) => s.undoStack.length > 0);
  const canRedo = useStudio((s) => s.redoStack.length > 0);
  const [themeGenOpen, setThemeGenOpen] = useState(false);
  // Home is the front page: doc-editing chrome (switcher, save state,
  // autosave, export, undo) is noise there — show only the global controls.
  const home = useStudio((s) => s.mode) === 'home';

  return (
    <>
    <header className="stu-topbar" data-tour="topbar">
      <button
        type="button"
        className="stu-wordmark"
        title="Home — all docs"
        onClick={() => useStudio.getState().setMode('home')}
      >
        <img src={markUrl} alt="" className="stu-wordmark-dot" aria-hidden="true" />
        avodado <em>studio</em>
      </button>
      {!home && <DocSwitcher />}
      <LibraryButton />
      <span className="stu-spacer" />
      {!home && (
        <span className="stu-savewrap" data-tour="save">
          <SaveChip />
        </span>
      )}
      {!home && (
        <label className="stu-autosave" data-tour="autosave">
          <input type="checkbox" checked={autosave} onChange={(e) => setAutosave(e.target.checked)} />
          <span className="stu-switch" aria-hidden="true" />
          Autosave
        </label>
      )}
      <ThemePicker />
      <button
        type="button"
        className="stu-libbtn"
        title="Generate a custom theme"
        onClick={() => setThemeGenOpen(true)}
      >
        <IconPalette size={13} />
        Theme
      </button>
      <SiteLink />
      {!home && <ExportMenu />}
      {!home && <PresentButton />}
      {!home && (
      <div className="stu-btngroup">
        <button
          type="button"
          className="stu-iconbtn"
          disabled={!canUndo}
          onClick={undo}
          title="Undo (⌘Z)"
          aria-label="Undo"
        >
          <IconUndo />
        </button>
        <button
          type="button"
          className="stu-iconbtn"
          disabled={!canRedo}
          onClick={redo}
          title="Redo (⇧⌘Z)"
          aria-label="Redo"
        >
          <IconRedo />
        </button>
      </div>
      )}
    </header>
    {themeGenOpen && <ThemeGenerator onClose={() => setThemeGenOpen(false)} />}
    </>
  );
}
