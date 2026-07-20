/**
 * Studio shell, v2 (Notion-style focus editing): a single top bar over a
 * full-width canvas. Editing happens in place (prose) or in the modal Edit
 * Sheet (typed blocks); inserting happens via the '+' gaps or the slash
 * command. Global keyboard shortcuts, SSE wiring, toasts, conflict banner.
 */

import { useEffect, useState } from 'react';
import { removeSegment } from '@avodado/core';
import { useServerEvents } from './api/events.js';
import { keySurface } from './direct/partSelect.js';
import { duplicateSegment, insertBlockAt, moveSegmentDown, moveSegmentUp } from './lib/actions.js';
import { openImportFilePicker } from './lib/importActions.js';
import { insertBodyFor } from './lib/insertEngine.js';
import { needsBlockDeleteConfirm } from './lib/confirmDelete.js';
import { isEditableTarget, shouldOpenSlash } from './lib/dom.js';
import { markSlashUsed } from './lib/prefs.js';
import { segmentLabel } from './state/changes.js';
import { derive } from './state/derive.js';
import { useDerived, useStudio } from './state/store.js';
import { BlockLibrary } from './components/BlockLibrary.js';
import { Canvas } from './components/Canvas.js';
import { HomeView } from './components/HomeView.js';
import { SiteView } from './components/SiteView.js';
import { PresentView } from './components/PresentView.js';
import { DeleteConfirm } from './components/DeleteConfirm.js';
import { EditSheet } from './components/EditSheet.js';
import { ImportConfirm } from './components/ImportConfirm.js';
import { ReviewDialog } from './components/ReviewDialog.js';
import { IconClose } from './components/Icons.js';
import { Shortcuts } from './components/Shortcuts.js';
import { SlashMenu } from './components/SlashMenu.js';
import { ConflictBanner, Toasts, UpdateToast } from './components/Toasts.js';
import { TopBar } from './components/TopBar.js';
import { TourOverlay } from './tour/TourOverlay.js';
import { useTour } from './tour/state.js';

const HINT_KEY = 'avodado-studio-hint-dismissed';

function HintBar(): JSX.Element | null {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return window.localStorage.getItem(HINT_KEY) === '1';
    } catch {
      return true;
    }
  });
  const loaded = useStudio((s) => s.loaded);
  const currentSlug = useStudio((s) => s.currentSlug);
  if (dismissed || !loaded || currentSlug === null) return null;

  const dismiss = (): void => {
    setDismissed(true);
    try {
      window.localStorage.setItem(HINT_KEY, '1');
    } catch {
      /* private mode — the bar simply returns next session */
    }
  };

  return (
    <div className="stu-hintbar" role="note">
      <span>
        Press <kbd>/</kbd> to insert a block · <kbd>↑↓</kbd> + <kbd>⏎</kbd> to edit without the
        mouse · click a diagram part to select it (<kbd>⏎</kbd> edits · arrows move) ·{' '}
        <kbd>?</kbd> shows every shortcut
      </span>
      <button
        type="button"
        className="stu-hintbar-tour"
        onClick={() => void useTour.getState().start()}
      >
        Take the 2-minute tour
      </button>
      <button type="button" aria-label="Dismiss" onClick={dismiss}>
        <IconClose size={12} />
      </button>
    </div>
  );
}

function SlashLayer({ open, setOpen }: {
  open: boolean;
  setOpen: (open: boolean) => void;
}): JSX.Element | null {
  const { doc } = useDerived();
  if (!open) return null;
  const insertIndex = (): number => {
    const sel = useStudio.getState().selection;
    return sel !== null ? sel + 1 : doc.segments.length;
  };
  return (
    <SlashMenu
      onClose={() => setOpen(false)}
      onPick={(item) => {
        setOpen(false);
        insertBlockAt(insertIndex(), item.type, insertBodyFor(item));
      }}
      onImport={() => {
        setOpen(false);
        openImportFilePicker(insertIndex());
      }}
      onLibrary={() => {
        setOpen(false);
        useStudio.getState().openLibrary();
      }}
    />
  );
}

