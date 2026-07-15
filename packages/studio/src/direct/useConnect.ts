/**
 * The DOM glue for drag-to-connect on diagram blocks (pointer events, same
 * pattern as `useDrag.ts`). All decisions live in `connect.ts`; this hook
 * only measures elements, tracks the pointer, renders the connect visuals
 * through state, and commits on drop:
 *
 * - pointerdown on a connector DOT (DirectLayer renders them on the selected
 *   node's edges) arms a PENDING gesture; travelling past the 6px threshold
 *   turns it into a connect drag (below it, pointerup stays a click);
 * - during the drag: a rubber-band wire follows the pointer and the hovered
 *   target node lights up (a `columnTargets` spec — sequence — extends every
 *   target down to the SVG's bottom, so an actor's lifeline hits like its
 *   header); Esc cancels;
 * - drop on another node → `edgeOp` committed through the {@link DirectHost}
 *   (ONE applyOp / undo step) + a "Connected a → b" toast — or, for an
 *   `editEdgeOnConnect` spec (sequence messages), the new edge is handed back so
 *   the caller selects it and opens the micro-editor on that field;
 * - drop on empty canvas → an anchored SHAPE PICKER (the kind's node kinds);
 *   choosing one commits `newNodeOps` (node + edge, one undo step) and hands
 *   the new node's path back so the caller can select it and open the
 *   micro-editor on its label. A spec with exactly ONE node kind (graph)
 *   skips the picker and creates directly; one with none (sequence) cancels.
 */

import { useEffect, useRef, useState } from 'react';
import {
  edgeOp,
  newNodeOps,
  nodeLabel,
  specFor,
  type ConnectChoice,
  type ConnectKind,
  type ConnectSpec,
} from './connect.js';
import {
  cellAtPoint,
  cellBox,
  isDragGesture,
  MATERIALIZE_TOAST,
  type Box,
  type GridGeom,
  type Placement,
} from './drag.js';
import type { DirectHost } from './host.js';
import { numAttr, readGeom } from './useDrag.js';

/** What DirectLayer renders while a connect gesture / picker is live. */
export interface ConnectVisuals {
  /** Rubber-band wire, wrapper-relative endpoints. */
  readonly wire: { x1: number; y1: number; x2: number; y2: number } | null;
  /** Highlight box of the hovered drop-target node. */
  readonly target: Box | null;
  /** The grid cell an empty-canvas drop would place the new node in. */
  readonly snap: Box | null;
  /**
   * Anchored picker at the drop point: the empty-canvas shape picker (node
   * kinds) or the drop-on-target edge picker (ERD cardinality). Its items are
   * generic `{value, label}`; {@link useConnect}'s `choose` routes the value.
   */
  readonly picker: {
    left: number;
    top: number;
    title: string;
    items: readonly ConnectChoice[];
  } | null;
}

const NO_VISUALS: ConnectVisuals = { wire: null, target: null, snap: null, picker: null };

function relRect(el: Element, wrap: HTMLElement): Box {
  const a = el.getBoundingClientRect();
  const b = wrap.getBoundingClientRect();
  return { left: a.left - b.left, top: a.top - b.top, width: a.width, height: a.height };
}

function bpEl(wrap: HTMLElement, path: string): Element | null {
  return wrap.querySelector(`[data-bp="${CSS.escape(path)}"]`);
}

function nodeIds(spec: ConnectSpec, data: unknown): string[] {
  const rec = data !== null && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const list = rec[spec.nodesField];
  return Array.isArray(list)
    ? list.map((n) => {
        // Nodes are keyed by `spec.idField` — `id` for most kinds, `name` for
        // ERD entities. Reading a fixed `.id` would blank every ERD entity.
        const v =
          n !== null && typeof n === 'object' ? (n as Record<string, unknown>)[spec.idField] : undefined;
        return typeof v === 'string' ? v : '';
      })
    : [];
}

interface Session {
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly fromIndex: number;
  readonly fromId: string;
  /** Wrapper-relative wire origin (the grabbed dot's center). */
  readonly anchor: { x: number; y: number };
  active: boolean;
  /** Wrapper-relative boxes of every node, in index order (measured at activation). */
  boxes: Array<Box | null>;
  targetIndex: number | null;
  /** The diagram SVG's grid geometry + box (measured at activation; null → no grid). */
  geom: GridGeom | null;
  svgBox: Box | null;
}

/**
 * The open picker's committed context. `node` = an empty-canvas shape picker
 * (choosing a kind creates a node + edge); `edge` = a drop-on-target edge
 * picker (choosing a cardinality appends the relation) — ERD.
 */
type PickerState =
  | {
      readonly mode: 'node';
      readonly left: number;
      readonly top: number;
      readonly cell: Placement;
      readonly fromId: string;
      readonly fromIndex: number;
    }
  | {
      readonly mode: 'edge';
      readonly left: number;
      readonly top: number;
      readonly fromId: string;
      readonly toId: string;
    };

