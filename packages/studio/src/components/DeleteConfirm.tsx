/**
 * The lightweight anchored confirm popover for destructive deletes (block
 * toolbar 🗑, block/part ⌫, hover ×) — NOT a modal. Cancel is focused (safe
 * default); Delete is the danger button. Pressing ⌫ again confirms (the
 * double-tap fast path for keyboard users), Esc or an outside click cancels.
 * Trigger sites decide destructiveness via `lib/confirmDelete.ts` and arm
 * `store.pendingDelete` with the deletion closure.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useStudio } from '../state/store.js';

const EDGE = 8;

export function DeleteConfirm(): JSX.Element | null {
  const pending = useStudio((s) => s.pendingDelete);
  const confirmDelete = useStudio((s) => s.confirmDelete);
  const cancelDelete = useStudio((s) => s.cancelDelete);
  const popRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const open = pending !== null;

  // Position: centered under the anchor point, clamped to the viewport;
  // flips above when there is no room below.
  useLayoutEffect(() => {
    if (pending === null) {
      setPos(null);
      return;
    }
    const el = popRef.current;
    const w = el?.offsetWidth ?? 240;
    const h = el?.offsetHeight ?? 92;
    const left = Math.min(Math.max(pending.anchor.x - w / 2, EDGE), window.innerWidth - w - EDGE);
    let top = pending.anchor.y + 6;
    if (top + h > window.innerHeight - EDGE) top = Math.max(EDGE, pending.anchor.y - h - 12);
    setPos({ left, top });
  }, [pending]);

  // Safe default: Cancel holds focus, ⏎ lands on it unless the user tabs.
  useEffect(() => {
    if (open) requestAnimationFrame(() => cancelRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cancelDelete();
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        // Double-tap ⌫: the second press confirms.
        e.preventDefault();
        e.stopPropagation();
        confirmDelete();
      }
    };
    const onDown = (e: MouseEvent): void => {
      if (popRef.current !== null && !popRef.current.contains(e.target as Node)) cancelDelete();
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('mousedown', onDown, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('mousedown', onDown, true);
    };
  }, [open, confirmDelete, cancelDelete]);

  if (pending === null) return null;

  return (
    <div
      ref={popRef}
      className="stu-delpop"
      role="alertdialog"
      aria-label={`Delete ${pending.label}?`}
      style={pos ?? { left: pending.anchor.x, top: pending.anchor.y, visibility: 'hidden' }}
    >
      <div className="stu-delpop-text">
        <strong>{pending.label}</strong> — delete?
      </div>
      <div className="stu-delpop-row">
        <span className="stu-delpop-hint">⌫ again confirms · ⌘Z undoes</span>
        <button type="button" ref={cancelRef} className="stu-btn stu-btn-sm" onClick={cancelDelete}>
          Cancel
        </button>
        <button
          type="button"
          className="stu-btn stu-btn-sm stu-btn-danger"
          onClick={confirmDelete}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
