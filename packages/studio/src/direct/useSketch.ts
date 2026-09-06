/**
 * The DOM glue for PEN MODE: while it is armed, a pointer stroke over the
 * diagram draws an ink trail, and on release the stroke becomes a node, an
 * edge, or a question.
 *
 * All decisions live in `sketch.ts` (recognizer + mapping) and `connect.ts`
 * (the op builders); this hook only measures, tracks the pointer, and
 * commits:
 *
 * - pointerdown anywhere on the block's grid SVG starts a stroke — pen mode
 *   owns the surface, so drag-to-move, the marquee and part selection stay
 *   out of the way while it is on (`penActiveRef`);
 * - during the stroke the raw points render as an ink trail (wrapper-relative
 *   `<svg>` overlay, `touch-action: none` so a finger or stylus draws instead
 *   of scrolling);
 * - on pointerup the stroke is recognized. A CLOSED SHAPE snaps its bounding
 *   box centre to a grid cell and commits the mapped node; a LINE resolves
 *   its two endpoints against the node boxes (node → node = an edge in stroke
 *   direction, node → empty = a new node plus the edge); a SCRIBBLE over a
 *   node deletes it; an AMBIGUOUS read opens the kind picker at the cell with
 *   the near-miss kinds first — pen mode never inserts a shape it is not sure
 *   about;
 * - the committed cell flashes and the trail fades (160 ms, skipped under
 *   `prefers-reduced-motion`), then the new node pops through the layer's
 *   normal FLIP;
 * - Esc leaves pen mode, as does a commit-free click outside the SVG.
 */

import { useEffect, useRef, useState } from 'react';
import { useStudio } from '../state/store.js';
import { nodeLabel, specFor, type ConnectSpec } from './connect.js';
import { cellAtPoint, cellBox, type Box, type Placement } from './drag.js';
import { prefersReducedMotion } from './flip.js';
import type { DirectHost } from './host.js';
import {
  recognize,
  sketchable,
  sketchNodeOps,
  sketchToOps,
  type Pt,
} from './sketch.js';
import { numAttr, readGeom } from './useDrag.js';

/** How long the snapped-cell flash stays before the trail fades out. */
export const FLASH_MS = 160;

/** What DirectLayer renders while pen mode is on. */
export interface SketchVisuals {
  /** The live ink trail, wrapper-relative — empty between strokes. */
  readonly trail: readonly Pt[];
  /** True once the stroke committed: the trail fades instead of tracking. */
  readonly fading: boolean;
  /** The snapped cell outline that flashes on commit. */
  readonly flash: Box | null;
  /** The kind picker for an ambiguous read, anchored at the drop point. */
  readonly picker: {
    readonly left: number;
    readonly top: number;
    readonly cell: Placement;
    readonly items: ReadonlyArray<{ readonly value: string; readonly label: string }>;
  } | null;
}

const NO_VISUALS: SketchVisuals = { trail: [], fading: false, flash: null, picker: null };

function relBox(el: Element, wrap: HTMLElement): Box {
  const a = el.getBoundingClientRect();
  const b = wrap.getBoundingClientRect();
  return { left: a.left - b.left, top: a.top - b.top, width: a.width, height: a.height };
}

function inBox(b: Box, p: Pt): boolean {
  return p.x >= b.left && p.x <= b.left + b.width && p.y >= b.top && p.y <= b.top + b.height;
}

function idsOf(spec: ConnectSpec, data: unknown): string[] {
  const rec = data !== null && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const list = rec[spec.nodesField];
  return Array.isArray(list)
    ? list.map((n) => {
        const v = n !== null && typeof n === 'object' ? (n as Record<string, unknown>)[spec.idField] : undefined;
        return typeof v === 'string' ? v : '';
      })
    : [];
}

/** "New service" for a kind value, using the spec's own labels where it has one. */
function labelForKind(spec: ConnectSpec, kind: string): string {
  const known = spec.nodeKinds.find((k) => k.kind === kind);
  return known?.label ?? kind.charAt(0).toUpperCase() + kind.slice(1);
}

interface Session {
  readonly pointerId: number;
  readonly svg: SVGSVGElement;
  readonly svgBox: Box;
  readonly geom: ReturnType<typeof readGeom>;
  readonly points: Pt[];
}

