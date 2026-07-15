/**
 * The DOM glue for RESIZING a selected group by its corner handles (pointer
 * events, same pattern as `useConnect.ts`). All decisions live in
 * `groupMarquee.ts`; this hook only measures, tracks the pointer, and commits
 * on release:
 *
 * - pointerdown on a corner handle (DirectLayer renders four on the selected
 *   group's rect) arms a PENDING gesture; travelling past the 6px threshold
 *   turns it into a resize (below it, pointerup stays a click — the group
 *   stays selected, nothing changes);
 * - during the drag: the hovered cell snaps the range with the OPPOSITE
 *   corner fixed, previewed as the same dashed snap box the create-marquee
 *   uses; Esc cancels;
 * - release commits `groupResizeSets` through the {@link DirectHost} (ONE
 *   applyOp / undo step); a range identical to the original commits nothing.
 */

import { useEffect, useRef, useState } from 'react';
import { cellAtPoint, isDragGesture, type Box, type GridGeom } from './drag.js';
import {
  fixedCellFor,
  groupRangeAt,
  groupResizeSets,
  rangeBox,
  resizeRange,
  supportsGroups,
  type CellRange,
  type GroupCorner,
} from './groupMarquee.js';
import type { DirectHost } from './host.js';
import { readGeom } from './useDrag.js';

/** What DirectLayer renders while a corner resize is live. */
export interface GroupResizeVisuals {
  /** The snapped cell range the release would commit, wrapper-relative. */
  readonly snap: Box | null;
}

const NO_VISUALS: GroupResizeVisuals = { snap: null };

function relRect(el: Element, wrap: HTMLElement): Box {
  const a = el.getBoundingClientRect();
  const b = wrap.getBoundingClientRect();
  return { left: a.left - b.left, top: a.top - b.top, width: a.width, height: a.height };
}

/** The CSS resize cursor a corner handle shows (and the drag keeps). */
export function cornerCursor(corner: GroupCorner): string {
  return corner === 'nw' || corner === 'se' ? 'nwse-resize' : 'nesw-resize';
}

interface Session {
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly index: number;
  readonly cursor: string;
  /** The corner that stays put (the one OPPOSITE the grabbed handle). */
  readonly fixed: { col: number; row: number };
  readonly geom: GridGeom;
  readonly svgBox: Box;
  active: boolean;
  next: CellRange | null;
}

export function useGroupResize(args: {
  host: DirectHost;
  data: unknown;
  html: string;
  wrapperRef: React.RefObject<HTMLElement>;
  /** Set at activation; DirectLayer's click handler consumes it. */
  suppressClickRef: React.MutableRefObject<boolean>;
  /** True while the resize is live — DirectLayer pauses hover tracking. */
  dragActiveRef: React.MutableRefObject<boolean>;
  /** Called once when a gesture becomes a resize (clear hover state). */
  onResizeStart: () => void;
}): {
  visuals: GroupResizeVisuals;
  /** Arms a resize gesture from the `corner` handle of `groups[index]`. */
  start: (e: React.PointerEvent, index: number, corner: GroupCorner) => void;
} {
  const { host, data, html, wrapperRef, suppressClickRef, dragActiveRef, onResizeStart } = args;
  const [visuals, setVisuals] = useState<GroupResizeVisuals>(NO_VISUALS);
  const session = useRef<Session | null>(null);
  // The latest data/host for the commit (listeners bind per gesture).
  const live = useRef({ host, data, onResizeStart });
  live.current = { host, data, onResizeStart };
  /** The per-render `start` binding (the effect owns the listeners). */
  const startRef = useRef<
    ((e: PointerEvent, index: number, corner: GroupCorner) => void) | null
  >(null);

  useEffect(() => {
    const wrap = wrapperRef.current;
    if (wrap === null || !supportsGroups(host.kind)) return;

    const cleanup = (): void => {
      const s = session.current;
      session.current = null;
      dragActiveRef.current = false;
      if (s !== null && s.active) {
        document.body.style.userSelect = '';
        wrap.style.cursor = '';
      }
      setVisuals(NO_VISUALS);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey, true);
    };

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && session.current?.active === true) {
        e.preventDefault();
        e.stopPropagation();
        cleanup(); // cancel — no commit
      }
    };

    const onMove = (e: PointerEvent): void => {
      const s = session.current;
      if (s === null || e.pointerId !== s.pointerId) return;
      if (!s.active) {
        if (!isDragGesture(e.clientX - s.startX, e.clientY - s.startY)) return;
        s.active = true;
        dragActiveRef.current = true;
        suppressClickRef.current = true;
        document.body.style.userSelect = 'none';
        wrap.style.cursor = s.cursor;
        live.current.onResizeStart();
      }
      const wrapRect = wrap.getBoundingClientRect();
      const cell = cellAtPoint(
        s.geom,
        e.clientX - wrapRect.left - s.svgBox.left,
        e.clientY - wrapRect.top - s.svgBox.top,
      );
      const next = resizeRange(s.fixed, cell);
      s.next = next;
      const rb = rangeBox(s.geom, next);
      setVisuals({
        snap: {
          left: s.svgBox.left + rb.left,
          top: s.svgBox.top + rb.top,
          width: rb.width,
          height: rb.height,
        },
      });
    };

    const onUp = (e: PointerEvent): void => {
      const s = session.current;
      if (s === null || e.pointerId !== s.pointerId) return;
      if (!s.active) {
        cleanup(); // tiny travel — stays a click (the handle swallows it)
        return;
      }
      const { host: h, data: d } = live.current;
      const sets = s.next !== null ? groupResizeSets(d, s.index, s.next) : null;
      cleanup();
      if (sets !== null) h.commitPaths(sets); // one applyOp → one undo step
    };

    const onCancel = (): void => cleanup();

    const onStart = (e: PointerEvent, index: number, corner: GroupCorner): void => {
      if (e.button !== 0 || session.current !== null) return;
      const el = wrap.querySelector(`[data-bp="${CSS.escape(`groups.${index}`)}"]`);
      const svg = el?.closest('svg') ?? null;
      if (svg === null || !svg.hasAttribute('data-grid')) return;
      const geom = readGeom(svg);
      const range = geom !== null ? groupRangeAt(live.current.data, index) : null;
      if (geom === null || range === null) return;
      suppressClickRef.current = false; // a fresh gesture — clear stale state
      session.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        index,
        cursor: cornerCursor(corner),
        fixed: fixedCellFor(corner, range),
        geom,
        svgBox: relRect(svg, wrap),
        active: false,
        next: null,
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
      window.addEventListener('keydown', onKey, true);
    };
    startRef.current = onStart;

    return () => {
      cleanup();
      startRef.current = null;
    };
    // `html` re-binds after each render so a stale wrap never keeps listeners.
  }, [wrapperRef, host.kind, html, dragActiveRef, suppressClickRef]);

  return {
    visuals,
    start: (e, index, corner) => startRef.current?.(e.nativeEvent, index, corner),
  };
}
