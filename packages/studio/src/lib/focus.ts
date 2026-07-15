/**
 * Focus helpers for keyboard-first editing. "Focusable" here means a FIELD
 * control (input/textarea/select) that participates in the Tab order —
 * mouse-only chrome opts out via `tabIndex={-1}`.
 */

/** The field controls inside `root`, in DOM (= visual) order. */
export function focusablesIn(root: Element): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('input, textarea, select')).filter(
    (el) => el.tabIndex >= 0 && !el.hasAttribute('disabled'),
  );
}

/** Focuses a control and selects its text so typing replaces seeded values. */
export function focusControl(el: HTMLElement): void {
  el.focus();
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.select();
}
