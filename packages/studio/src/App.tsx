/**
 * Studio shell, v2 (Notion-style focus editing): a single top bar over a
 * full-width canvas. Editing happens in place (prose) or in the modal Edit
 * Sheet (typed blocks); inserting happens via the ONE insert picker — the
 * '+' gaps and the slash command open its compact face, the Library button
 * its browse face. Global keyboard shortcuts, SSE wiring, toasts, conflict
 * banner.
 */

import { useEffect } from 'react';
import { removeSegment } from '@avodado/core';
import { hasServer } from './api/client.js';
import { useServerEvents } from './api/events.js';
import { keySurface } from './direct/partSelect.js';
import { duplicateSegment, moveSegmentDown, moveSegmentUp } from './lib/actions.js';
import { needsBlockDeleteConfirm } from './lib/confirmDelete.js';
import { isEditableTarget, shouldOpenSlash } from './lib/dom.js';
import { markSlashUsed } from './lib/prefs.js';
import { segmentLabel } from './state/changes.js';
import { derive } from './state/derive.js';
import { useStudio } from './state/store.js';
import { Canvas } from './components/Canvas.js';
import { DocList } from './components/DocList.js';
import { Rail } from './components/Rail.js';
import { PresentView } from './components/PresentView.js';
import { DeleteConfirm } from './components/DeleteConfirm.js';
import { EditSheet } from './components/EditSheet.js';
import { ImportConfirm } from './components/ImportConfirm.js';
import { ReviewDialog } from './components/ReviewDialog.js';
import { InsertPicker } from './components/InsertPicker.js';
import { Shortcuts } from './components/Shortcuts.js';
import { ConflictBanner, Toasts, UpdateToast } from './components/Toasts.js';
import { TopBar } from './components/TopBar.js';
import { TourOverlay } from './tour/TourOverlay.js';

export function App(): JSX.Element {
  const init = useStudio((s) => s.init);
  const handleServerEvent = useStudio((s) => s.handleServerEvent);

  useEffect(() => {
    void init();
  }, [init]);

  // Stale-tab guard: re-check the studio version whenever the SSE stream
  // (re)connects and whenever the window regains focus.
  // Nothing outside the browser edits a vault document, so there is no
  // change stream to subscribe to — and no /__events to retry forever.
  useServerEvents(handleServerEvent, () => void useStudio.getState().checkVersion(), hasServer);
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
      // So does the insert picker (its own Esc / arrows / focus handling).
      if (s.picker !== null) return;
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
      // Present: the deck owns the surface — only Esc (back to Edit)
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
        // '/' has no gap context: centered compact picker, insert lands
        // after the selection (else at the doc end), resolved at pick time.
        s.openPicker({ view: 'compact' });
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
        // The meta cover has no shell in the flow (the rendered cover is its
        // edit surface) — keyboard roving starts at the first real block.
        const min = doc.segments[0]?.kind === 'meta' ? 1 : 0;
        if (count <= min) return;
        const next =
          sel === null
            ? dir === 1
              ? min
              : count - 1
            : Math.min(count - 1, Math.max(min, sel + dir));
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
      <div className="stu-shell">
        {/* The rail persists across the list and edit views; Present owns
            the full width (unchanged). */}
        {mode !== 'present' && <Rail />}
        <div className="stu-main">
          <TopBar />
          {mode === 'home' ? <DocList /> : mode === 'edit' ? <Canvas /> : <PresentView />}
        </div>
      </div>
      <EditSheet />
      <InsertPicker />
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