export function useConnect(args: {
  host: DirectHost;
  data: unknown;
  html: string;
  wrapperRef: React.RefObject<HTMLElement>;
  /** Set at activation; DirectLayer's click handler consumes it. */
  suppressClickRef: React.MutableRefObject<boolean>;
  /** True while the wire drag is live — DirectLayer pauses hover tracking. */
  dragActiveRef: React.MutableRefObject<boolean>;
  /** Called once when a gesture becomes a connect drag (clear hover state). */
  onConnectStart: () => void;
  /** Called after an empty-canvas drop created a node (select + edit it). */
  onNodeCreated: (nodePath: string, focusField: string) => void;
  /**
   * Called after a connect appended an edge on an `editEdgeOnConnect` spec
   * (sequence messages) — select the new edge and edit that field.
   */
  onEdgeCreated?: (edgePath: string, focusField: string) => void;
}): {
  visuals: ConnectVisuals;
  spec: ConnectSpec | null;
  /** Arms a connect gesture from a dot on node `fromIndex`. */
  start: (e: React.PointerEvent, fromIndex: number, anchor: { x: number; y: number }) => void;
  pickerOpenRef: React.RefObject<boolean>;
  cancelPicker: () => void;
  /** Commits the open picker's choice — a node kind or an edge cardinality. */
  choose: (value: string) => void;
} {
  const { host, data, html, wrapperRef, suppressClickRef, dragActiveRef, onConnectStart, onNodeCreated, onEdgeCreated } = args;
  const spec = specFor(host.kind);
  const [visuals, setVisuals] = useState<ConnectVisuals>(NO_VISUALS);
  const session = useRef<Session | null>(null);
  const picker = useRef<PickerState | null>(null);
  const pickerOpenRef = useRef(false);
  // The latest data/host for the commit (listeners bind per gesture).
  const live = useRef({ host, data, spec, onConnectStart, onNodeCreated, onEdgeCreated });
  live.current = { host, data, spec, onConnectStart, onNodeCreated, onEdgeCreated };

  /** Clears any live gesture AND the picker. */
  const reset = useRef<() => void>(() => {});
  /** `commitNode`, callable from the effect (single-kind specs skip the picker). */
  const chooseKindRef = useRef<(kind: string) => void>(() => {});
  /** The per-render `onStart` binding (the effect owns the listeners). */
  const startRef = useRef<
    ((e: PointerEvent, fromIndex: number, anchor: { x: number; y: number }) => void) | null
  >(null);

  useEffect(() => {
    const wrap = wrapperRef.current;
    if (wrap === null || spec === null) return;

    const clearPicker = (): void => {
      picker.current = null;
      pickerOpenRef.current = false;
      window.removeEventListener('pointerdown', onOutsidePointer, true);
    };

    const cleanup = (): void => {
      const s = session.current;
      session.current = null;
      dragActiveRef.current = false;
      if (s !== null && s.active) {
        document.body.style.userSelect = '';
        wrap.style.cursor = '';
      }
      clearPicker();
      setVisuals(NO_VISUALS);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey, true);
    };
    reset.current = cleanup;

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && session.current?.active === true) {
        e.preventDefault();
        e.stopPropagation();
        cleanup(); // cancel — no commit
      }
    };

    /** While the picker is open, a pointerdown outside it cancels. */
    const onOutsidePointer = (e: PointerEvent): void => {
      if (e.target instanceof Element && e.target.closest('.stu-dx-connect-picker') !== null) return;
      suppressClickRef.current = true; // the trailing click must not deselect
      cleanup();
    };

    const measureBoxes = (count: number): Array<Box | null> =>
      Array.from({ length: count }, (_, i) => {
        const el = bpEl(wrap, `${spec.nodesField}.${i}`);
        return el === null ? null : relRect(el, wrap);
      });

    /** Swap the live drag listeners for the picker's outside-click lifecycle. */
    const enterPickerMode = (): void => {
      pickerOpenRef.current = true;
      document.body.style.userSelect = '';
      wrap.style.cursor = '';
      dragActiveRef.current = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey, true);
      window.addEventListener('pointerdown', onOutsidePointer, true);
    };

    /**
     * Drop-on-target with an `edgeChoices` spec (ERD): show the cardinality
     * picker anchored at the drop, deferring the relation append to `choose`.
     */
    const openEdgePicker = (
      fromId: string,
      toId: string,
      anchor: { x: number; y: number },
      px: number,
      py: number,
    ): void => {
      picker.current = { mode: 'edge', left: px, top: py, fromId, toId };
      setVisuals({
        wire: { x1: anchor.x, y1: anchor.y, x2: px, y2: py },
        target: null,
        snap: null,
        picker: { left: px, top: py, title: 'Cardinality', items: spec.edgeChoices ?? [] },
      });
      enterPickerMode();
    };

    const onMove = (e: PointerEvent): void => {
      const s = session.current;
      if (s === null || e.pointerId !== s.pointerId || picker.current !== null) return;
      if (!s.active) {
        if (!isDragGesture(e.clientX - s.startX, e.clientY - s.startY)) return;
        s.active = true;
        s.boxes = measureBoxes(nodeIds(spec, live.current.data).length);
        const svg = bpEl(wrap, `${spec.nodesField}.${s.fromIndex}`)?.closest('svg') ?? null;
        s.geom = svg !== null ? readGeom(svg) : null;
        s.svgBox = svg !== null ? relRect(svg, wrap) : null;
        if (spec.columnTargets === true && s.svgBox !== null) {
          // Sequence: an actor's whole column (header + lifeline) targets.
          const bottom = s.svgBox.top + s.svgBox.height;
          s.boxes = s.boxes.map((b) => (b === null ? null : { ...b, height: bottom - b.top }));
        }
        dragActiveRef.current = true;
        suppressClickRef.current = true;
        document.body.style.userSelect = 'none';
        wrap.style.cursor = 'crosshair';
        live.current.onConnectStart();
      }
      const wrapRect = wrap.getBoundingClientRect();
      const px = e.clientX - wrapRect.left;
      const py = e.clientY - wrapRect.top;
      let target: number | null = null;
      s.boxes.forEach((b, i) => {
        if (b === null) return;
        if (px >= b.left && px <= b.left + b.width && py >= b.top && py <= b.top + b.height) {
          target = i;
        }
      });
      // The origin node is only a target when the kind allows self-loops.
      if (target === s.fromIndex && !spec.allowSelfLoop) target = null;
      s.targetIndex = target;
      // Off every node: preview the grid cell an empty-canvas drop would use.
      let snap: Box | null = null;
      if (target === null && s.geom !== null && s.svgBox !== null && spec.newNode !== undefined) {
        const raw = cellAtPoint(s.geom, px - s.svgBox.left, py - s.svgBox.top);
        const cell =
          spec.growRows === false ? { col: raw.col, row: Math.min(raw.row, s.geom.rows) } : raw;
        const cb = cellBox(s.geom, cell.col, cell.row);
        snap = {
          left: s.svgBox.left + cb.left,
          top: s.svgBox.top + cb.top,
          width: cb.width,
          height: cb.height,
        };
      }
      setVisuals({
        wire: { x1: s.anchor.x, y1: s.anchor.y, x2: px, y2: py },
        target: target !== null ? (s.boxes[target] as Box) : null,
        snap,
        picker: null,
      });
    };

    const onUp = (e: PointerEvent): void => {
      const s = session.current;
      if (s === null || e.pointerId !== s.pointerId || picker.current !== null) return;
      if (!s.active) {
        cleanup(); // tiny travel — stays a click (dot swallows it)
        return;
      }
      const { host: h, data: d } = live.current;
      const wrapRect = wrap.getBoundingClientRect();
      const px = e.clientX - wrapRect.left;
      const py = e.clientY - wrapRect.top;

      if (s.targetIndex !== null) {
        const toId = nodeIds(spec, d)[s.targetIndex] ?? '';
        if (toId === '') {
          cleanup();
          return;
        }
        // Edge-choice kinds (ERD): defer the commit to a cardinality picker —
        // but reject a self-loop / duplicate up front so it can't be picked.
        if (spec.edgeChoices !== undefined && spec.edgeChoices.length > 0) {
          if (edgeOp(spec, d, s.fromId, toId) === null) {
            h.notify?.(
              `${nodeLabel(spec, d, s.fromId)} and ${nodeLabel(spec, d, toId)} are already connected`,
            );
            cleanup();
            return;
          }
          openEdgePicker(s.fromId, toId, s.anchor, px, py);
          return;
        }
        const sets = edgeOp(spec, d, s.fromId, toId);
        if (sets === null) {
          h.notify?.(
            `${nodeLabel(spec, d, s.fromId)} and ${nodeLabel(spec, d, toId)} are already connected`,
          );
        } else {
          h.commitPaths(sets);
          if (spec.editEdgeOnConnect === true) {
            // Sequence: select the new message and name it immediately.
            const idx = sets[0]?.path[1];
            if (typeof idx === 'number') {
              live.current.onEdgeCreated?.(`${spec.edgesField}.${idx}`, spec.edgeTextField);
            }
          } else {
            h.notify?.(`Connected ${nodeLabel(spec, d, s.fromId)} → ${nodeLabel(spec, d, toId)}`);
          }
        }
        cleanup();
        return;
      }

      // Empty canvas: map the drop to a grid cell and offer the shape picker.
      if (s.geom === null || s.svgBox === null || spec.newNode === undefined || spec.nodeKinds.length === 0) {
        cleanup(); // no grid geometry (layered block, sequence) — cancel
        return;
      }
      const rawCell = cellAtPoint(s.geom, px - s.svgBox.left, py - s.svgBox.top);
      // Swimlane rows are the `lanes` list — a drop can't invent a new lane.
      const cell =
        spec.growRows === false
          ? { col: rawCell.col, row: Math.min(rawCell.row, s.geom.rows) }
          : rawCell;
      const cb = cellBox(s.geom, cell.col, cell.row);
      if (spec.nodeKinds.length === 1) {
        // One node kind (graph) — nothing to pick; create directly.
        picker.current = { mode: 'node', left: px, top: py, cell, fromId: s.fromId, fromIndex: s.fromIndex };
        chooseKindRef.current((spec.nodeKinds[0] as ConnectKind).kind);
        return;
      }
      picker.current = { mode: 'node', left: px, top: py, cell, fromId: s.fromId, fromIndex: s.fromIndex };
      setVisuals({
        wire: { x1: s.anchor.x, y1: s.anchor.y, x2: px, y2: py },
        target: null,
        snap: {
          left: s.svgBox.left + cb.left,
          top: s.svgBox.top + cb.top,
          width: cb.width,
          height: cb.height,
        },
        picker: {
          left: px,
          top: py,
          title: 'Add & connect',
          items: spec.nodeKinds.map((k) => ({ value: k.kind, label: k.label })),
        },
      });
      enterPickerMode();
    };

    const onCancel = (): void => cleanup();

    const onStart = (e: PointerEvent, fromIndex: number, anchor: { x: number; y: number }): void => {
      if (session.current !== null || picker.current !== null) return;
      const fromId = nodeIds(spec, live.current.data)[fromIndex] ?? '';
      if (fromId === '') return;
      suppressClickRef.current = false; // a fresh gesture — clear stale state
      session.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        fromIndex,
        fromId,
        anchor,
        active: false,
        boxes: [],
        targetIndex: null,
        geom: null,
        svgBox: null,
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
  }, [wrapperRef, host.kind, spec, html, dragActiveRef, suppressClickRef]);

  const commitNode = (kind: string): void => {
    const wrap = wrapperRef.current;
    const p = picker.current;
    if (wrap === null || p === null || p.mode !== 'node' || spec === null) return;
    const { host: h, data: d, onNodeCreated: created } = live.current;
    // Effective placements from the renderer's data-col/data-row attrs — lets
    // an auto-laid-out diagram materialize so the drop cell sticks.
    const count = nodeIds(spec, d).length;
    let placements: Placement[] | undefined = [];
    for (let i = 0; i < count; i++) {
      const el = bpEl(wrap, `${spec.nodesField}.${i}`);
      const col = el !== null ? numAttr(el, 'data-col') : null;
      const row = el !== null ? numAttr(el, 'data-row') : null;
      if (col === null || row === null) {
        placements = undefined;
        break;
      }
      placements.push({ col, row });
    }
    const r = newNodeOps(spec, d, p.fromId, p.cell, kind, placements);
    reset.current();
    if (r === null) return;
    h.commitPaths(r.sets);
    if (r.materialized) h.notify?.(MATERIALIZE_TOAST);
    const choice = spec.nodeKinds.find((k) => k.kind === kind);
    const newLabel = choice !== undefined ? `New ${choice.label.toLowerCase()}` : r.id;
    h.notify?.(`Connected ${nodeLabel(spec, d, p.fromId)} → ${newLabel}`);
    created(r.nodePath, spec.labelField);
  };
  chooseKindRef.current = commitNode;

  /** Commits an edge-picker (ERD cardinality) choice: append the relation. */
  const commitEdge = (value: string): void => {
    const p = picker.current;
    if (p === null || p.mode !== 'edge' || spec === null) return;
    const { host: h, data: d } = live.current;
    const extra =
      spec.edgeChoiceField !== undefined ? { [spec.edgeChoiceField]: value } : undefined;
    const sets = edgeOp(spec, d, p.fromId, p.toId, extra);
    reset.current();
    if (sets === null) return;
    h.commitPaths(sets);
    h.notify?.(`Connected ${nodeLabel(spec, d, p.fromId)} → ${nodeLabel(spec, d, p.toId)} (${value})`);
  };

  /** Routes a picker choice to the node or edge committer by its open mode. */
  const choose = (value: string): void => {
    if (picker.current?.mode === 'edge') commitEdge(value);
    else commitNode(value);
  };

  return {
    visuals,
    spec,
    start: (e, fromIndex, anchor) => startRef.current?.(e.nativeEvent, fromIndex, anchor),
    pickerOpenRef,
    cancelPicker: () => reset.current(),
    choose,
  };
}
