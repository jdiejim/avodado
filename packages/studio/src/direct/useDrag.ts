/**
 * The DOM glue for drag-to-move on diagrams (pointer events, not HTML5 DnD —
 * we need pixel math, SVG targets, and live ghosts). All decisions live in
 * `drag.ts`; this hook only measures elements, tracks the pointer, renders
 * drag visuals through state, and commits on drop:
 *
 * - pointerdown on a draggable `data-bp` part arms a PENDING gesture; the
 *   pointer travelling past the 6px threshold turns it into a drag (below it,
 *   pointerup stays a click → micro-editor, exactly as before);
 * - during a drag: a semi-transparent ghost follows the pointer, and either
 *   an insertion indicator (order-based lists) or a snap cell (grid nodes)
 *   marks the drop; Esc cancels;
 * - drop commits through the {@link DirectHost} — always ONE applyOp / undo
 *   step, compound moves composed via `commitPaths`.
 *
 * {@link nudgePart} is the ⌥+arrows twin and {@link moveSelectedPart} the
 * plain-arrow mover for the SELECTED part (v9): the same op builders, one
 * step at a time — plus spreadsheet cell navigation for table cells and a
 * generic any-array reorder for items outside the v8 drag set.
 */

import { useEffect, useRef, useState } from 'react';
import { defaultWriteCell, specFor } from './connect.js';
import {
  applyReorder,
  cellAtPoint,
  cellBox,
  centersAlong,
  dominantAxis,
  dragTargetFor,
  gapPosition,
  gridMoveSets,
  insertionIndex,
  isDragGesture,
  kanbanCardMoveSets,
  ringGap,
  ringGapPoint,
  tableColumnReorderSets,
  MATERIALIZE_TOAST,
  type Box,
  type DragTarget,
  type GridGeom,
  type Placement,
  type Point,
} from './drag.js';
import {
  groupMoveSets,
  groupRangeAt,
  groupResizeSets,
  growRange,
  moveRangeBy,
  rangeBox,
  type CellRange,
} from './groupMarquee.js';
import type { DirectHost } from './host.js';
import { parseBlockPath, valueAt } from './paths.js';
import {
  classifyPart,
  kanbanPathAfterMove,
  pathAfterReorder,
  planCellNav,
  planItemArrow,
  type ArrowKey,
} from './partSelect.js';

/** What DirectLayer renders while a drag is live. */
export interface DragVisuals {
  readonly ghost: { readonly box: Box; readonly label: string } | null;
  /** Insertion indicator (order-based reorder), wrapper-relative. */
  readonly drop: Box | null;
  /** Snap cell highlight (grid moves), wrapper-relative. */
  readonly snap: Box | null;
}

const NO_VISUALS: DragVisuals = { ghost: null, drop: null, snap: null };

/** Rect of `el` relative to `wrap`. */
function relRect(el: Element, wrap: HTMLElement): Box {
  const a = el.getBoundingClientRect();
  const b = wrap.getBoundingClientRect();
  return { left: a.left - b.left, top: a.top - b.top, width: a.width, height: a.height };
}

function bpEl(wrap: HTMLElement, path: string): Element | null {
  return wrap.querySelector(`[data-bp="${CSS.escape(path)}"]`);
}

/** Wrapper-relative boxes of `list.0 … list.(count-1)`, or null if any is missing. */
function itemBoxes(wrap: HTMLElement, listPath: string, count: number): Box[] | null {
  const out: Box[] = [];
  for (let i = 0; i < count; i++) {
    const el = bpEl(wrap, `${listPath}.${i}`);
    if (el === null) return null;
    out.push(relRect(el, wrap));
  }
  return out;
}

function listOf(data: unknown, listPath: string): unknown[] | null {
  const v = valueAt(data, parseBlockPath(listPath));
  return Array.isArray(v) ? v : null;
}

