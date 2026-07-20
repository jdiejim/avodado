/**
 * The direct-edit layer over one rendered block. Mounted inside the block's
 * relative-positioned wrapper (the canvas segment shell, or the Edit Sheet's
 * preview), it turns the renderer's `data-bp` / `data-bl` tags into:
 *
 * - a hover highlight (overlay rectangle + humanized path chip — works for
 *   HTML and SVG alike, no CSS outline on SVG) that ALSO lights up the path's
 *   twin representations (a sequence message's diagram row ↔ its step <li>);
 * - click → PART SELECTION (canvas): a persistent outline plus a hint chip;
 *   ⏎ (or a second click / double-click) opens the micro-editor for exactly
 *   that YAML value (twins flash, HTML twins scroll into view), plain arrows
 *   MOVE the part (grid cells / list reorder / spreadsheet cell navigation
 *   on table cells), ⌫ deletes an item, ⇥ cycles parts, Esc pops back to the
 *   block level — see `partSelect.ts` for the pure rules. In the Edit
 *   Sheet's preview a click still opens the micro-editor directly;
 * - a hover "×" on array items for one-click removal;
 * - drag-to-move on diagram parts (pointer events, 6px intent threshold):
 *   order-based lists reorder with a live insertion indicator, block-graph
 *   nodes snap to grid cells — see `useDrag.ts` / `drag.ts`; a completed
 *   drop leaves the moved part SELECTED; ⌥+arrows still nudge the hovered
 *   or edited part;
 * - "+ Add <singular>" ghost chips for tagged arrays (an add bar after the
 *   block for index-free lists, plus in-place chips for nested HTML lists
 *   like a kanban column's cards) — plus a "＋ Add step descriptions" chip on
 *   sequences with messages but no summaries yet;
 * - form↔diagram linkage highlights (`linkPath`, sheet only).
 *
 * Everything positions itself from getBoundingClientRect deltas against the
 * wrapper, so SVG `<g>` elements work the same as HTML nodes.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { describeBlockSchema } from '@avodado/core';
import { needsPartDeleteConfirm } from '../lib/confirmDelete.js';
import { isEditableTarget } from '../lib/dom.js';
import { useStudio } from '../state/store.js';
import { emitTourAction } from '../tour/bus.js';
import {
  addColumnSets,
  columnIndexFromPath,
  columnSpecFor,
  deleteColumnSets,
} from './columnOps.js';
import { edgeIndexFromPath, nodeIndexFromPath } from './connect.js';
import { needsStepPrompt, twinIndices } from './duals.js';
import { fixupNewItem } from './seedItem.js';
import type { DirectHost } from './host.js';
import { MicroEditor, type Rect } from './MicroEditor.js';
import { groupIndexFromPath, supportsGroups, type GroupCorner } from './groupMarquee.js';
import { capturesArrows, classifyPart, deletablePathFor, type ArrowKey } from './partSelect.js';
import { useConnect } from './useConnect.js';
import { useGroupMarquee } from './useGroupMarquee.js';
import { cornerCursor, useGroupResize } from './useGroupResize.js';
import { draggableTarget, moveSelectedPart, nudgePart, useDiagramDrag } from './useDrag.js';
import {
  humanizeFieldName,
  humanizePath,
  isItemPath,
  joinBlockPath,
  newItemForList,
  parseBlockPath,
  resolveFieldAt,
  singularize,
  valueAt,
} from './paths.js';

interface Hover {
  readonly path: string;
  readonly rect: Rect;
  /** Rects of the path's OTHER representations (diagram row ↔ step <li>). */
  readonly twins: readonly Rect[];
}

interface AddChip {
  readonly listPath: string;
  readonly label: string;
  /** In-place chips carry a wrapper-relative anchor; bar chips do not. */
  readonly at?: { left: number; top: number };
}

const HINT_KEY = 'avodado-studio-direct-hint-dismissed';

/** The four connector-dot anchors (N/E/S/W midpoints) of a node's rect. */
function connectorDots(r: Rect): ReadonlyArray<{ side: string; x: number; y: number }> {
  return [
    { side: 'top', x: r.left + r.width / 2, y: r.top },
    { side: 'right', x: r.left + r.width, y: r.top + r.height / 2 },
    { side: 'bottom', x: r.left + r.width / 2, y: r.top + r.height },
    { side: 'left', x: r.left, y: r.top + r.height / 2 },
  ];
}

/** The four corner resize handles of a selected group's rect. */
function resizeHandles(r: Rect): ReadonlyArray<{ corner: GroupCorner; x: number; y: number }> {
  return [
    { corner: 'nw', x: r.left, y: r.top },
    { corner: 'ne', x: r.left + r.width, y: r.top },
    { corner: 'sw', x: r.left, y: r.top + r.height },
    { corner: 'se', x: r.left + r.width, y: r.top + r.height },
  ];
}

/** Rect of `el` relative to `wrap`. */
function relRect(el: Element, wrap: HTMLElement): Rect {
  const a = el.getBoundingClientRect();
  const b = wrap.getBoundingClientRect();
  return { left: a.left - b.left, top: a.top - b.top, width: a.width, height: a.height };
}

/**
 * The other elements in `wrap` carrying the same `data-bp` as `el`. The
 * studio's own invisible hit-area clones (`.stu-dx-hit`) are excluded — they
 * sit exactly on top of the real arrow and would only double a highlight.
 */
function twinElsOf(wrap: HTMLElement, path: string, self: Element | null): Element[] {
  const els = Array.from(wrap.querySelectorAll('[data-bp]')).filter(
    (e) => e.closest('.stu-dx-hit') === null,
  );
  const paths = els.map((e) => e.getAttribute('data-bp') ?? '');
  return twinIndices(paths, path, self !== null ? els.indexOf(self) : -1).map(
    (i) => els[i] as Element,
  );
}

