/**
 * Pure sync/guard decision logic — extracted from the store so the rules are
 * unit-testable without a network or a zustand instance: SSE `fs` event
 * handling, the meta-block move guard, and the stale-tab version compare.
 */

/** What the store should do about the open doc when an `fs` event arrives. */
export type FsDecision =
  /** Event has no slug — refetch the current doc AND the doc list. */
  | 'refetch-all'
  /** A different doc changed — just refresh the doc list. */
  | 'refresh-list'
  /** Our own save echoed back — nothing to do for the open doc. */
  | 'ignore-echo'
  /** The open doc changed on disk and we have no local edits — refetch quietly. */
  | 'silent-refetch'
  /** The open doc changed on disk under our unsaved edits — surface a conflict. */
  | 'conflict';

/** The slice of store state the decision depends on. */
export interface FsDecisionState {
  readonly currentSlug: string | null;
  readonly baseHash: string | null;
  readonly dirty: boolean;
}

/**
 * Decides how to react to an `fs` event.
 *
 * Order matters: the own-echo check (event hash === our base hash) wins even
 * when `dirty` — our save landing on disk while we kept typing is not a
 * conflict, the base is still ours.
 */
export function decideFsEvent(
  ev: { readonly slug?: string; readonly hash?: string },
  state: FsDecisionState,
): FsDecision {
  if (ev.slug === undefined) return 'refetch-all';
  if (state.currentSlug === null || ev.slug !== state.currentSlug) return 'refresh-list';
  if (ev.hash !== undefined && state.baseHash !== null && ev.hash === state.baseHash) {
    return 'ignore-echo';
  }
  if (!state.dirty) return 'silent-refetch';
  return 'conflict';
}

/**
 * Whether moving segment `from` to gap `to` is allowed. The meta block is the
 * document cover — it stays the first segment: it never moves, and nothing
 * moves above it. No-op moves (`to` at or right after `from`) are rejected too.
 *
 * @param kinds - Segment kinds in document order.
 * @param from - Index of the segment being moved.
 * @param to - Target GAP index (0 … kinds.length).
 */
export function canMoveSegment(kinds: readonly string[], from: number, to: number): boolean {
  if (from < 0 || from >= kinds.length || to < 0 || to > kinds.length) return false;
  if (to === from || to === from + 1) return false;
  if (kinds[from] === 'meta') return false;
  if (to === 0 && kinds[0] === 'meta') return false;
  return true;
}

/**
 * Whether a freshly fetched server version means this tab is running a stale
 * SPA build (→ offer a reload). Null/empty on either side means "unknown" —
 * never prompt on incomplete information.
 */
export function versionChanged(baseline: string | null, latest: string | null): boolean {
  return (
    baseline !== null && baseline !== '' && latest !== null && latest !== '' && baseline !== latest
  );
}
