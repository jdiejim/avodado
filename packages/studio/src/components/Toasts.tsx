/**
 * Transient toasts (bottom-right) and the conflict banner (top-center) shown
 * when the open doc changed on disk under unsaved local edits.
 */

import { useStudio } from '../state/store.js';

export function Toasts(): JSX.Element | null {
  const toasts = useStudio((s) => s.toasts);
  const dismiss = useStudio((s) => s.dismissToast);
  if (toasts.length === 0) return null;
  return (
    <div className="stu-toasts" role="status">
      {toasts.map((t) => (
        <div key={t.id} className={`stu-toast stu-toast-${t.tone}`}>
          <span>{t.message}</span>
          <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

/**
 * Slim persistent toast shown when the studio server is running a NEWER build
 * than this tab (detected on SSE reconnect / window focus) — a stale SPA can
 * silently misbehave against a newer file bridge.
 */
export function UpdateToast(): JSX.Element | null {
  const updateAvailable = useStudio((s) => s.updateAvailable);
  if (!updateAvailable) return null;
  return (
    <div className="stu-update" role="status">
      <span>Studio was updated —</span>
      <button type="button" className="stu-update-btn" onClick={() => window.location.reload()}>
        Reload
      </button>
    </div>
  );
}

export function ConflictBanner(): JSX.Element | null {
  const conflict = useStudio((s) => s.conflict);
  const resolve = useStudio((s) => s.resolveConflict);
  if (conflict === null) return null;
  return (
    <div className="stu-conflict" role="alertdialog" aria-label="File changed on disk">
      <div className="stu-conflict-msg">
        <strong>This file changed on disk.</strong>
        <span>Your unsaved edits overlap with the change.</span>
      </div>
      <div className="stu-conflict-actions">
        <button type="button" className="stu-btn" onClick={() => resolve('theirs')}>
          Reload theirs
        </button>
        <button type="button" className="stu-btn stu-btn-primary" onClick={() => resolve('mine')}>
          Keep mine
        </button>
      </div>
    </div>
  );
}
