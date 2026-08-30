/**
 * The single top bar over the canvas: breadcrumb (folder / doc title) on the
 * left; check chip, Share ▾ (link · exports · site), Theme, Present, and ONE
 * Save button with a plain save-status text on the right. Navigation lives in
 * the left rail; autosave lives in the rail's Settings.
 *
 * Narrow windows (≤820px) keep the check chip and Save visible and fold
 * Library / Share / Theme / Present behind a ⋯ overflow menu (CSS-gated —
 * both sets render; the media query shows one).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { changesSummary } from '../state/changes.js';
import { hasServer } from '../api/client.js';
import { exportDeckHtml, exportDocHtml, exportPdf, exportPptx } from '../lib/export.js';
import { docFolder, editedAgo } from '../lib/docList.js';
import { buildShareUrl, SHARE_LIMIT } from '../lib/shareLink.js';
import { useDerived, useStudio } from '../state/store.js';
import { CheckChip, HomeCheckChip } from './CheckChip.js';
import { IconChevronDown, IconLibrary, IconPalette } from './Icons.js';
import { ThemePanel } from './ThemePanel.js';

/** Opens the Block Library — the browsable gallery of every block type. */
function LibraryButton(): JSX.Element {
  const openLibrary = useStudio((s) => s.openLibrary);
  return (
    <button type="button" className="stu-libbtn" title="Browse all block types" onClick={openLibrary}>
      <IconLibrary size={13} />
      Library
    </button>
  );
}