export function App(): JSX.Element {
  const init = useStudio((s) => s.init);
  const handleServerEvent = useStudio((s) => s.handleServerEvent);
  const [slashOpen, setSlashOpen] = useState(false);

  useEffect(() => {
    void init();
  }, [init]);

  // Stale-tab guard: re-check the studio version whenever the SSE stream
  // (re)connects and whenever the window regains focus.
  useServerEvents(handleServerEvent, () => void useStudio.getState().checkVersion());
  useEffect(() => {
    const onFocus = (): void => void useStudio.getState().checkVersion();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const s = useStudio.getState();
      // The review dialog / delete popover own the keyboard while open.
      if (s.review !== null || s.pendingDelete !== null) return;
      // So does the Block Library overlay (its own Esc / arrows / focus trap).
      if (s.library) return;
      const mod = e.metaKey || e.ctrlKey;
      // ⇧⌘P toggles Present from anywhere (it's a chord — never plain typing).
      if (mod && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        s.setMode(s.mode === 'present' ? 'edit' : 'present');
        return;
      }
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void s.save();
        return;
      }
      // Site/Present: the iframe owns the surface — only Esc (back to Edit)
      // and the chords above apply; every editing shortcut stays inert.
      if (s.mode !== 'edit') {
        // Esc backs out one level: Site/Present → Edit; Home is the landing.
        if (e.key === 'Escape' && s.mode !== 'home') {
          e.preventDefault();
          s.setMode('edit');
        }
        return;
      }
      // Precedence ladder: sheet > selected part > selected block > canvas.
      const surface = keySurface({
        sheetOpen: s.sheet !== null,
        partSelected: s.partSel !== null,
        blockSelected: s.selection !== null,
      });
      // The sheet is modal: it owns Esc / ⌘⏎ via its own capture listener,
      // and its inputs own their native undo.
      if (surface === 'sheet') return;
      // Inside a field, native editing (incl. its own undo) wins.
      if (isEditableTarget(e.target)) return;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      // Part-land: the DirectLayer's capture handler owns ⏎ / arrows / ⌫ /
      // ⇥ / esc — block navigation and block delete must not fire.
      if (surface === 'part') return;
      if (shouldOpenSlash(e) && s.currentSlug !== null) {
        e.preventDefault();
        markSlashUsed();
        s.dismissSlashHint();
        setSlashOpen(true);
        return;
      }
      const sel = s.selection;
      const { doc } = derive(s.source, s.currentSlug ?? 'untitled', s.theme, s.themeVars);
      const count = doc.segments.length;
      // ⌘↑ / ⌘↓ — move the selected block (meta lock enforced by moveBlock).
      if (mod && sel !== null && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        if (e.key === 'ArrowUp') moveSegmentUp(sel);
        else moveSegmentDown(sel);
        return;
      }
      // ⌘D — duplicate the selected block (never the meta cover).
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        if (sel !== null && doc.segments[sel]?.kind !== 'meta') duplicateSegment(sel);
        return;
      }
      // ↑/↓ (and j/k) — roving block selection.
      const dir =
        e.key === 'ArrowDown' || e.key === 'j' ? 1 : e.key === 'ArrowUp' || e.key === 'k' ? -1 : 0;
      if (dir !== 0 && !mod && !e.altKey && !e.shiftKey) {
        if (count === 0) return;
        e.preventDefault();
        const next =
          sel === null
            ? dir === 1
              ? 0
              : count - 1
            : Math.min(count - 1, Math.max(0, sel + dir));
        s.select(next);
        document
          .querySelector(`[data-seg="${next}"]`)
          ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel !== null) {
        e.preventDefault();
        const seg = doc.segments[sel];
        // The meta cover is locked — keyboard delete skips it too.
        if (seg === undefined || seg.kind === 'meta') return;
        const run = (): void => {
          useStudio.getState().applyOp((src, d) => removeSegment(src, d, sel), null);
        };
        // Pristine scaffolding deletes silently; content gets the confirm.
        if (!needsBlockDeleteConfirm(seg)) {
          run();
          return;
        }
        const r = document.querySelector(`[data-seg="${sel}"]`)?.getBoundingClientRect();
        s.requestDelete({
          label: segmentLabel(seg),
          anchor:
            r !== undefined
              ? { x: r.left + r.width / 2, y: r.top + Math.min(r.height / 2, 48) }
              : { x: window.innerWidth / 2, y: 120 },
          run,
        });
        return;
      }
      if (e.key === 'Escape') s.select(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const mode = useStudio((s) => s.mode);
  return (
    <div className="stu-app">
      <TopBar />
      {mode === 'edit' && <HintBar />}
      {mode === 'home' ? <HomeView /> : mode === 'edit' ? <Canvas /> : mode === 'site' ? <SiteView /> : <PresentView />}
      <EditSheet />
      {mode === 'edit' && <SlashLayer open={slashOpen} setOpen={setSlashOpen} />}
      <BlockLibrary />
      <ReviewDialog />
      <DeleteConfirm />
      <ImportConfirm />
      <ConflictBanner />
      <UpdateToast />
      <Shortcuts />
      <Toasts />
      <TourOverlay />
    </div>
  );
}