/** One rendered SVG's invisible wide-stroke clones of its arrow paths. */
interface HitLayer {
  readonly box: Rect;
  readonly viewBox: string;
  readonly paths: ReadonlyArray<{ readonly bp: string; readonly d: string }>;
}

/** Every distinct `data-bp` path in the block, in DOM (pre)order — ⇥ cycling. */
function uniquePartPaths(wrap: HTMLElement): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const el of Array.from(wrap.querySelectorAll('[data-bp]'))) {
    const p = el.getAttribute('data-bp') ?? '';
    if (p !== '' && !seen.has(p)) {
      seen.add(p);
      out.push(p);
    }
  }
  return out;
}

export function DirectLayer({ host, data, html, wrapperRef, segIndex, linkPath, onElementClick, showHint }: {
  host: DirectHost;
  /** The block's parsed data (paths are read against it). */
  data: unknown;
  /** The rendered HTML — its identity drives re-measurement. */
  html: string;
  /** The relative-positioned wrapper that contains the rendered HTML. */
  wrapperRef: React.RefObject<HTMLElement>;
  /**
   * Canvas only: this block's segment index — enables PART SELECTION (click
   * selects, ⏎ edits, arrows move). Omitted in the sheet preview, where a
   * click still opens the micro-editor directly.
   */
  segIndex?: number | undefined;
  /** Form-field linkage: highlight `[data-bp]` matching this path (sheet). */
  linkPath?: string | null | undefined;
  /** Sheet only: a click on a tagged element goes here first; `true` = handled. */
  onElementClick?: ((path: string) => boolean) | undefined;
  /** Canvas only: one-time discoverability hint. */
  showHint?: boolean | undefined;
}): JSX.Element {
  const root = useMemo(() => describeBlockSchema(host.kind), [host.kind]);
  const [hover, setHover] = useState<Hover | null>(null);
  const [editor, setEditor] = useState<{ path: string; anchor: Rect; focusField?: string } | null>(
    null,
  );
  const [barChips, setBarChips] = useState<readonly AddChip[]>([]);
  const [spotChips, setSpotChips] = useState<readonly AddChip[]>([]);
  const [linkRects, setLinkRects] = useState<readonly Rect[]>([]);
  /** Twin representations of the value being edited (highlighted while open). */
  const [editRects, setEditRects] = useState<readonly Rect[]>([]);
  /** One-shot flash rects (click on one representation flashes the others). */
  const [flashRects, setFlashRects] = useState<readonly Rect[]>([]);
  const [hintOpen, setHintOpen] = useState(false);
  const pendingOpen = useRef<{ path: string; focusField?: string } | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorOpenRef = useRef(false);
  editorOpenRef.current = editor !== null;
  /** Part selection (canvas): lives in the store, scoped to THIS segment. */
  const storePartSel = useStudio((st) => st.partSel);
  const partPath =
    segIndex !== undefined && storePartSel !== null && storePartSel.seg === segIndex
      ? storePartSel.path
      : null;
  const [partRect, setPartRect] = useState<Rect | null>(null);
  /** Rects of the selected part's OTHER representations (arrow ↔ legend row). */
  const [partTwins, setPartTwins] = useState<readonly Rect[]>([]);
  /** True when the selected part lives inside a grid SVG (resize handles). */
  const [partOnGrid, setPartOnGrid] = useState(false);
  /** Invisible wide-stroke clones of the SVG arrows (thin paths are unhittable). */
  const [hitLayers, setHitLayers] = useState<readonly HitLayer[]>([]);
  const partPathRef = useRef<string | null>(null);
  partPathRef.current = partPath;
  /** Set when a pointer gesture became a drag — the trailing click is not an edit. */
  const suppressClickRef = useRef(false);
  const dragActiveRef = useRef(false);
  /** The element currently showing the grab cursor. */
  const cursorEl = useRef<Element | null>(null);

  const clearCursor = useCallback((): void => {
    const el = cursorEl.current;
    if (el !== null && (el instanceof HTMLElement || el instanceof SVGElement)) {
      el.style.cursor = '';
    }
    cursorEl.current = null;
  }, []);

  const setPart = useCallback(
    (path: string | null): void => {
      if (segIndex === undefined) return;
      useStudio.getState().setPartSel(path === null ? null : { seg: segIndex, path });
      if (path !== null) emitTourAction('part-select');
    },
    [segIndex],
  );

  const drag = useDiagramDrag({
    host,
    data,
    html,
    wrapperRef,
    editorOpenRef,
    suppressClickRef,
    dragActiveRef,
    onDragStart: () => {
      setHover(null);
      clearCursor();
    },
    // A completed drop leaves the moved part selected (follow the item).
    onDrop: (newPath) => {
      setPart(newPath);
      emitTourAction('part-move');
    },
  });

  /* ---- drag-to-connect (dots on the selected node → rubber band → edge) ---- */
  const connect = useConnect({
    host,
    data,
    html,
    wrapperRef,
    suppressClickRef,
    dragActiveRef,
    onConnectStart: () => {
      setHover(null);
      clearCursor();
    },
    // An empty-canvas drop created a node: select it and open the
    // micro-editor on its label/name so the user can type immediately.
    onNodeCreated: (nodePath, focusField) => {
      setPart(nodePath);
      pendingOpen.current = { path: nodePath, focusField };
    },
    // A connect appended a sequence message: select it and name it now.
    onEdgeCreated: (edgePath, focusField) => {
      setPart(edgePath);
      pendingOpen.current = { path: edgePath, focusField };
    },
  });
  const connectRef = useRef(connect);
  connectRef.current = connect;

  /**
   * The field ⏎ / double-click should land on for a part: a sequence step
   * <li> opens on its summary; an ARROW part (edge/transition/link/message)
   * opens on its text field (label / event) — offered by the micro-editor
   * even when the optional field is absent from the YAML.
   */
  const focusFieldFor = useCallback(
    (el: Element, path: string): string | undefined => {
      if (el.closest('.seq-steps') !== null) return 'summary';
      const spec = connectRef.current.spec;
      if (spec !== null && edgeIndexFromPath(spec, path) !== null) return spec.edgeTextField;
      return undefined;
    },
    [],
  );

  /* ---- corner handles on the selected group → snapped resize ---- */
  const resize = useGroupResize({
    host,
    data,
    html,
    wrapperRef,
    suppressClickRef,
    dragActiveRef,
    onResizeStart: () => {
      setHover(null);
      clearCursor();
    },
  });

  /* ---- marquee on empty canvas → dashed group wrapper ---- */
  const marquee = useGroupMarquee({
    host,
    data,
    html,
    wrapperRef,
    enabled: segIndex !== undefined,
    editorOpenRef,
    suppressClickRef,
    dragActiveRef,
    onMarqueeStart: () => {
      setHover(null);
      clearCursor();
    },
    // The release created a group: select it and open the micro-editor on
    // its label so the user can name the zone immediately.
    onCreated: (groupPath, focusField) => {
      setPart(groupPath);
      pendingOpen.current = { path: groupPath, focusField };
    },
  });

  useEffect(
    () => () => {
      if (flashTimer.current !== null) clearTimeout(flashTimer.current);
    },
    [],
  );

  const openEditorAt = useCallback(
    (path: string, el: Element, wrap: HTMLElement, focusField?: string): void => {
      setHover(null);
      setEditor({ path, anchor: relRect(el, wrap), ...(focusField !== undefined ? { focusField } : {}) });
    },
    [],
  );

  /** Flash `el`'s twins; scroll an HTML twin into view from a diagram click. */
  const flashTwins = useCallback((path: string, el: Element, wrap: HTMLElement): void => {
    const twins = twinElsOf(wrap, path, el);
    if (twins.length === 0) return;
    setFlashRects(twins.map((t) => relRect(t, wrap)));
    if (el instanceof SVGElement) {
      const htmlTwin = twins.find((t) => !(t instanceof SVGElement));
      htmlTwin?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    if (flashTimer.current !== null) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => {
      flashTimer.current = null;
      setFlashRects([]);
    }, 1400);
  }, []);

  /* ---- pointer tracking on the wrapper ---- */
  useEffect(() => {
    const wrap = wrapperRef.current;
    if (wrap === null) return;

    const findTagged = (t: EventTarget | null): Element | null => {
      if (!(t instanceof Element)) return null;
      const el = t.closest('[data-bp]');
      return el !== null && wrap.contains(el) ? el : null;
    };

    const onMove = (e: PointerEvent): void => {
      if (dragActiveRef.current) return; // the drag layer owns the pointer
      if (editorOpenRef.current) return;
      // Moving over our own overlay controls (the ×, chips…) keeps the hover.
      if (e.target instanceof Element && e.target.closest('.stu-dx-overlay') !== null) return;
      const el = findTagged(e.target);
      if (el === null) {
        setHover(null);
        clearCursor();
        return;
      }
      const path = el.getAttribute('data-bp') ?? '';
      // Draggable parts advertise it: grab cursor on the part itself.
      if (el !== cursorEl.current) {
        clearCursor();
        if (
          (el instanceof HTMLElement || el instanceof SVGElement) &&
          draggableTarget(wrap, host.kind, path) !== null
        ) {
          el.style.cursor = 'grab';
          cursorEl.current = el;
        }
      }
      setHover((prev) => {
        const rect = relRect(el, wrap);
        if (prev !== null && prev.path === path && prev.rect.top === rect.top && prev.rect.left === rect.left) {
          return prev;
        }
        // Twin representations (diagram row ↔ step <li>) light up together.
        const twins = twinElsOf(wrap, path, el).map((t) => relRect(t, wrap));
        return { path, rect, twins };
      });
    };
    const onLeave = (): void => {
      setHover(null);
      clearCursor();
    };
    const onClick = (e: MouseEvent): void => {
      // The gesture was a drag (pointer travelled past the intent threshold):
      // its trailing click must not select or edit.
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        return;
      }
      // Clicks on the layer's own chrome (the note button, pickers) belong to
      // their React handlers — they must not read as "empty space" and clear
      // the part selection out from under them. (The tagged hit layers live
      // OUTSIDE .stu-dx-overlay, so real part clicks still land below.)
      if (e.target instanceof Element && e.target.closest('.stu-dx-overlay') !== null) return;
      const el = findTagged(e.target);
      if (el === null) {
        // Empty block space pops part selection back to the block level.
        if (partPathRef.current !== null) setPart(null);
        return;
      }
      const path = el.getAttribute('data-bp') ?? '';
      if (onElementClick?.(path) === true) return;
      // Step <li>s open on their summary; arrows on their label/event text.
      const focusField = focusFieldFor(el, path);
      if (segIndex === undefined) {
        // Sheet preview: no part-selection level — a click edits directly.
        openEditorAt(path, el, wrap, focusField);
        flashTwins(path, el, wrap);
        return;
      }
      if (partPathRef.current === path && !editorOpenRef.current) {
        // Second click (or double-click) on the selected part → edit it.
        openEditorAt(path, el, wrap, focusField);
        flashTwins(path, el, wrap);
        return;
      }
      setPart(path);
    };

    wrap.addEventListener('pointermove', onMove);
    wrap.addEventListener('pointerleave', onLeave);
    wrap.addEventListener('click', onClick);
    return () => {
      wrap.removeEventListener('pointermove', onMove);
      wrap.removeEventListener('pointerleave', onLeave);
      wrap.removeEventListener('click', onClick);
      clearCursor();
    };
  }, [wrapperRef, onElementClick, openEditorAt, flashTwins, clearCursor, focusFieldFor, host.kind, segIndex, setPart]);

  /* ---- part-land keyboard: ⏎ edit · arrows move · ⇥ cycle · ⌫ delete · esc pop
         (plus ⌥+arrows nudging the hovered/edited part, kept for muscle memory) ---- */
  useEffect(() => {
    const wrap = wrapperRef.current;
    if (wrap === null) return;
    const onKey = (e: KeyboardEvent): void => {
      // The delete popover / review dialog own the keyboard while open (this
      // capture listener registered first, so it must self-guard).
      const globalUi = useStudio.getState();
      if (globalUi.pendingDelete !== null || globalUi.review !== null) return;
      // The connect shape picker owns Esc while open (cancel, keep selection).
      if (e.key === 'Escape' && connectRef.current.pickerOpenRef.current === true) {
        e.preventDefault();
        e.stopPropagation();
        connectRef.current.cancelPicker();
        return;
      }
      const isArrow =
        e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown';
      // ⌥ + arrows: nudge the selected / edited / hovered part.
      if (isArrow && e.altKey && !e.metaKey && !e.ctrlKey) {
        const path = partPath ?? editor?.path ?? hover?.path ?? null;
        if (path === null) return;
        const next = nudgePart({ wrap, host, data, path, key: e.key as ArrowKey });
        if (next === null) return;
        e.preventDefault();
        e.stopPropagation();
        setEditor(null); // indices shifted — a stale editor would edit the wrong item
        setHover(null);
        setPart(next);
        return;
      }
      if (segIndex === undefined) return; // part-land is canvas-only
      if (editorOpenRef.current) return; // the micro-editor owns its keys
      if (isEditableTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // ⇥ / ⇧⇥ — enter part-land on the first press, then cycle in DOM order.
      if (e.key === 'Tab') {
        const paths = uniquePartPaths(wrap);
        if (paths.length === 0) return;
        e.preventDefault();
        e.stopPropagation();
        if (partPath === null) {
          setPart((e.shiftKey ? paths[paths.length - 1] : paths[0]) as string);
          return;
        }
        const i = paths.indexOf(partPath);
        const n = paths.length;
        setPart(paths[i < 0 ? 0 : (i + (e.shiftKey ? -1 : 1) + n) % n] as string);
        return;
      }
      if (partPath === null) return; // block level — the canvas owns the keys
      // `n` on a sequence message: annotate it — the micro-editor opens
      // focused on `summary`, which becomes the numbered step note below.
      if (e.key.toLowerCase() === 'n' && host.kind === 'sequence' && /^messages\.\d+$/.test(partPath)) {
        const el = wrap.querySelector(`[data-bp="${CSS.escape(partPath)}"]`);
        if (el !== null) {
          e.preventDefault();
          e.stopPropagation();
          openEditorAt(partPath, el, wrap, 'summary');
          flashTwins(partPath, el, wrap);
        }
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        const el = wrap.querySelector(`[data-bp="${CSS.escape(partPath)}"]`);
        if (el === null) return;
        e.preventDefault();
        e.stopPropagation();
        openEditorAt(partPath, el, wrap, focusFieldFor(el, partPath));
        flashTwins(partPath, el, wrap);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setPart(null); // pop one level: part → block (App handles block → none)
        return;
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        // Deletes the enclosing array item (a leaf selection like a glossary
        // row's term removes the row). Cells / no-array scalars: nothing.
        const victim = deletablePathFor(host.kind, partPath);
        if (victim === null) return;
        e.preventDefault();
        e.stopPropagation();
        const run = (): void => {
          // Column headers delete COMPOUND: the header plus that cell in
          // every aligned row (one undo step); refused below the minimum.
          const ci = columnIndexFromPath(host.kind, victim);
          if (ci !== null) {
            const sets = deleteColumnSets(host.kind, data, ci);
            if (sets === null) {
              host.notify?.('Keep at least one column');
              return;
            }
            host.commitPaths(sets);
          } else {
            host.deletePath(parseBlockPath(victim));
          }
          useStudio.getState().setPartSel(null);
        };
        // Still-seeded items delete silently; touched content confirms
        // (pressing ⌫ again in the popover is the fast path).
        if (!needsPartDeleteConfirm(host.kind, data, victim)) {
          run();
          return;
        }
        const el =
          wrap.querySelector(`[data-bp="${CSS.escape(victim)}"]`) ??
          wrap.querySelector(`[data-bp="${CSS.escape(partPath)}"]`);
        const r = el?.getBoundingClientRect();
        useStudio.getState().requestDelete({
          label: humanizePath(parseBlockPath(victim)),
          anchor:
            r !== undefined
              ? { x: r.left + r.width / 2, y: r.bottom }
              : { x: window.innerWidth / 2, y: window.innerHeight / 3 },
          run,
        });
        return;
      }
      if (isArrow) {
        // preventDefault only for movable parts / table cells; inert scalars
        // release the key so the page can scroll.
        if (!capturesArrows(classifyPart(host.kind, partPath))) return;
        e.preventDefault();
        e.stopPropagation();
        const r = moveSelectedPart({
          wrap,
          host,
          data,
          path: partPath,
          key: e.key as ArrowKey,
          grow: e.shiftKey, // ⇧ + arrows: grow/shrink a group's span
        });
        if (r !== null) {
          setPart(r.path); // remapped — the selection follows
          emitTourAction('part-move');
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [wrapperRef, host, data, partPath, editor, hover, segIndex, setPart, openEditorAt, flashTwins, focusFieldFor]);

  /* ---- the selection outline follows the part across re-renders ---- */
  useLayoutEffect(() => {
    const wrap = wrapperRef.current;
    if (wrap === null || partPath === null) {
      setPartRect(null);
      setPartTwins([]);
      return;
    }
    const el = wrap.querySelector(`[data-bp="${CSS.escape(partPath)}"]`);
    if (el === null) {
      // The part vanished (deleted, or the doc changed under us) — pop out.
      setPartRect(null);
      setPartTwins([]);
      setPart(null);
      return;
    }
    setPartRect(relRect(el, wrap));
    // A selected arrow lights up its legend row too (and vice versa).
    setPartTwins(twinElsOf(wrap, partPath, el).map((t) => relRect(t, wrap)));
    setPartOnGrid(el.closest('svg')?.hasAttribute('data-grid') === true);
  }, [partPath, html, wrapperRef, setPart]);

  /* ---- invisible wide-stroke clones of the SVG arrows (hit areas) ----
     A 1.4px path is nearly unhittable; each `path[data-bp]` gets a fat
     transparent twin in an overlay SVG that shares the source's viewBox, so
     hover/click/⌫ treat the arrow like any other tagged part. Studio-only —
     the rendered HTML stays untouched. */
  useLayoutEffect(() => {
    const wrap = wrapperRef.current;
    if (wrap === null) {
      setHitLayers([]);
      return;
    }
    const layers: HitLayer[] = [];
    for (const svg of Array.from(wrap.querySelectorAll('svg'))) {
      if (svg.closest('.stu-dx-hit') !== null) continue; // our own layer
      const viewBox = svg.getAttribute('viewBox') ?? '';
      if (viewBox === '') continue;
      const paths = Array.from(svg.querySelectorAll('path[data-bp]'))
        .map((p) => ({ bp: p.getAttribute('data-bp') ?? '', d: p.getAttribute('d') ?? '' }))
        .filter((p) => p.bp !== '' && p.d !== '');
      if (paths.length === 0) continue;
      layers.push({ box: relRect(svg, wrap), viewBox, paths });
    }
    setHitLayers(layers);
  }, [html, wrapperRef]);

  /* ---- while the micro-editor is open, keep ALL representations lit ---- */
  useLayoutEffect(() => {
    const wrap = wrapperRef.current;
    if (wrap === null || editor === null) {
      setEditRects([]);
      return;
    }
    setEditRects(twinElsOf(wrap, editor.path, null).map((el) => relRect(el, wrap)));
  }, [editor, html, wrapperRef]);

  /* ---- add-chips: measured after every render of the block's HTML ---- */
  useLayoutEffect(() => {
    const wrap = wrapperRef.current;
    if (wrap === null) return;
    const bars: AddChip[] = [];
    const spots: AddChip[] = [];
    for (const el of Array.from(wrap.querySelectorAll('[data-bl]'))) {
      const listPath = el.getAttribute('data-bl') ?? '';
      if (listPath === '') continue;
      const segs = parseBlockPath(listPath);
      const last = segs[segs.length - 1];
      if (typeof last !== 'string') continue;
      const label = `+ Add ${singularize(humanizeFieldName(last)).toLowerCase()}`;
      const indexed = segs.some((s) => typeof s === 'number');
      if (!indexed) {
        bars.push({ listPath, label });
      } else if (!(el instanceof SVGElement)) {
        // Nested HTML list (e.g. a kanban column's cards): pin the chip at the
        // container's bottom edge, straddling it like Notion's inline add-row.
        const r = relRect(el, wrap);
        spots.push({ listPath, label, at: { left: r.left + 8, top: r.top + r.height - 11 } });
      }
      // Nested SVG lists (e.g. one entity's columns) get no chip — there is no
      // clean empty space inside the drawing; the micro-editor and sheet cover them.
    }
    // Column-family kinds (table/statustable/matrix/journey/heatmap): the
    // columns list adds through a COMPOUND op, so make sure it has a chip —
    // pinned at the END of the header row when the last header is measurable
    // (HTML tables), else in the add bar.
    const colSpec = columnSpecFor(host.kind);
    if (colSpec !== null) {
      const colsVal = valueAt(data, [colSpec.colsPath]);
      const colCount = Array.isArray(colsVal) ? colsVal.length : 0;
      const lastHeader =
        colCount > 0
          ? wrap.querySelector(`[data-bp="${CSS.escape(`${colSpec.colsPath}.${colCount - 1}`)}"]`)
          : null;
      const colLabel = `+ Add ${singularize(humanizeFieldName(colSpec.colsPath)).toLowerCase()}`;
      if (lastHeader !== null && !(lastHeader instanceof SVGElement)) {
        const r = relRect(lastHeader, wrap);
        spots.push({
          listPath: colSpec.colsPath,
          label: '＋',
          at: { left: r.left + r.width + 4, top: r.top + r.height / 2 - 10 },
        });
      } else if (!bars.some((b) => b.listPath === colSpec.colsPath)) {
        bars.push({ listPath: colSpec.colsPath, label: colLabel });
      }
    }
    // Zero-state lists whose renderer only emits a container when items
    // exist: user stories always deserve their add chips.
    if (host.kind === 'userstory') {
      for (const listPath of ['criteria', 'tags']) {
        if (!bars.some((b) => b.listPath === listPath)) {
          bars.push({
            listPath,
            label: `+ Add ${singularize(humanizeFieldName(listPath)).toLowerCase()}`,
          });
        }
      }
    }
    setBarChips(bars);
    setSpotChips(spots);

    // A just-added item: open its micro-editor as soon as it exists in the DOM.
    const want = pendingOpen.current;
    if (want !== null) {
      const el = wrap.querySelector(`[data-bp="${CSS.escape(want.path)}"]`);
      if (el !== null) {
        pendingOpen.current = null;
        openEditorAt(want.path, el, wrap, want.focusField);
      }
    }
  }, [html, data, wrapperRef, openEditorAt, host.kind]);

  /* ---- form-field linkage highlights (sheet) ---- */
  useLayoutEffect(() => {
    const wrap = wrapperRef.current;
    if (wrap === null || linkPath === null || linkPath === undefined || linkPath === '') {
      setLinkRects([]);
      return;
    }
    const all = Array.from(wrap.querySelectorAll('[data-bp]'));
    const exact = all.filter((el) => {
      const p = el.getAttribute('data-bp') ?? '';
      return p === linkPath || p.startsWith(`${linkPath}.`);
    });
    let hits = exact;
    if (hits.length === 0) {
      // The form path is deeper than the tags (e.g. `actors.0.name` when only
      // `actors.0` is tagged): fall back to the longest tagged prefix.
      let best = -1;
      let bestEls: Element[] = [];
      for (const el of all) {
        const p = el.getAttribute('data-bp') ?? '';
        if (linkPath === p || linkPath.startsWith(`${p}.`)) {
          if (p.length > best) {
            best = p.length;
            bestEls = [el];
          } else if (p.length === best) {
            bestEls.push(el);
          }
        }
      }
      hits = bestEls;
    }
    setLinkRects(hits.map((el) => relRect(el, wrap)));
  }, [linkPath, html, wrapperRef]);

  /* ---- discoverability hint ---- */
  useEffect(() => {
    if (showHint !== true) return;
    const wrap = wrapperRef.current;
    if (wrap === null) return;
    try {
      if (window.localStorage.getItem(HINT_KEY) === '1') return;
    } catch {
      return;
    }
    if (wrap.querySelector('[data-bp]') !== null) setHintOpen(true);
  }, [showHint, html, wrapperRef]);

  const dismissHint = (): void => {
    setHintOpen(false);
    try {
      window.localStorage.setItem(HINT_KEY, '1');
    } catch {
      /* private mode */
    }
  };

  const addItem = (listPath: string): void => {
    // Column-family kinds: adding a column appends the header AND one cell
    // to every aligned row — one compound commit, one undo step. The editor
    // opens on the new header.
    const colSpec = columnSpecFor(host.kind);
    if (colSpec !== null && listPath === colSpec.colsPath) {
      const r = addColumnSets(host.kind, data);
      if (r === null) return;
      host.commitPaths(r.sets);
      pendingOpen.current = { path: r.headerPath };
      dismissHintIfOpen();
      return;
    }
    const segs = parseBlockPath(listPath);
    const node = resolveFieldAt(root, segs);
    if (node === null || node.kind !== 'array') return;
    const items = valueAt(data, segs);
    const siblings = Array.isArray(items) ? items : [];
    const lastName = [...segs].reverse().find((s): s is string => typeof s === 'string') ?? 'item';
    host.commitPath(
      [...segs, siblings.length],
      fixupNewItem(
        host.kind,
        listPath,
        newItemForList(node.element, siblings, singularize(lastName)),
        data,
      ),
    );
    pendingOpen.current = { path: joinBlockPath([...segs, siblings.length]) };
    dismissHintIfOpen();
  };

  const dismissHintIfOpen = (): void => {
    if (hintOpen) dismissHint();
  };

  /**
   * Deletes the item at `victim` — a COLUMN victim (table/statustable/
   * matrix/journey/heatmap header) removes the header and that cell in every
   * aligned row as one compound commit; everything else is a plain path
   * delete. Returns false when the deletion is refused (last column).
   */
  const deleteItemAt = (victim: string): boolean => {
    const ci = columnIndexFromPath(host.kind, victim);
    if (ci !== null) {
      const sets = deleteColumnSets(host.kind, data, ci);
      if (sets === null) {
        host.notify?.('Keep at least one column');
        return false;
      }
      host.commitPaths(sets);
      return true;
    }
    host.deletePath(parseBlockPath(victim));
    return true;
  };
  const deleteItemRef = useRef(deleteItemAt);
  deleteItemRef.current = deleteItemAt;

  const removeHovered = (e: React.MouseEvent<HTMLButtonElement>): void => {
    if (hover === null) return;
    const path = hover.path;
    const run = (): void => {
      deleteItemRef.current(path);
    };
    setHover(null);
    if (!needsPartDeleteConfirm(host.kind, data, path)) {
      run();
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    useStudio.getState().requestDelete({
      label: humanizePath(parseBlockPath(path)),
      anchor: { x: r.left + r.width / 2, y: r.bottom },
      run,
    });
  };

  /** Opens the micro-editor on message 0 with Summary focused (step chip). */
  const startStepDescriptions = (): void => {
    const wrap = wrapperRef.current;
    if (wrap === null) return;
    const el = wrap.querySelector('[data-bp="messages.0"]');
    if (el !== null) openEditorAt('messages.0', el, wrap, 'summary');
    else host.openFull();
    dismissHintIfOpen();
  };
  const stepPrompt = needsStepPrompt(host.kind, data);

  // Selecting a part IS the lesson — retire the one-time hint.
  useEffect(() => {
    if (partPath !== null && hintOpen) dismissHint();
  }, [partPath, hintOpen]);

  const hoverIsItem = hover !== null && isItemPath(parseBlockPath(hover.path));
  // Chips STRADDLE the selection ring's edge (half on, half off) instead of
  // floating fully above it — at `top - 24` they landed on the section eyebrow.
  // With ~12px of clearance the chip straddles the top-left corner; tighter
  // than that it flips to straddle the bottom edge.
  const chipAbove = hover !== null && hover.rect.top >= 12;

  /* ---- connector dots: the selected part is a node of a connectable kind ---- */
  const connNodeIndex =
    segIndex !== undefined && connect.spec !== null && partPath !== null
      ? nodeIndexFromPath(connect.spec, partPath)
      : null;

  /* ---- resize handles: the selected part is a group on a grid diagram ---- */
  const groupSelIndex =
    segIndex !== undefined && partPath !== null && partOnGrid && supportsGroups(host.kind)
      ? groupIndexFromPath(partPath)
      : null;

  /* ---- selected-part visuals (outline + one path/key-hint pill) ---- */
  const partCls = partPath !== null ? classifyPart(host.kind, partPath) : null;
  /** Selected ARROW (edge/transition/link/message): ⏎ edits its text field. */
  const partEdgeField =
    connect.spec !== null && partPath !== null && edgeIndexFromPath(connect.spec, partPath) !== null
      ? connect.spec.edgeTextField
      : null;
  /** Sequence messages take a numbered ANNOTATION (`summary`): it renders in
   *  the Step-by-step list under the diagram with the same ① reference
   *  number, so "add note" on step 2 automatically becomes entry ②. */
  const noteMatch = host.kind === 'sequence' && partPath !== null ? /^messages\.(\d+)$/.exec(partPath) : null;
  const noteInfo =
    noteMatch !== null
      ? {
          n: Number(noteMatch[1]) + 1,
          has:
            typeof valueAt(data, ['messages', Number(noteMatch[1]), 'summary']) === 'string' &&
            (valueAt(data, ['messages', Number(noteMatch[1]), 'summary']) as string).length > 0,
        }
      : null;
  const partHint =
    partCls === null
      ? ''
      : partEdgeField !== null
        ? `⏎ edit ${partEdgeField}${noteInfo !== null ? ' · n note' : ''} · ⌫`
        : partCls.kind === 'table-cell'
          ? '⏎ edit · ←↑↓→ cells'
          : partCls.kind === 'grid-group'
            ? '⏎ edit · ←↑↓→ move · drag corner → resize · ⌫'
            : partCls.kind !== 'inert'
              ? '⏎ edit · ←↑↓→ move · ⌫'
              : '⏎ edit';
  const partChipAbove = partRect !== null && partRect.top >= 12;

  return (
    <>
      {hitLayers.map((l, i) => (
        // NOT inside .stu-dx-overlay: these carry real data-bp attrs, so the
        // wrapper's own hover/click/⌫ handlers treat them like the arrow.
        <svg
          key={`hit${i}`}
          className="stu-dx-hit"
          viewBox={l.viewBox}
          preserveAspectRatio="none"
          aria-hidden="true"
          style={{ left: l.box.left, top: l.box.top, width: l.box.width, height: l.box.height }}
        >
          {l.paths.map((p, j) => (
            <path key={j} d={p.d} data-bp={p.bp} />
          ))}
        </svg>
      ))}
      <div className="stu-dx-overlay">
        {linkRects.map((r, i) => (
          <div
            key={`lk${i}`}
            className="stu-dx-link"
            style={{ left: r.left - 3, top: r.top - 3, width: r.width + 6, height: r.height + 6 }}
          />
        ))}
        {editor !== null &&
          editRects.map((r, i) => (
            <div
              key={`ed${i}`}
              className="stu-dx-link"
              style={{ left: r.left - 3, top: r.top - 3, width: r.width + 6, height: r.height + 6 }}
            />
          ))}
        {flashRects.map((r, i) => (
          <div
            key={`fl${i}`}
            className="stu-dx-flash"
            style={{ left: r.left - 3, top: r.top - 3, width: r.width + 6, height: r.height + 6 }}
          />
        ))}
        {partPath !== null && partRect !== null && editor === null && (
          <>
            <div
              className="stu-dx-sel"
              style={{
                left: partRect.left - 3,
                top: partRect.top - 3,
                width: partRect.width + 6,
                height: partRect.height + 6,
              }}
            />
            {partTwins.map((r, i) => (
              // The part's other representations (an arrow's legend row, a
              // message's step <li>) stay lit while it is selected.
              <div
                key={`pt${i}`}
                className="stu-dx-link"
                style={{ left: r.left - 3, top: r.top - 3, width: r.width + 6, height: r.height + 6 }}
              />
            ))}
            <div
              className="stu-dx-chip"
              style={{
                left: Math.max(0, partRect.left - 3),
                top: partChipAbove ? partRect.top - 13 : partRect.top + partRect.height - 7,
              }}
            >
              {humanizePath(parseBlockPath(partPath))}
              {partHint !== '' && <span className="stu-dx-chip-keys"> · {partHint}</span>}
            </div>
            {groupSelIndex !== null &&
              resizeHandles(partRect).map((h) => (
                <button
                  key={h.corner}
                  type="button"
                  className="stu-dx-resize"
                  aria-label={`Resize the group from its ${h.corner} corner`}
                  title="Drag to resize"
                  style={{ left: h.x - 5, top: h.y - 5, cursor: cornerCursor(h.corner) }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    resize.start(e, groupSelIndex, h.corner);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ))}
            {noteInfo !== null && (
              <button
                type="button"
                className="stu-dx-note"
                style={{
                  left: Math.max(0, partRect.left - 3),
                  top: partChipAbove ? partRect.top + partRect.height + 8 : partRect.top - 36,
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  const wrapEl = wrapperRef.current;
                  if (wrapEl === null || partPath === null) return;
                  const el = wrapEl.querySelector(`[data-bp="${CSS.escape(partPath)}"]`);
                  if (el !== null) openEditorAt(partPath, el, wrapEl, 'summary');
                }}
              >
                {noteInfo.has ? `✎ note ${noteInfo.n}` : `＋ add note ${noteInfo.n}`}
              </button>
            )}
            {connNodeIndex !== null &&
              connectorDots(partRect).map((d) => (
                <button
                  key={d.side}
                  type="button"
                  className="stu-dx-dot"
                  aria-label={`Connect from the ${d.side} edge`}
                  title="Drag to connect"
                  style={{ left: d.x - 6, top: d.y - 6 }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    connect.start(e, connNodeIndex, { x: d.x, y: d.y });
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ))}
          </>
        )}
        {connect.visuals.wire !== null && (
          <svg className="stu-dx-wire" aria-hidden="true">
            <line
              x1={connect.visuals.wire.x1}
              y1={connect.visuals.wire.y1}
              x2={connect.visuals.wire.x2}
              y2={connect.visuals.wire.y2}
            />
            <circle cx={connect.visuals.wire.x2} cy={connect.visuals.wire.y2} r={4} />
          </svg>
        )}
        {connect.visuals.snap !== null && (
          <div
            className="stu-dx-snap"
            style={{
              left: connect.visuals.snap.left,
              top: connect.visuals.snap.top,
              width: connect.visuals.snap.width,
              height: connect.visuals.snap.height,
            }}
          />
        )}
        {connect.visuals.target !== null && (
          <div
            className="stu-dx-connect-target"
            style={{
              left: connect.visuals.target.left - 3,
              top: connect.visuals.target.top - 3,
              width: connect.visuals.target.width + 6,
              height: connect.visuals.target.height + 6,
            }}
          />
        )}
        {resize.visuals.snap !== null && (
          <div
            className="stu-dx-snap"
            style={{
              left: resize.visuals.snap.left,
              top: resize.visuals.snap.top,
              width: resize.visuals.snap.width,
              height: resize.visuals.snap.height,
            }}
          />
        )}
        {marquee.snap !== null && (
          <div
            className="stu-dx-snap"
            style={{
              left: marquee.snap.left,
              top: marquee.snap.top,
              width: marquee.snap.width,
              height: marquee.snap.height,
            }}
          />
        )}
        {marquee.box !== null && (
          <div
            className="stu-dx-marquee"
            style={{
              left: marquee.box.left,
              top: marquee.box.top,
              width: marquee.box.width,
              height: marquee.box.height,
            }}
          />
        )}
        {connect.visuals.picker !== null && (
          <div
            className="stu-dx-connect-picker"
            role="menu"
            aria-label={connect.visuals.picker.title}
            style={{ left: connect.visuals.picker.left + 6, top: connect.visuals.picker.top + 6 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="stu-dx-connect-picker-title">{connect.visuals.picker.title}</div>
            {connect.visuals.picker.items.map((it) => (
              <button
                key={it.value}
                type="button"
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  connect.choose(it.value);
                }}
              >
                {it.label}
              </button>
            ))}
          </div>
        )}
        {drag.snap !== null && (
          <div
            className="stu-dx-snap"
            style={{ left: drag.snap.left, top: drag.snap.top, width: drag.snap.width, height: drag.snap.height }}
          />
        )}
        {drag.drop !== null && (
          <div
            className="stu-dx-drop"
            style={{ left: drag.drop.left, top: drag.drop.top, width: drag.drop.width, height: drag.drop.height }}
          />
        )}
        {drag.ghost !== null && (
          <div
            className="stu-dx-ghost"
            style={{
              left: drag.ghost.box.left,
              top: drag.ghost.box.top,
              width: drag.ghost.box.width,
              height: drag.ghost.box.height,
            }}
          >
            <span>{drag.ghost.label}</span>
          </div>
        )}
        {hover !== null && editor === null && hover.path !== partPath && (
          <>
            <div
              className="stu-dx-hl"
              style={{
                left: hover.rect.left - 3,
                top: hover.rect.top - 3,
                width: hover.rect.width + 6,
                height: hover.rect.height + 6,
              }}
            />
            {hover.twins.map((r, i) => (
              <div
                key={`tw${i}`}
                className="stu-dx-hl stu-dx-hl-twin"
                style={{ left: r.left - 3, top: r.top - 3, width: r.width + 6, height: r.height + 6 }}
              />
            ))}
            <div
              className="stu-dx-chip"
              style={{
                left: Math.max(0, hover.rect.left - 3),
                top: chipAbove ? hover.rect.top - 13 : hover.rect.top + hover.rect.height - 7,
              }}
            >
              {humanizePath(parseBlockPath(hover.path))}
            </div>
            {hoverIsItem && (
              <button
                type="button"
                className="stu-dx-x"
                aria-label={`Remove ${humanizePath(parseBlockPath(hover.path))}`}
                title="Remove"
                style={{
                  left: hover.rect.left + hover.rect.width - 8,
                  top: hover.rect.top - 8,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  removeHovered(e);
                }}
              >
                ×
              </button>
            )}
          </>
        )}
        {spotChips.map((c) => (
          <button
            key={c.listPath}
            type="button"
            className="stu-dx-add stu-dx-add-spot"
            style={{ left: c.at?.left ?? 0, top: c.at?.top ?? 0 }}
            onClick={(e) => {
              e.stopPropagation();
              addItem(c.listPath);
            }}
          >
            {c.label}
          </button>
        ))}
        {hintOpen && editor === null && (
          <div className="stu-dx-hint" role="note">
            <span>Click a part to select it — ⏎ edits · arrows move</span>
            <button type="button" aria-label="Dismiss" onClick={dismissHint}>
              ×
            </button>
          </div>
        )}
        {editor !== null && (
          <MicroEditor
            host={host}
            root={root}
            data={data}
            path={parseBlockPath(editor.path)}
            anchor={editor.anchor}
            focusField={editor.focusField}
            onClose={() => {
              setEditor(null);
              emitTourAction('micro-close');
            }}
            onMovedTo={(p) => setPart(p)}
            onRemoveItem={() => deleteItemRef.current(editor.path)}
          />
        )}
      </div>
      {(barChips.length > 0 || stepPrompt) && (
        <div className="stu-dx-addbar" onClick={(e) => e.stopPropagation()}>
          {stepPrompt && (
            <button
              type="button"
              className="stu-dx-add stu-dx-add-steps"
              title="Describe each step — a Step-by-step list renders below the diagram"
              onClick={startStepDescriptions}
            >
              ＋ Add step descriptions
            </button>
          )}
          {barChips.map((c) => (
            <button
              key={c.listPath}
              type="button"
              className="stu-dx-add"
              onClick={() => addItem(c.listPath)}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