/** Popover dismissal shared by the top bar's menus: outside click or Esc. */
function useMenuDismiss(
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

/**
 * The share/export menu items — everything that takes the doc elsewhere:
 * copy a share link (page or deck), export it (HTML / slides / PDF /
 * PowerPoint), or open the built site. ONE implementation, rendered by both
 * the wide bar's Share ▾ popover and the narrow ⋯ overflow menu; handlers
 * are unchanged from the old ShareButton / ExportMenu / SiteLink trio.
 * `onDone` closes the owning popover after an action.
 */
function ShareItems({ onDone }: { onDone: () => void }): JSX.Element {
  const currentSlug = useStudio((s) => s.currentSlug);
  const theme = useStudio((s) => s.theme);
  const themeVars = useStudio((s) => s.themeVars);
  const toast = useStudio((s) => s.toast);
  const { doc } = useDerived();
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pptxBusy, setPptxBusy] = useState(false);

  const share = async (present: boolean): Promise<void> => {
    const { source, docs, currentSlug: slug } = useStudio.getState();
    const title = docs.find((d) => d.slug === slug)?.title;
    try {
      const url = await buildShareUrl(window.location.href.split(/[?#]/)[0] ?? '/', source, {
        present,
        ...(title !== undefined ? { title } : {}),
      });
      if (url.length > SHARE_LIMIT) {
        toast('This document is too big to share as a link — export it instead', 'error');
        return;
      }
      await navigator.clipboard.writeText(url);
      toast(present ? 'Deck link copied' : 'Share link copied', 'info');
      onDone();
    } catch (err) {
      toast(`Could not build a share link: ${(err as Error).message}`, 'error');
    }
  };

  const slug = currentSlug ?? 'document';
  const doHtml = (): void => {
    exportDocHtml(doc, slug, theme, themeVars);
    toast('Exported HTML page', 'info');
    onDone();
  };
  const doSlides = (): void => {
    exportDeckHtml(doc, slug, theme, themeVars);
    toast('Exported slide deck', 'info');
    onDone();
  };
  const doPdf = async (): Promise<void> => {
    setPdfBusy(true);
    try {
      await exportPdf(doc, slug, theme, themeVars);
      toast('Exported PDF', 'info');
      onDone();
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
      onDone();
    } catch (err) {
      toast(`PowerPoint export failed: ${(err as Error).message}`, 'error');
    } finally {
      setPptxBusy(false);
    }
  };

  return (
    <>
      <button type="button" role="menuitem" className="stu-export-item" onClick={() => void share(false)}>
        Copy link
      </button>
      <button type="button" role="menuitem" className="stu-export-item" onClick={() => void share(true)}>
        Copy deck link
      </button>
      <div className="stu-export-sep" role="separator" />
      <button type="button" role="menuitem" className="stu-export-item" onClick={doHtml}>
        Export HTML page
      </button>
      <button type="button" role="menuitem" className="stu-export-item" onClick={doSlides}>
        Export slide deck
      </button>
      {/* PDF and PowerPoint render in Chromium behind the local server;
          the hosted studio hides them rather than offering failure. */}
      {hasServer && (
        <>
          <button
            type="button"
            role="menuitem"
            className="stu-export-item"
            disabled={pdfBusy}
            onClick={() => void doPdf()}
          >
            {pdfBusy ? 'Exporting PDF…' : 'Export PDF'}
          </button>
          <button
            type="button"
            role="menuitem"
            className="stu-export-item"
            disabled={pptxBusy}
            onClick={() => void doPptx()}
          >
            {pptxBusy ? 'Exporting PowerPoint…' : 'Export PowerPoint'}
          </button>
          <div className="stu-export-sep" role="separator" />
          <a
            className="stu-export-item"
            role="menuitem"
            href={currentSlug !== null ? `/site/${currentSlug}.html` : '/site/'}
            target="_blank"
            rel="noreferrer"
            onClick={onDone}
          >
            Open site ↗
          </a>
        </>
      )}
    </>
  );
}

/** Share ▾ — the wide bar's entry to {@link ShareItems}. */
function ShareMenu(): JSX.Element {
  const currentSlug = useStudio((s) => s.currentSlug);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useMenuDismiss(open, rootRef, () => setOpen(false));

  return (
    <div className="stu-export" ref={rootRef}>
      <button
        type="button"
        className="stu-libbtn"
        disabled={currentSlug === null}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Share, export, or open the site"
        onClick={() => setOpen(!open)}
      >
        Share
        <IconChevronDown size={11} />
      </button>
      {open && (
        <div className="stu-export-pop" role="menu">
          <ShareItems onDone={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

/**
 * ⋯ — the narrow bar's overflow menu (CSS shows it only ≤820px): Library /
 * Theme / Present as menu rows, then the same share/export items. The check
 * chip and Save never fold — they stay on the bar itself.
 */
function OverflowMenu({ onTheme }: { onTheme: () => void }): JSX.Element {
  const mode = useStudio((s) => s.mode);
  const setMode = useStudio((s) => s.setMode);
  const openLibrary = useStudio((s) => s.openLibrary);
  const currentSlug = useStudio((s) => s.currentSlug);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useMenuDismiss(open, rootRef, () => setOpen(false));

  const onDoc = mode !== 'home' && currentSlug !== null;

  return (
    <div className="stu-export stu-topbar-more" ref={rootRef}>
      <button
        type="button"
        className="stu-libbtn stu-morebtn"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        title="More actions"
        onClick={() => setOpen(!open)}
      >
        ⋯
      </button>
      {open && (
        <div className="stu-export-pop" role="menu">
          {mode === 'edit' && (
            <button
              type="button"
              role="menuitem"
              className="stu-export-item"
              onClick={() => {
                setOpen(false);
                openLibrary();
              }}
            >
              Block library
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className="stu-export-item"
            onClick={() => {
              setOpen(false);
              onTheme();
            }}
          >
            Theme…
          </button>
          {onDoc && (
            <button
              type="button"
              role="menuitem"
              className="stu-export-item"
              onClick={() => {
                setOpen(false);
                setMode(mode === 'present' ? 'edit' : 'present');
              }}
            >
              {mode === 'present' ? 'Back to editing' : '▶ Present'}
            </button>
          )}
          {onDoc && (
            <>
              <div className="stu-export-sep" role="separator" />
              <ShareItems onDone={() => setOpen(false)} />
            </>
          )}
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

/**
 * ONE Save button + a plain status text. The button always routes through
 * `save()` — with autosave off and edits pending, that opens the review
 * dialog (unchanged); conflicts keep their ConflictBanner.
 */
function SaveControls(): JSX.Element {
  const dirty = useStudio((s) => s.dirty);
  const saving = useStudio((s) => s.saving);
  const conflict = useStudio((s) => s.conflict);
  const savedAt = useStudio((s) => s.savedAt);
  const autosave = useStudio((s) => s.autosave);
  const currentSlug = useStudio((s) => s.currentSlug);
  const savedSource = useStudio((s) => s.savedSource);
  const source = useStudio((s) => s.source);
  const save = useStudio((s) => s.save);
  // Before the first in-session save, the doc's on-disk mtime seeds the
  // status text ("saved 6d ago") — the meta is never blank on an open doc.
  const mtimeMs = useStudio(
    (s) => s.docs.find((d) => d.slug === s.currentSlug)?.mtimeMs ?? null,
  );

  // Manual mode surfaces the pending change count on the status text — same
  // computation the old SaveChip did, still skipped entirely under autosave.
  const manual = !autosave && dirty && conflict === null && !saving;
  const changeCount = useMemo(
    () =>
      manual && currentSlug !== null ? changesSummary(savedSource, source, currentSlug).length : 0,
    [manual, savedSource, source, currentSlug],
  );

  const meta =
    conflict !== null
      ? 'conflict'
      : saving
        ? 'saving…'
        : dirty
          ? changeCount > 0
            ? `${changeCount} unsaved change${changeCount === 1 ? '' : 's'}`
            : 'unsaved changes'
          : savedAt !== null
            ? `saved ${editedAgo(savedAt)}`
            : mtimeMs !== null
              ? `saved ${editedAgo(mtimeMs)}`
              : '';

  return (
    <span className="stu-savewrap" data-tour="save">
      <button
        type="button"
        className="stu-btn stu-btn-primary stu-savebtn"
        disabled={currentSlug === null || saving}
        title={autosave ? 'Save now (⌘S)' : 'Review and apply changes (⌘S)'}
        onClick={() => void save()}
      >
        Save
      </button>
      <span className="stu-savemeta">{meta}</span>
    </span>
  );
}

/** Breadcrumb: `All documents · N` on the list, `folder / title` on a doc. */
function Crumb(): JSX.Element {
  const mode = useStudio((s) => s.mode);
  const docs = useStudio((s) => s.docs);
  const currentSlug = useStudio((s) => s.currentSlug);
  const docsDir = useStudio((s) => s.meta?.docsDir ?? 'docs');
  const { doc } = useDerived();
  if (mode === 'home' || currentSlug === null) {
    return (
      <span className="stu-crumb">
        <b>All documents</b>
        {docs.length > 0 && (
          <>
            {' · '}
            <span className="stu-num">{docs.length}</span>
          </>
        )}
      </span>
    );
  }
  const title = doc.meta?.title ?? currentSlug;
  return (
    <span className="stu-crumb" title={currentSlug}>
      {docFolder(currentSlug, docsDir)} / <b>{title}</b>
    </span>
  );
}

export function TopBar(): JSX.Element {
  const [themeOpen, setThemeOpen] = useState(false);
  const mode = useStudio((s) => s.mode);
  const currentSlug = useStudio((s) => s.currentSlug);
  const onDoc = mode !== 'home' && currentSlug !== null;

  return (
    <>
      <header className="stu-topbar" data-tour="topbar">
        <Crumb />
        <span className="stu-spacer" />
        {onDoc && <CheckChip />}
        {/* All-documents view: the AGGREGATE chip (per-doc errorCounts). */}
        {mode === 'home' && <HomeCheckChip />}
        {/* Wide-only controls: ≤820px they fold behind the ⋯ overflow menu. */}
        <div className="stu-topbar-wide">
          {mode === 'edit' && <LibraryButton />}
          {onDoc && <ShareMenu />}
          <button
            type="button"
            className={`stu-libbtn ${themeOpen ? 'stu-themebtn-on' : ''}`}
            data-tour="theme"
            title="Theme"
            aria-expanded={themeOpen}
            onClick={() => setThemeOpen(!themeOpen)}
          >
            <IconPalette size={13} />
            Theme
          </button>
          {onDoc && <PresentButton />}
        </div>
        {onDoc && <SaveControls />}
        <OverflowMenu onTheme={() => setThemeOpen(true)} />
      </header>
      {themeOpen && <ThemePanel onClose={() => setThemeOpen(false)} />}
    </>
  );
}
