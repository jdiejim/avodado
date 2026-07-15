/**
 * Keyboard discoverability: a slim contextual footer bar whose 4-5 hints
 * follow the current surface (canvas / selected block / edit sheet), and the
 * `?` overlay card with the full grouped shortcut list. The bar is
 * dismissible (×) and comes back whenever `?` is pressed.
 */

import { useEffect, useState } from 'react';
import { nodeIndexFromPath, specFor } from '../direct/connect.js';
import { blockSupportsDrag } from '../direct/drag.js';
import { shortcutsFor, type ShortcutContext } from '../form/keyboard.js';
import { isEditableTarget } from '../lib/dom.js';
import { useDerived, useStudio } from '../state/store.js';
import { useTour } from '../tour/state.js';
import { IconClose } from './Icons.js';

const BAR_KEY = 'avodado-studio-shortcutbar-dismissed';

interface OverlayRow {
  readonly keys: string;
  readonly label: string;
}

const OVERLAY_GROUPS: ReadonlyArray<{ title: string; rows: readonly OverlayRow[] }> = [
  {
    title: 'Canvas',
    rows: [
      { keys: '↑ ↓ · j k', label: 'select block' },
      { keys: '⏎', label: 'edit selection' },
      { keys: '⌘D', label: 'duplicate' },
      { keys: '⌘↑ ⌘↓', label: 'move block' },
      { keys: '⌫', label: 'delete block' },
      { keys: '⌘Z / ⇧⌘Z', label: 'undo / redo' },
      { keys: 'esc', label: 'deselect' },
    ],
  },
  {
    title: 'Diagram parts',
    rows: [
      { keys: 'click · ⇥', label: 'select a part (⇥ cycles)' },
      { keys: '⏎ · dbl-click', label: 'edit the selected part' },
      { keys: '←↑↓→', label: 'move it — grid cell / reorder · table cells: navigate' },
      { keys: '⌫', label: 'delete the selected item' },
      { keys: 'esc', label: 'back to the block' },
      { keys: 'drag', label: 'move with the pointer' },
      { keys: 'drag a dot', label: 'connect nodes — drop on empty space to add one' },
      { keys: '⌥←↑↓→', label: 'nudge the hovered part' },
    ],
  },
  {
    title: 'Editor',
    rows: [
      { keys: '⇥ / ⇧⇥', label: 'next / previous field' },
      { keys: '⏎', label: 'next field · new row on the last one' },
      { keys: '⏎ (empty row)', label: 'leave the list' },
      { keys: '⌘⏎', label: 'done — inside a text area: next' },
      { keys: 'type · ↑↓ · ⏎', label: 'filter and pick in dropdowns' },
      { keys: 'esc', label: 'cancel' },
    ],
  },
  {
    title: 'Insert',
    rows: [
      { keys: '/', label: 'insert after selection' },
      { keys: 'type', label: 'filter block types' },
      { keys: '⏎', label: 'insert and start typing' },
      { keys: 'Library', label: 'browse every block — top bar, or the menu footers' },
      { keys: '⌘S', label: 'save now' },
    ],
  },
  {
    title: 'Modes',
    rows: [
      { keys: 'Edit · Site · Present', label: 'switch in the top bar' },
      { keys: '⇧⌘P', label: 'toggle Present — the current doc as slides' },
      { keys: 'esc', label: 'back to Edit from Site / Present' },
      { keys: '⌘S', label: 'in Site mode: update the preview' },
    ],
  },
];

export function Shortcuts(): JSX.Element {
  const sheetOpen = useStudio((s) => s.sheet !== null);
  const hasSelection = useStudio((s) => s.selection !== null);
  const selection = useStudio((s) => s.selection);
  const { doc } = useDerived();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return window.localStorage.getItem(BAR_KEY) === '1';
    } catch {
      return true;
    }
  });
  const [overlay, setOverlay] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !isEditableTarget(e.target)) {
        e.preventDefault();
        e.stopPropagation();
        setOverlay((o) => !o);
        setDismissed(false);
        try {
          window.localStorage.removeItem(BAR_KEY);
        } catch {
          /* private mode */
        }
        return;
      }
      if (e.key === 'Escape' && overlay) {
        e.preventDefault();
        e.stopPropagation();
        setOverlay(false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [overlay]);

  const partSel = useStudio((s) => s.partSel);
  const partSelected = partSel !== null;
  const mode = useStudio((s) => s.mode);
  const ctx: ShortcutContext =
    mode !== 'edit'
      ? mode
      : sheetOpen
        ? 'sheet'
        : partSelected
          ? 'part'
          : hasSelection
            ? 'canvas-selected'
            : 'canvas';
  const seg = selection !== null ? doc.segments[selection] : undefined;
  const dragParts =
    seg !== undefined &&
    seg.kind !== 'markdown' &&
    seg.kind !== 'meta' &&
    blockSupportsDrag(seg.kind, seg.data);
  // Selected part is a NODE of a connectable diagram → "drag a dot" hint.
  const partSeg = partSel !== null ? doc.segments[partSel.seg] : undefined;
  const connectSpec =
    partSeg !== undefined && partSeg.kind !== 'markdown' ? specFor(partSeg.kind) : null;
  const connectDots =
    partSel !== null && connectSpec !== null && nodeIndexFromPath(connectSpec, partSel.path) !== null;

  const dismiss = (): void => {
    setDismissed(true);
    try {
      window.localStorage.setItem(BAR_KEY, '1');
    } catch {
      /* private mode */
    }
  };

  return (
    <>
      {!dismissed && (
        <div className="stu-keybar" role="note" data-ctx={ctx} data-tour="keybar">
          {shortcutsFor(ctx, { dragParts, connectDots }).map((h) => (
            <span key={h.keys} className="stu-keybar-hint">
              <kbd>{h.keys}</kbd> {h.label}
            </span>
          ))}
          <button type="button" className="stu-keybar-x" aria-label="Hide shortcuts bar (press ? to bring it back)" onClick={dismiss}>
            <IconClose size={10} />
          </button>
        </div>
      )}
      {overlay && (
        <div className="stu-keys-backdrop" onMouseDown={() => setOverlay(false)}>
          <div
            className="stu-keys-card"
            role="dialog"
            aria-label="Keyboard shortcuts"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <header>
              <h2>Keyboard shortcuts</h2>
              <button type="button" aria-label="Close" onClick={() => setOverlay(false)}>
                <IconClose size={12} />
              </button>
            </header>
            <div className="stu-keys-cols">
              {OVERLAY_GROUPS.map((g) => (
                <section key={g.title}>
                  <h3>{g.title}</h3>
                  {g.rows.map((r) => (
                    <div key={r.keys} className="stu-keys-row">
                      <kbd>{r.keys}</kbd>
                      <span>{r.label}</span>
                    </div>
                  ))}
                </section>
              ))}
            </div>
            <footer>
              press <kbd>?</kbd> anytime to toggle this card
              <button
                type="button"
                className="stu-keys-tour"
                onClick={() => {
                  setOverlay(false);
                  void useTour.getState().start();
                }}
              >
                ▸ Take the interactive tour
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
