/**
 * The DOM glue for MARQUEE group creation (pointer events, same pattern as
 * `useDrag.ts` / `useConnect.ts`). All decisions live in `groupMarquee.ts`;
 * this hook only measures, tracks the pointer, and commits on release:
 *
 * - pointerdown on EMPTY diagram canvas (inside a grid SVG, on no `data-bp`
 *   part) arms a PENDING gesture; travelling past the 6px threshold turns it
 *   into a marquee (below it, pointerup stays a click — the existing
 *   click-to-deselect behavior is untouched);
 * - during the drag: a dashed marquee follows the pointer and the snapped
 *   cell range lights up; Esc cancels;
 * - release commits `groupOps` through the {@link DirectHost} (ONE applyOp /
 *   undo step) and hands the new group's path back so the caller can select
 *   it and open the micro-editor on its label.
 *
 * Layered `block` diagrams have no grid geometry → the gesture never arms.
 */

import { useEffect, useRef, useState } from 'react';
import { isDragGesture, type Box, type GridGeom } from './drag.js';
import { groupOps, marqueeToCellRange, rangeBox, supportsGroups } from './groupMarquee.js';
import type { DirectHost } from './host.js';
import { readGeom } from './useDrag.js';

/** What DirectLayer renders while a marquee is live. */
export interface MarqueeVisuals {
  /** The raw dashed marquee rectangle, wrapper-relative. */
  readonly box: Box | null;
  /** The snapped cell range the release would cover, wrapper-relative. */
  readonly snap: Box | null;
}

const NO_VISUALS: MarqueeVisuals = { box: null, snap: null };

function relRect(el: Element, wrap: HTMLElement): Box {
  const a = el.getBoundingClientRect();
  const b = wrap.getBoundingClientRect();
  return { left: a.left - b.left, top: a.top - b.top, width: a.width, height: a.height };
}

interface Session {
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly geom: GridGeom;
  readonly svgBox: Box;
  active: boolean;
}

export function useGroupMarquee(args: {
  host: DirectHost;
  data: unknown;
  html: string;
  wrapperRef: React.RefObject<HTMLElement>;
  /** Canvas only (part selection land) — the sheet preview never marquees. */
  enabled: boolean;
  /** True while the micro-editor is open — no marquees then. */
  editorOpenRef: React.MutableRefObject<boolean>;
  /** Set at activation; DirectLayer's click handler consumes it. */
  suppressClickRef: React.MutableRefObject<boolean>;
  /** True while the marquee is live — DirectLayer pauses hover tracking. */
  dragActiveRef: React.MutableRefObject<boolean>;
  /** Called once when a gesture becomes a marquee (clear hover state). */
  onMarqueeStart: () => void;
  /** Called after the release created a group (select + edit its label). */
  onCreated: (groupPath: string, focusField: string) => void;
}): MarqueeVisuals {
  const { host, data, html, wrapperRef, enabled, editorOpenRef, suppressClickRef, dragActiveRef, onMarqueeStart, onCreated } = args;
  const [visuals, setVisuals] = useState<MarqueeVisuals>(NO_VISUALS);
  const session = useRef<Session | null>(null);
  // The latest data/host for the commit (listeners bind per gesture).
  const live = useRef({ host, data, onMarqueeStart, onCreated });
  live.current = { host, data, onMarqueeStart, onCreated };

  useEffect(() => {
    const wrap = wrapperRef.current;
    if (wrap === null || !enabled || !supportsGroups(host.kind)) return;

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
        wrap.style.cursor = 'crosshair';
        live.current.onMarqueeStart();
      }
      const wrapRect = wrap.getBoundingClientRect();
      const x0 = s.startX - wrapRect.left;
      const y0 = s.startY - wrapRect.top;
      const x1 = e.clientX - wrapRect.left;
      const y1 = e.clientY - wrapRect.top;
      const box: Box = {
        left: Math.min(x0, x1),
        top: Math.min(y0, y1),
        width: Math.abs(x1 - x0),
        height: Math.abs(y1 - y0),
      };
      const range = marqueeToCellRange(
        s.geom,
        x0 - s.svgBox.left,
        y0 - s.svgBox.top,
        x1 - s.svgBox.left,
        y1 - s.svgBox.top,
      );
      const rb = rangeBox(s.geom, range);
      setVisuals({
        box,
        snap: { left: s.svgBox.left + rb.left, top: s.svgBox.top + rb.top, width: rb.width, height: rb.height },
      });
    };

    const onUp = (e: PointerEvent): void => {
      const s = session.current;
      if (s === null || e.pointerId !== s.pointerId) return;
      if (!s.active) {
        cleanup(); // tiny travel — stays a click (deselect behavior untouched)
        return;
      }
      const wrapRect = wrap.getBoundingClientRect();
      const range = marqueeToCellRange(
        s.geom,
        s.startX - wrapRect.left - s.svgBox.left,
        s.startY - wrapRect.top - s.svgBox.top,
        e.clientX - wrapRect.left - s.svgBox.left,
        e.clientY - wrapRect.top - s.svgBox.top,
      );
      const { host: h, data: d, onCreated: created } = live.current;
      const r = groupOps(h.kind, d, range);
      cleanup();
      if (r === null) return;
      h.commitPaths(r.sets);
      created(r.groupPath, 'label');
    };

    const onCancel = (): void => cleanup();

    const onDown = (e: PointerEvent): void => {
      if (e.button !== 0 || session.current !== null) return;
      if (editorOpenRef.current) return;
      if (!(e.target instanceof Element)) return;
      if (e.target.closest('.stu-dx-overlay') !== null) return; // our own controls
      if (e.target.closest('[data-bp]') !== null) return; // parts drag/select instead
      // Empty canvas means INSIDE the grid SVG's background (never prose, the
      // transition table, legends…), and only when it advertises geometry —
      // a layered block diagram has none, so the marquee never arms there.
      const svg = e.target.closest('svg');
      if (svg === null || !wrap.contains(svg) || !svg.hasAttribute('data-grid')) return;
      const geom = readGeom(svg);
      if (geom === null) return;
      session.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        geom,
        svgBox: relRect(svg, wrap),
        active: false,
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
      window.addEventListener('keydown', onKey, true);
    };

    wrap.addEventListener('pointerdown', onDown);
    return () => {
      wrap.removeEventListener('pointerdown', onDown);
      cleanup();
    };
    // `html` re-binds after each render so a stale wrap never keeps listeners.
  }, [wrapperRef, host.kind, enabled, html, dragActiveRef, suppressClickRef, editorOpenRef]);

  return visuals;
}
