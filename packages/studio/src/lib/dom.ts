/**
 * DOM guards shared by the global keyboard handlers. Written against duck
 * types (tagName / isContentEditable) so they are unit-testable without a DOM.
 */

/** True when a keystroke targeted an editable control (input/textarea/select/contenteditable). */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (target === null || typeof target !== 'object') return false;
  const el = target as { tagName?: unknown; isContentEditable?: unknown };
  const tag = typeof el.tagName === 'string' ? el.tagName.toUpperCase() : '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return el.isContentEditable === true;
}

/**
 * The slash-command guard: `/` (no modifiers) pressed outside any editable
 * control should open the insert palette.
 */
export function shouldOpenSlash(e: {
  readonly key: string;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly target: EventTarget | null;
}): boolean {
  if (e.key !== '/') return false;
  if (e.metaKey || e.ctrlKey || e.altKey) return false;
  return !isEditableTarget(e.target);
}