/** A finite numeric `data-*` attribute, or null. */
export function numAttr(el: Element, name: string): number | null {
  const raw = el.getAttribute(name);
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Reads the grid geometry a grid-diagram SVG advertises (null → not a grid).
 * Emitted by the block renderer and the flow/dfd/state/c4 renderers alike —
 * drag-to-move and drag-to-connect share it.
 */
export function readGeom(svg: SVGSVGElement): GridGeom | null {
  const cellW = numAttr(svg, 'data-cell-w');
  const cellH = numAttr(svg, 'data-cell-h');
  const gapX = numAttr(svg, 'data-gap-x');
  const gapY = numAttr(svg, 'data-gap-y');
  const padX = numAttr(svg, 'data-pad-x');
  const padTop = numAttr(svg, 'data-pad-top');
  const cols = numAttr(svg, 'data-cols');
  const rows = numAttr(svg, 'data-rows');
  if (
    cellW === null || cellH === null || gapX === null || gapY === null ||
    padX === null || padTop === null || cols === null || rows === null
  ) {
    return null;
  }
  const vbW = svg.viewBox.baseVal.width;
  const cssW = svg.getBoundingClientRect().width;
  if (vbW <= 0 || cssW <= 0) return null;
  return { cellW, cellH, gapX, gapY, padX, padTop, cols, rows, scale: cssW / vbW };
}

/** Effective placements of `list.0 … list.(count-1)` from their data attrs. */
function readPlacements(wrap: HTMLElement, listPath: string, count: number): Placement[] | null {
  const out: Placement[] = [];
  for (let i = 0; i < count; i++) {
    const el = bpEl(wrap, `${listPath}.${i}`);
    if (el === null) return null;
    const col = numAttr(el, 'data-col');
    const row = numAttr(el, 'data-row');
    if (col === null || row === null) return null;
    out.push({ col, row });
  }
  return out;
}

function ghostLabel(el: Element): string {
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  return text.length > 42 ? `${text.slice(0, 41)}…` : text;
}

/** True when this part can actually start a drag right now (used for cursors too). */
export function draggableTarget(
  wrap: HTMLElement,
  kind: string,
  path: string,
): DragTarget | null {
  const target = dragTargetFor(kind, path);
  if (target === null) return null;
  if (target.mode === 'grid-node' || target.mode === 'grid-group') {
    // Grid moves need the renderer's grid metadata (grid layout only).
    const itemPath =
      target.mode === 'grid-node'
        ? `${target.listPath}.${target.index}`
        : `groups.${target.index}`;
    const el = bpEl(wrap, itemPath);
    const svg = el?.closest('svg');
    if (svg === null || svg === undefined || !svg.hasAttribute('data-grid')) return null;
  }
  return target;
}

/* ─── the drag session (mutable, outside React state) ─────────────────────── */

interface ReorderCtx {
  readonly kind: 'reorder';
  /** True for table columns: the drop commits the compound columns+rows sets. */
  readonly compound: boolean;
  readonly listPath: string;
  readonly index: number;
  readonly axis: 'x' | 'y';
  readonly boxes: readonly Box[];
  readonly centers: readonly number[];
  gap: number | null;
}

interface KanbanCtx {
  readonly kind: 'kanban-card';
  readonly col: number;
  readonly index: number;
  readonly colBoxes: readonly Box[];
  readonly cardBoxes: ReadonlyArray<readonly Box[]>;
  to: { col: number; gap: number } | null;
}

interface GridCtx {
  readonly kind: 'grid-node';
  /** The node list field (`nodes`, `states`, `steps`) from the connect spec. */
  readonly listPath: string;
  readonly index: number;
  readonly geom: GridGeom;
  readonly svgBox: Box;
  readonly placements: readonly Placement[];
  readonly quick: boolean;
  readonly w: number;
  /** False → the drag may not grow the grid by a row (swimlane lanes). */
  readonly growRows: boolean;
  readonly writeCell: (cell: Placement) => Readonly<Record<string, number>>;
  cell: Placement | null;
}

interface GroupCtx {
  readonly kind: 'grid-group';
  readonly index: number;
  readonly geom: GridGeom;
  readonly svgBox: Box;
  /** The group's range at drag start (the delta applies against it). */
  readonly range: CellRange;
  /** The cell grabbed at drag start (delta = hovered cell − this). */
  readonly startCell: Placement;
  target: CellRange | null;
}

interface RingCtx {
  readonly kind: 'ring';
  readonly listPath: string;
  readonly index: number;
  /** Stage pill centers, in step order (the ring is uniformly spaced). */
  readonly centers: readonly Point[];
  gap: number | null;
}

type DragCtx = ReorderCtx | KanbanCtx | GridCtx | GroupCtx | RingCtx;

interface Session {
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly path: string;
  readonly target: DragTarget;
  readonly itemEl: Element;
  active: boolean;
  startBox: Box;
  label: string;
  ctx: DragCtx | null;
}

export function useDiagramDrag(args: {
  host: DirectHost;
  data: unknown;
  html: string;
  wrapperRef: React.RefObject<HTMLElement>;
  /** True while the micro-editor is open — no drags then. */
  editorOpenRef: React.MutableRefObject<boolean>;
  /** Set at drag activation; DirectLayer's click handler consumes it. */
  suppressClickRef: React.MutableRefObject<boolean>;
  /** True while a drag is live — DirectLayer pauses hover tracking. */
  dragActiveRef: React.MutableRefObject<boolean>;
  /** Called once when a gesture becomes a drag (clear hover state). */
  onDragStart: () => void;
  /** Called after a committed drop with the moved part's NEW path (follow it). */
  onDrop?: ((newPath: string) => void) | undefined;
}): DragVisuals {
  const { host, data, html, wrapperRef, editorOpenRef, suppressClickRef, dragActiveRef, onDragStart, onDrop } = args;
  const [visuals, setVisuals] = useState<DragVisuals>(NO_VISUALS);
  const session = useRef<Session | null>(null);
  // The latest data/host for the commit (the effect below re-binds rarely).
  const live = useRef({ host, data, onDragStart, onDrop });
  live.current = { host, data, onDragStart, onDrop };

  useEffect(() => {
    const wrap = wrapperRef.current;
    if (wrap === null) return;

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

    /** Builds the per-mode measuring context at drag activation. */
    const buildCtx = (s: Session): DragCtx | null => {
      const d = live.current.data;
      const t = s.target;
      if (t.mode === 'reorder' || t.mode === 'table-cols') {
        const listPath = t.mode === 'table-cols' ? 'columns' : t.listPath;
        const arr = listOf(d, listPath);
        if (arr === null || arr.length < 2) return null;
        const boxes = itemBoxes(wrap, listPath, arr.length);
        if (boxes === null) return null;
        const axis = t.mode === 'table-cols' ? 'x' : dominantAxis(boxes);
        return {
          kind: 'reorder',
          compound: t.mode === 'table-cols',
          listPath,
          index: t.index,
          axis,
          boxes,
          centers: centersAlong(boxes, axis),
          gap: null,
        };
      }
      if (t.mode === 'kanban-card') {
        const cols = listOf(d, 'columns');
        if (cols === null || cols.length === 0) return null;
        const colBoxes = itemBoxes(wrap, 'columns', cols.length);
        if (colBoxes === null) return null;
        const cardBoxes = cols.map((c, ci) => {
          const cards = Array.isArray((c as { cards?: unknown[] })?.cards)
            ? ((c as { cards: unknown[] }).cards)
            : [];
          return itemBoxes(wrap, `columns.${ci}.cards`, cards.length) ?? [];
        });
        return { kind: 'kanban-card', col: t.col, index: t.index, colBoxes, cardBoxes, to: null };
      }
      if (t.mode === 'grid-group') {
        const gsvg = s.itemEl.closest('svg');
        if (gsvg === null || !gsvg.hasAttribute('data-grid')) return null;
        const ggeom = readGeom(gsvg);
        if (ggeom === null) return null;
        const range = groupRangeAt(d, t.index);
        if (range === null) return null;
        const svgBox = relRect(gsvg, wrap);
        const wrapRect = wrap.getBoundingClientRect();
        const startCell = cellAtPoint(
          ggeom,
          s.startX - wrapRect.left - svgBox.left,
          s.startY - wrapRect.top - svgBox.top,
        );
        return { kind: 'grid-group', index: t.index, geom: ggeom, svgBox, range, startCell, target: null };
      }
      if (t.mode === 'ring') {
        // Cycle stages: reorder by pointer angle around the ring.
        const arr = listOf(d, t.listPath);
        if (arr === null || arr.length < 2) return null;
        const boxes = itemBoxes(wrap, t.listPath, arr.length);
        if (boxes === null) return null;
        return {
          kind: 'ring',
          listPath: t.listPath,
          index: t.index,
          centers: boxes.map((b) => ({ x: b.left + b.width / 2, y: b.top + b.height / 2 })),
          gap: null,
        };
      }
      // grid-node
      const svg = s.itemEl.closest('svg');
      if (svg === null || !svg.hasAttribute('data-grid')) return null;
      const geom = readGeom(svg);
      if (geom === null) return null;
      const spec = specFor(live.current.host.kind);
      const nodes = listOf(d, t.listPath);
      if (nodes === null) return null;
      const placements = readPlacements(wrap, t.listPath, nodes.length);
      if (placements === null) return null;
      return {
        kind: 'grid-node',
        listPath: t.listPath,
        index: t.index,
        geom,
        svgBox: relRect(svg, wrap),
        placements,
        quick: svg.hasAttribute('data-grid-auto'),
        w: numAttr(s.itemEl, 'data-w') ?? 1,
        growRows: spec?.growRows !== false,
        writeCell: spec?.writeCell ?? defaultWriteCell,
        cell: null,
      };
    };

    const onMove = (e: PointerEvent): void => {
      const s = session.current;
      if (s === null || e.pointerId !== s.pointerId) return;
      if (!s.active) {
        if (!isDragGesture(e.clientX - s.startX, e.clientY - s.startY)) return;
        const ctx = buildCtx(s);
        if (ctx === null) {
          session.current = null; // nothing draggable — stay a click
          return;
        }
        s.ctx = ctx;
        s.active = true;
        s.startBox = relRect(s.itemEl, wrap);
        s.label = ghostLabel(s.itemEl);
        dragActiveRef.current = true;
        suppressClickRef.current = true;
        document.body.style.userSelect = 'none';
        wrap.style.cursor = 'grabbing';
        live.current.onDragStart();
      }
      const wrapRect = wrap.getBoundingClientRect();
      const px = e.clientX - wrapRect.left;
      const py = e.clientY - wrapRect.top;
      const ghost = {
        box: {
          left: s.startBox.left + (e.clientX - s.startX),
          top: s.startBox.top + (e.clientY - s.startY),
          width: s.startBox.width,
          height: s.startBox.height,
        },
        label: s.label,
      };
      const ctx = s.ctx as DragCtx;
      if (ctx.kind === 'ring') {
        // The nearest angular seam between two stages marks the drop.
        ctx.gap = ringGap(ctx.centers, px, py);
        if (ctx.gap === null) return;
        const p = ringGapPoint(ctx.centers, ctx.gap);
        setVisuals({
          ghost,
          drop: { left: p.x - 5, top: p.y - 5, width: 10, height: 10 },
          snap: null,
        });
        return;
      }
      if (ctx.kind === 'grid-group') {
        // The whole range follows the pointer by whole-cell deltas, clamped
        // like the create-marquee (one col/row of growth past the grid).
        const cell = cellAtPoint(ctx.geom, px - ctx.svgBox.left, py - ctx.svgBox.top);
        const next = moveRangeBy(
          ctx.range,
          cell.col - ctx.startCell.col,
          cell.row - ctx.startCell.row,
          ctx.geom.cols,
          ctx.geom.rows,
        );
        ctx.target = next;
        const rb = rangeBox(ctx.geom, next);
        setVisuals({
          ghost,
          drop: null,
          snap: {
            left: ctx.svgBox.left + rb.left,
            top: ctx.svgBox.top + rb.top,
            width: rb.width,
            height: rb.height,
          },
        });
        return;
      }
      if (ctx.kind === 'reorder') {
        const pointer = ctx.axis === 'x' ? px : py;
        ctx.gap = insertionIndex(ctx.centers, pointer);
        const pos = gapPosition(ctx.boxes, ctx.axis, ctx.gap);
        const lo = Math.min(...ctx.boxes.map((b) => (ctx.axis === 'x' ? b.top : b.left))) - 4;
        const hi =
          Math.max(
            ...ctx.boxes.map((b) => (ctx.axis === 'x' ? b.top + b.height : b.left + b.width)),
          ) + 4;
        const drop: Box =
          ctx.axis === 'x'
            ? { left: pos - 1.5, top: lo, width: 3, height: hi - lo }
            : { left: lo, top: pos - 1.5, width: hi - lo, height: 3 };
        setVisuals({ ghost, drop, snap: null });
        return;
      }
      if (ctx.kind === 'kanban-card') {
        // Target column: the one under the pointer, else the nearest by center.
        let col = ctx.colBoxes.findIndex((b) => px >= b.left && px <= b.left + b.width);
        if (col < 0) {
          let best = Infinity;
          ctx.colBoxes.forEach((b, i) => {
            const d = Math.abs(px - (b.left + b.width / 2));
            if (d < best) {
              best = d;
              col = i;
            }
          });
        }
        const cards = ctx.cardBoxes[col] ?? [];
        const gap = insertionIndex(centersAlong(cards, 'y'), py);
        ctx.to = { col, gap };
        const colBox = ctx.colBoxes[col] as Box;
        const pos =
          cards.length > 0 ? gapPosition(cards, 'y', gap) : colBox.top + Math.min(38, colBox.height - 8);
        const drop: Box = { left: colBox.left + 6, top: pos - 1.5, width: colBox.width - 12, height: 3 };
        setVisuals({ ghost, drop, snap: null });
        return;
      }
      // grid-node
      const raw = cellAtPoint(ctx.geom, px - ctx.svgBox.left, py - ctx.svgBox.top);
      // Swimlane rows are the `lanes` list — a drag can't invent a new lane.
      const cell = ctx.growRows ? raw : { col: raw.col, row: Math.min(raw.row, ctx.geom.rows) };
      ctx.cell = cell;
      const cb = cellBox(ctx.geom, cell.col, cell.row, ctx.w);
      setVisuals({
        ghost,
        drop: null,
        snap: {
          left: ctx.svgBox.left + cb.left,
          top: ctx.svgBox.top + cb.top,
          width: cb.width,
          height: cb.height,
        },
      });
    };

    /** Commits the drop; returns the moved part's NEW path (selection follow). */
    const commit = (s: Session): string | null => {
      const { host: h, data: d } = live.current;
      const ctx = s.ctx;
      if (ctx === null) return null;
      if (ctx.kind === 'reorder') {
        if (ctx.gap === null) return null;
        if (ctx.compound) {
          const sets = tableColumnReorderSets(d, ctx.index, ctx.gap);
          if (sets === null) return null;
          h.commitPaths(sets);
          return pathAfterReorder('columns', ctx.index, ctx.gap);
        }
        const arr = listOf(d, ctx.listPath);
        if (arr === null) return null;
        const next = applyReorder(arr, ctx.index, ctx.gap);
        if (next === null) return null;
        h.commitPath([ctx.listPath], next);
        return pathAfterReorder(ctx.listPath, ctx.index, ctx.gap);
      }
      if (ctx.kind === 'kanban-card') {
        if (ctx.to === null) return null;
        const sets = kanbanCardMoveSets(d, ctx.col, ctx.index, ctx.to.col, ctx.to.gap);
        if (sets === null) return null;
        h.commitPaths(sets);
        return kanbanPathAfterMove({
          fromCol: ctx.col,
          fromIdx: ctx.index,
          toCol: ctx.to.col,
          gap: ctx.to.gap,
          targetLen: (ctx.cardBoxes[ctx.to.col] ?? []).length,
        });
      }
      if (ctx.kind === 'grid-group') {
        if (ctx.target === null) return null;
        const sets = groupMoveSets(d, ctx.index, ctx.target);
        if (sets === null) return null;
        h.commitPaths(sets);
        return `groups.${ctx.index}`;
      }
      if (ctx.kind === 'ring') {
        if (ctx.gap === null) return null;
        const arr = listOf(d, ctx.listPath);
        if (arr === null) return null;
        const next = applyReorder(arr, ctx.index, ctx.gap);
        if (next === null) return null;
        h.commitPath([ctx.listPath], next);
        return pathAfterReorder(ctx.listPath, ctx.index, ctx.gap);
      }
      // grid-node
      if (ctx.cell === null) return null;
      const r = gridMoveSets({
        placements: ctx.placements,
        index: ctx.index,
        target: ctx.cell,
        quick: ctx.quick,
        field: ctx.listPath,
        writeCell: ctx.writeCell,
      });
      if (r === null) return null;
      h.commitPaths(r.sets);
      if (r.materialized) h.notify?.(MATERIALIZE_TOAST);
      return `${ctx.listPath}.${ctx.index}`;
    };

    const onUp = (e: PointerEvent): void => {
      const s = session.current;
      if (s === null || e.pointerId !== s.pointerId) return;
      if (s.active) {
        const newPath = commit(s);
        if (newPath !== null) live.current.onDrop?.(newPath);
      }
      cleanup();
    };
    const onCancel = (): void => cleanup();

    const onDown = (e: PointerEvent): void => {
      if (e.button !== 0 || session.current !== null) return;
      suppressClickRef.current = false; // a fresh gesture — clear stale state
      if (editorOpenRef.current) return;
      if (!(e.target instanceof Element)) return;
      if (e.target.closest('.stu-dx-overlay') !== null) return; // our own controls
      const el = e.target.closest('[data-bp]');
      if (el === null || !wrap.contains(el)) return;
      const path = el.getAttribute('data-bp') ?? '';
      const target = draggableTarget(wrap, host.kind, path);
      if (target === null) return;
      const itemPath =
        target.mode === 'table-cols'
          ? `columns.${target.index}`
          : target.mode === 'kanban-card'
            ? `columns.${target.col}.cards.${target.index}`
            : target.mode === 'grid-group'
              ? `groups.${target.index}`
              : `${target.listPath}.${target.index}`;
      const itemEl = bpEl(wrap, itemPath);
      if (itemEl === null) return;
      session.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        path,
        target,
        itemEl,
        active: false,
        startBox: { left: 0, top: 0, width: 0, height: 0 },
        label: '',
        ctx: null,
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
  }, [wrapperRef, host.kind, html]);

  return visuals;
}

/* ─── keyboard parity: ⌥ + arrows nudges the hovered/edited part ──────────── */

/**
 * Applies a one-step move to the part at `path` (reorder by one along the
 * list's axis; move one grid cell). Returns the part's NEW `data-bp` path so
 * the caller can keep keyboard focus on it, or null when the key doesn't
 * apply (wrong axis, edge of the list, not draggable).
 */
export function nudgePart(args: {
  wrap: HTMLElement;
  host: DirectHost;
  data: unknown;
  path: string;
  key: ArrowKey;
}): string | null {
  const { wrap, host, data, path, key } = args;
  const target = draggableTarget(wrap, host.kind, path);
  if (target === null) return null;
  const dir = key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1;
  const horizontal = key === 'ArrowLeft' || key === 'ArrowRight';

  if (target.mode === 'reorder' || target.mode === 'table-cols') {
    const listPath = target.mode === 'table-cols' ? 'columns' : target.listPath;
    const arr = listOf(data, listPath);
    if (arr === null) return null;
    const boxes = itemBoxes(wrap, listPath, arr.length);
    if (boxes === null) return null;
    const axis = target.mode === 'table-cols' ? 'x' : dominantAxis(boxes);
    if ((axis === 'x') !== horizontal) return null;
    const gap = dir < 0 ? target.index - 1 : target.index + 2;
    if (target.mode === 'table-cols') {
      const sets = tableColumnReorderSets(data, target.index, gap);
      if (sets === null) return null;
      host.commitPaths(sets);
      return `columns.${target.index + dir}`;
    }
    const next = applyReorder(arr, target.index, gap);
    if (next === null) return null;
    host.commitPath([listPath], next);
    return `${listPath}.${target.index + dir}`;
  }

  if (target.mode === 'kanban-card') {
    if (!horizontal) {
      const gap = dir < 0 ? target.index - 1 : target.index + 2;
      const sets = kanbanCardMoveSets(data, target.col, target.index, target.col, gap);
      if (sets === null) return null;
      host.commitPaths(sets);
      return `columns.${target.col}.cards.${target.index + dir}`;
    }
    const cols = listOf(data, 'columns');
    const toCol = target.col + dir;
    if (cols === null || toCol < 0 || toCol >= cols.length) return null;
    const dstCards = (cols[toCol] as { cards?: unknown[] })?.cards;
    const dstLen = Array.isArray(dstCards) ? dstCards.length : 0;
    const gap = Math.min(target.index, dstLen);
    const sets = kanbanCardMoveSets(data, target.col, target.index, toCol, gap);
    if (sets === null) return null;
    host.commitPaths(sets);
    return `columns.${toCol}.cards.${gap}`;
  }

  if (target.mode === 'grid-group') {
    // Move the whole range one cell (same clamps as the pointer drag).
    const gel = bpEl(wrap, `groups.${target.index}`);
    const gsvg = gel?.closest('svg');
    if (gsvg === null || gsvg === undefined) return null;
    const ggeom = readGeom(gsvg);
    const range = ggeom !== null ? groupRangeAt(data, target.index) : null;
    if (ggeom === null || range === null) return null;
    const next = moveRangeBy(
      range,
      horizontal ? dir : 0,
      horizontal ? 0 : dir,
      ggeom.cols,
      ggeom.rows,
    );
    const sets = groupMoveSets(data, target.index, next);
    if (sets === null) return null;
    host.commitPaths(sets);
    return path;
  }

  if (target.mode === 'ring') {
    // Cycle stages: ←/↑ move the stage earlier, →/↓ later (no axis on a ring).
    const arr = listOf(data, target.listPath);
    if (arr === null) return null;
    const gap = dir < 0 ? target.index - 1 : target.index + 2;
    const next = applyReorder(arr, target.index, gap);
    if (next === null) return null;
    host.commitPath([target.listPath], next);
    return `${target.listPath}.${target.index + dir}`;
  }

  // grid-node
  const spec = specFor(host.kind);
  const el = bpEl(wrap, `${target.listPath}.${target.index}`);
  const svg = el?.closest('svg');
  if (svg === null || svg === undefined) return null;
  const geom = readGeom(svg);
  const nodes = listOf(data, target.listPath);
  if (geom === null || nodes === null) return null;
  const placements = readPlacements(wrap, target.listPath, nodes.length);
  if (placements === null) return null;
  const cur = placements[target.index];
  if (cur === undefined) return null;
  const rowMax = spec?.growRows === false ? geom.rows : geom.rows + 1;
  const cell = {
    col: Math.max(1, Math.min(geom.cols + 1, cur.col + (horizontal ? dir : 0))),
    row: Math.max(1, Math.min(rowMax, cur.row + (horizontal ? 0 : dir))),
  };
  const r = gridMoveSets({
    placements,
    index: target.index,
    target: cell,
    quick: svg.hasAttribute('data-grid-auto'),
    field: target.listPath,
    writeCell: spec?.writeCell ?? defaultWriteCell,
  });
  if (r === null) return null;
  host.commitPaths(r.sets);
  if (r.materialized) host.notify?.(MATERIALIZE_TOAST);
  return path;
}

/* ─── plain arrows on the SELECTED part (v9) ──────────────────────────────── */

/**
 * Applies one arrow press to the selected part:
 *
 * - table cell → NAVIGATE the cell cursor (`moved: false`, YAML untouched);
 * - grid node / group / kanban card / table column / v8-mapped items → same
 *   op path as the ⌥-nudge (axis-gated, swap-if-occupied, quick-mode
 *   materialize); a group with `grow` (⇧ held) grows/shrinks its span by one
 *   col/row instead of moving;
 * - any OTHER array item (glossary terms, faq items, steps, messages, …) →
 *   generic reorder along the list's measured axis.
 *
 * Returns the part's new `data-bp` path (the selection follows it), or null
 * when the key doesn't apply.
 */
export function moveSelectedPart(args: {
  wrap: HTMLElement;
  host: DirectHost;
  data: unknown;
  path: string;
  key: ArrowKey;
  /** ⇧ held: grow/shrink instead of move (grid groups only). */
  grow?: boolean;
}): { path: string; moved: boolean } | null {
  const { wrap, host, data, path, key } = args;
  const cls = classifyPart(host.kind, path);
  if (cls.kind === 'inert') return null;

  if (cls.kind === 'grid-group' && args.grow === true) {
    // ⇧ + arrows: the far edge grows/shrinks by one col/row (origin fixed).
    const el = bpEl(wrap, `groups.${cls.index}`);
    const svg = el?.closest('svg');
    if (svg === null || svg === undefined) return null;
    const geom = readGeom(svg);
    const range = geom !== null ? groupRangeAt(data, cls.index) : null;
    if (geom === null || range === null) return null;
    const horizontal = key === 'ArrowLeft' || key === 'ArrowRight';
    const dir = key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1;
    const next = growRange(range, horizontal ? 'x' : 'y', dir, geom.cols, geom.rows);
    const sets = next !== null ? groupResizeSets(data, cls.index, next) : null;
    if (sets === null) return null;
    host.commitPaths(sets);
    return { path, moved: true };
  }

  if (cls.kind === 'table-cell') {
    const rows = listOf(data, 'rows');
    if (rows === null) return null;
    const next = planCellNav({
      row: cls.row,
      col: cls.col,
      key,
      rowCount: rows.length,
      colsInRow: (r) => (Array.isArray(rows[r]) ? (rows[r] as unknown[]).length : 0),
    });
    return next === null ? null : { path: `rows.${next.row}.${next.col}`, moved: false };
  }

  if (cls.kind === 'grid' && `${cls.listPath}.${cls.index}` !== path) {
    // A leaf inside a grid node (a state's name text): move the NODE — the
    // selection stays on the leaf (the node keeps its index).
    const p = nudgePart({ wrap, host, data, path: `${cls.listPath}.${cls.index}`, key });
    return p === null ? null : { path, moved: true };
  }

  if (cls.kind === 'item' && dragTargetFor(host.kind, path) === null) {
    // Generic array item — reorder along the measured axis.
    const arr = listOf(data, cls.listPath);
    if (arr === null) return null;
    const boxes = itemBoxes(wrap, cls.listPath, arr.length);
    if (boxes === null) return null;
    const plan = planItemArrow({
      axis: dominantAxis(boxes),
      key,
      index: cls.index,
      length: arr.length,
    });
    if (plan === null) return null;
    const next = applyReorder(arr, cls.index, plan.gap);
    if (next === null) return null;
    host.commitPath(parseBlockPath(cls.listPath), next);
    // A leaf selection (`terms.0.term`) stays on the same leaf after the move.
    return { path: `${cls.listPath}.${plan.newIndex}${cls.suffix ?? ''}`, moved: true };
  }

  // Everything else shares the ⌥-nudge op path.
  const p = nudgePart({ wrap, host, data, path, key });
  return p === null ? null : { path: p, moved: true };
}