export function useSketch(args: {
  host: DirectHost;
  data: unknown;
  html: string;
  wrapperRef: React.RefObject<HTMLElement>;
  /**
   * The block's segment index — pen mode is canvas-only, and the armed flag
   * lives in the store under this index so the block toolbar's Draw button
   * and the `D` key drive the same state.
   */
  segIndex: number | undefined;
  suppressClickRef: React.MutableRefObject<boolean>;
  /** Set while a stroke is live so the other pointer layers stand down. */
  dragActiveRef: React.MutableRefObject<boolean>;
  /** Called after a stroke created a node: select it and name it. */
  onNodeCreated: (nodePath: string, focusField: string) => void;
  /** Called for a scribble-over-node: the layer runs its own delete flow. */
  onDelete: (path: string) => void;
}): {
  /** True while pen mode is armed (crosshair cursor, strokes captured). */
  readonly on: boolean;
  readonly visuals: SketchVisuals;
  /** True when this block kind can be drawn on at all (grid + a mapping). */
  readonly available: boolean;
  toggle: () => void;
  leave: () => void;
  /** Commits an ambiguous read's picker choice. */
  choose: (kind: string) => void;
} {
  const { host, data, html, wrapperRef, segIndex, suppressClickRef, dragActiveRef, onNodeCreated, onDelete } = args;
  const available = segIndex !== undefined && sketchable(host.kind);
  // The armed flag is STORE state (see `segIndex`): the toolbar toggle and
  // the `D` key are the same switch.
  const on = useStudio((st) => st.penMode !== null && st.penMode.seg === segIndex && st.penMode.on);
  const [visuals, setVisuals] = useState<SketchVisuals>(NO_VISUALS);
  const session = useRef<Session | null>(null);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The open picker's cell — `choose` commits against it. */
  const pending = useRef<Placement | null>(null);
  const live = useRef({ host, data, onNodeCreated, onDelete });
  live.current = { host, data, onNodeCreated, onDelete };
  const onRef = useRef(false);
  onRef.current = on;

  /** Publishes availability so the toolbar can show (or hide) the toggle. */
  useEffect(() => {
    const s = useStudio.getState();
    if (segIndex === undefined) return;
    if (!available) {
      if (s.penMode?.seg === segIndex) s.setPenMode(null);
      return;
    }
    if (s.penMode?.seg !== segIndex) s.setPenMode({ seg: segIndex, on: false });
    return () => {
      const cur = useStudio.getState();
      if (cur.penMode?.seg === segIndex) cur.setPenMode(null);
    };
  }, [available, segIndex]);

  const setOn = (next: boolean): void => {
    if (segIndex !== undefined) useStudio.getState().setPenMode({ seg: segIndex, on: next });
  };

  useEffect(
    () => () => {
      if (fadeTimer.current !== null) clearTimeout(fadeTimer.current);
    },
    [],
  );

  useEffect(() => {
    const wrap = wrapperRef.current;
    if (wrap === null || !available) return;
    const spec = specFor(host.kind);
    if (spec === null) return;

    const clearTrail = (): void => {
      if (fadeTimer.current !== null) {
        clearTimeout(fadeTimer.current);
        fadeTimer.current = null;
      }
      setVisuals(NO_VISUALS);
    };

    /** Flash the committed cell, then fade the trail out. */
    const finish = (flash: Box | null): void => {
      if (prefersReducedMotion() || flash === null) {
        clearTrail();
        return;
      }
      setVisuals((v) => ({ ...v, fading: true, flash, picker: null }));
      fadeTimer.current = setTimeout(clearTrail, FLASH_MS);
    };

    const endSession = (): void => {
      session.current = null;
      dragActiveRef.current = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };

    /** Wrapper-relative boxes of every node, in index order. */
    const nodeBoxes = (): Array<Box | null> =>
      idsOf(spec, live.current.data).map((_, i) => {
        const el = wrap.querySelector(`[data-bp="${CSS.escape(`${spec.nodesField}.${i}`)}"]`);
        return el === null ? null : relBox(el, wrap);
      });

    /** Effective placements from the renderer's attrs (null → not all placed). */
    const placements = (): Placement[] | undefined => {
      const count = idsOf(spec, live.current.data).length;
      const out: Placement[] = [];
      for (let i = 0; i < count; i++) {
        const el = wrap.querySelector(`[data-bp="${CSS.escape(`${spec.nodesField}.${i}`)}"]`);
        const col = el !== null ? numAttr(el, 'data-col') : null;
        const row = el !== null ? numAttr(el, 'data-row') : null;
        if (col === null || row === null) return undefined;
        out.push({ col, row });
      }
      return out;
    };

    /** The grid cell under a wrapper-relative point. */
    const cellAt = (s: Session, p: Pt): Placement => {
      const geom = s.geom;
      if (geom === null) return { col: 1, row: 1 };
      const raw = cellAtPoint(geom, p.x - s.svgBox.left, p.y - s.svgBox.top);
      return spec.growRows === false ? { col: raw.col, row: Math.min(raw.row, geom.rows) } : raw;
    };

    const boxOfCell = (s: Session, cell: Placement): Box | null => {
      if (s.geom === null) return null;
      const cb = cellBox(s.geom, cell.col, cell.row);
      return { left: s.svgBox.left + cb.left, top: s.svgBox.top + cb.top, width: cb.width, height: cb.height };
    };

    const commitNode = (
      r: { sets: ReadonlyArray<{ path: ReadonlyArray<string | number>; value: unknown }>; nodePath: string; label: string },
      flash: Box | null,
    ): void => {
      live.current.host.commitPaths(r.sets);
      live.current.host.notify?.(`Drew ${r.label}`);
      finish(flash);
      live.current.onNodeCreated(r.nodePath, spec.labelField);
    };

    const onMove = (e: PointerEvent): void => {
      const s = session.current;
      if (s === null || e.pointerId !== s.pointerId) return;
      e.preventDefault();
      const wrapRect = wrap.getBoundingClientRect();
      s.points.push({ x: e.clientX - wrapRect.left, y: e.clientY - wrapRect.top });
      setVisuals({ trail: [...s.points], fading: false, flash: null, picker: null });
    };

    const onUp = (e: PointerEvent): void => {
      const s = session.current;
      if (s === null || e.pointerId !== s.pointerId) return;
      endSession();
      suppressClickRef.current = true; // the trailing click must not select
      const pts = s.points;
      const rec = recognize(pts);
      if (rec === undefined) {
        clearTrail(); // not a shape — no guess, no commit
        return;
      }
      const { host: h, data: d } = live.current;

      // Where the stroke landed: a closed shape uses its bounding-box centre,
      // a line its far end.
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      const centre = {
        x: (Math.min(...xs) + Math.max(...xs)) / 2,
        y: (Math.min(...ys) + Math.max(...ys)) / 2,
      };
      const first = pts[0] as Pt;
      const last = pts[pts.length - 1] as Pt;
      const boxes = nodeBoxes();
      const ids = idsOf(spec, d);
      const hitAt = (p: Pt): { id: string; path: string } | null => {
        for (let i = boxes.length - 1; i >= 0; i--) {
          const b = boxes[i];
          const id = ids[i];
          if (b !== null && b !== undefined && id !== undefined && id !== '' && inBox(b, p)) {
            return { id, path: `${spec.nodesField}.${i}` };
          }
        }
        return null;
      };

      const cell = cellAt(s, rec.shape === 'line' ? last : centre);
      const from = hitAt(first);
      const to = hitAt(last);
      const under = hitAt(centre);
      const result = sketchToOps(rec.shape, host.kind, cell, {
        data: d,
        placements: placements(),
        ...(rec.candidates !== undefined ? { candidates: rec.candidates } : {}),
        ...(rec.shape === 'line'
          ? { line: { fromId: from?.id ?? null, toId: to?.id ?? null, endCell: cell } }
          : {}),
        under: under?.path ?? null,
      });

      if (result.type === 'node') {
        commitNode(result, boxOfCell(s, cell));
        return;
      }
      if (result.type === 'edge') {
        h.commitPaths(result.sets);
        h.notify?.(`Connected ${nodeLabel(spec, d, result.fromId)} → ${nodeLabel(spec, d, result.toId)}`);
        finish(null);
        return;
      }
      if (result.type === 'delete') {
        clearTrail();
        live.current.onDelete(result.path);
        return;
      }
      if (result.type === 'pick') {
        // Ambiguous (or unmapped): ask. The near-miss kinds lead, then the
        // rest of the block's kinds — the trail stays faintly visible under
        // the picker so the question is anchored to what was drawn.
        const seen = new Set(result.first);
        const items = [
          ...result.first.map((k) => ({ value: k, label: labelForKind(spec, k) })),
          ...spec.nodeKinds.filter((k) => !seen.has(k.kind)).map((k) => ({ value: k.kind, label: k.label })),
        ];
        if (items.length === 0) {
          clearTrail();
          return;
        }
        pending.current = cell;
        setVisuals({
          trail: pts,
          fading: true, // dim, not gone — the question is about THIS stroke
          flash: boxOfCell(s, cell),
          picker: { left: centre.x, top: centre.y, cell, items },
        });
        return;
      }
      if (result.reason !== '') h.notify?.(result.reason);
      clearTrail();
    };

    const onCancel = (): void => {
      endSession();
      clearTrail();
    };

    const onDown = (e: PointerEvent): void => {
      if (!onRef.current || e.button !== 0 || session.current !== null) return;
      if (!(e.target instanceof Element)) return;
      if (e.target.closest('.stu-dx-sketch-picker') !== null) return; // the picker owns its clicks
      if (pending.current !== null) return; // a picker is open — answer it first
      // Only inside the grid SVG: prose, legends and tables are not canvas.
      const svg = e.target.closest('svg');
      if (svg === null || !wrap.contains(svg) || !svg.hasAttribute('data-grid')) return;
      e.preventDefault();
      e.stopPropagation();
      const wrapRect = wrap.getBoundingClientRect();
      session.current = {
        pointerId: e.pointerId,
        svg: svg as SVGSVGElement,
        svgBox: relBox(svg, wrap),
        geom: readGeom(svg as SVGSVGElement),
        points: [{ x: e.clientX - wrapRect.left, y: e.clientY - wrapRect.top }],
      };
      dragActiveRef.current = true; // the other pointer layers stand down
      suppressClickRef.current = true;
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
    };

    // Capture: pen mode outranks drag-to-move, the marquee and part clicks.
    wrap.addEventListener('pointerdown', onDown, true);
    return () => {
      wrap.removeEventListener('pointerdown', onDown, true);
      endSession();
      pending.current = null;
      setVisuals(NO_VISUALS);
    };
    // `html` re-binds after each render so a stale wrap never keeps listeners.
  }, [wrapperRef, host.kind, available, html, dragActiveRef, suppressClickRef]);

  /** Commits the ambiguous-read picker's choice at the remembered cell. */
  const choose = (kind: string): void => {
    const wrap = wrapperRef.current;
    const cell = pending.current;
    const spec = specFor(host.kind);
    pending.current = null;
    if (wrap === null || cell === null || spec === null) {
      setVisuals(NO_VISUALS);
      return;
    }
    const { host: h, data: d } = live.current;
    const placements: Placement[] = [];
    const count = idsOf(spec, d).length;
    for (let i = 0; i < count; i++) {
      const el = wrap.querySelector(`[data-bp="${CSS.escape(`${spec.nodesField}.${i}`)}"]`);
      const col = el !== null ? numAttr(el, 'data-col') : null;
      const row = el !== null ? numAttr(el, 'data-row') : null;
      if (col === null || row === null) break;
      placements.push({ col, row });
    }
    const built = sketchNodeOps(
      spec,
      d,
      cell,
      kind,
      placements.length === count ? placements : undefined,
    );
    setVisuals(NO_VISUALS);
    if (built === null) return;
    h.commitPaths(built.sets);
    h.notify?.(`Drew ${built.label}`);
    live.current.onNodeCreated(built.nodePath, spec.labelField);
  };

  return {
    on,
    visuals,
    available,
    toggle: () => setOn(!onRef.current),
    leave: () => {
      pending.current = null;
      setVisuals(NO_VISUALS);
      setOn(false);
    },
    choose,
  };
}
