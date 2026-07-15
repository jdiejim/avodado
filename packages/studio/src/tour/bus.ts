/**
 * A one-listener event bus for tour advancement. The app's chrome emits REAL
 * user actions (insert, field commit, part select, …) unconditionally; the
 * emits are no-ops unless the tour is running and listening. Kept separate
 * from the store so emit sites never import tour state (no cycles).
 */

import type { TourAction } from './script.js';

type Listener = (action: TourAction) => void;

let listener: Listener | null = null;

/** Subscribes THE tour listener (the last subscriber wins; returns unsubscribe). */
export function onTourAction(l: Listener): () => void {
  listener = l;
  return () => {
    if (listener === l) listener = null;
  };
}

/** Emits a real user action toward the tour (no-op when no tour is running). */
export function emitTourAction(action: TourAction): void {
  listener?.(action);
}
