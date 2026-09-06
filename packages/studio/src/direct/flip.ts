/**
 * Motion for direct edits. Studio re-renders a block's HTML from source after
 * every op, so nothing can be tweened in place — instead the layer plays a
 * FLIP: snapshot the bounding boxes of every `data-bp` part BEFORE the op
 * commits, then, once the new HTML is measured, animate each survivor from
 * its old box to its new one with `element.animate()` (transform only),
 * pop the newcomers (scale .92 → 1 + opacity) and — for a deletion — fade the
 * victims out BEFORE the op commits. Edges crossfade instead of moving (a
 * re-routed path has no meaningful "from" transform).
 *
 * The pure half ({@link planFlip}) diffs two keyed box maps; the DOM half
 * ({@link snapshotBoxes}, {@link playFlip}, {@link fadeOut}) is thin glue.
 * Everything is skipped under `prefers-reduced-motion: reduce`.
 */

import type { Box } from './drag.js';

export const MOVE_MS = 140;
export const POP_MS = 140;
export const FADE_MS = 120;
export const EASE_OUT = 'cubic-bezier(0.2, 0.7, 0.2, 1)';

/** How each surviving/new/removed key animates. */
export interface FlipPlan {
  /** Survivors whose box changed: translate (+ scale on a size change). */
  readonly moves: ReadonlyArray<{ readonly key: string; readonly from: Box; readonly to: Box }>;
  /** New parts: scale .92 → 1 + opacity. */
  readonly pops: readonly string[];
  /** Edges that are new or re-routed: opacity only. */
  readonly crossfades: readonly string[];
  /** Keys that vanished (already gone from the DOM — informational). */
  readonly fades: readonly string[];
}

const EPS = 0.5;

function sameBox(a: Box, b: Box): boolean {
  return (
    Math.abs(a.left - b.left) < EPS &&
    Math.abs(a.top - b.top) < EPS &&
    Math.abs(a.width - b.width) < EPS &&
    Math.abs(a.height - b.height) < EPS
  );
}

/**
 * Diffs the before/after box maps (keyed by `data-bp`). `isEdge` marks the
 * keys that crossfade instead of moving. With `moves: false` (a deletion —
 * every index after the victim shifts, so "moving" would animate the wrong
 * part) survivors stay put and only newcomers/edges animate.
 */
export function planFlip(
  before: ReadonlyMap<string, Box>,
  after: ReadonlyMap<string, Box>,
  isEdge: (key: string) => boolean,
  opts: { readonly moves?: boolean } = {},
): FlipPlan {
  const moves: Array<{ key: string; from: Box; to: Box }> = [];
  const pops: string[] = [];
  const crossfades: string[] = [];
  const fades: string[] = [];
  const allowMoves = opts.moves !== false;
  for (const [key, to] of after) {
    const from = before.get(key);
    if (from === undefined) {
      (isEdge(key) ? crossfades : pops).push(key);
      continue;
    }
    if (sameBox(from, to)) continue;
    if (isEdge(key)) crossfades.push(key);
    else if (allowMoves) moves.push({ key, from, to });
  }
  for (const key of before.keys()) if (!after.has(key)) fades.push(key);
  return { moves, pops, crossfades, fades };
}

/** The transform that maps `to` back onto `from` (played from it to none). */
export function invertTransform(from: Box, to: Box): string {
  const dx = from.left - to.left;
  const dy = from.top - to.top;
  const sx = to.width > 0 ? from.width / to.width : 1;
  const sy = to.height > 0 ? from.height / to.height : 1;
  const scale = Math.abs(sx - 1) > 0.01 || Math.abs(sy - 1) > 0.01 ? ` scale(${sx.toFixed(4)}, ${sy.toFixed(4)})` : '';
  return `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)${scale}`;
}

/* ─── DOM glue ────────────────────────────────────────────────────────────── */

/** True when the viewer asked for reduced motion (or no matchMedia). */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** The rendered parts of a block: one element per distinct `data-bp` key. */
function partsOf(wrap: HTMLElement): Map<string, Element> {
  const out = new Map<string, Element>();
  for (const el of Array.from(wrap.querySelectorAll('[data-bp]'))) {
    if (el.closest('.stu-dx-hit') !== null || el.closest('.stu-dx-overlay') !== null) continue;
    const key = el.getAttribute('data-bp') ?? '';
    if (key !== '' && !out.has(key)) out.set(key, el);
  }
  return out;
}

/** Wrapper-relative boxes of every part, keyed by `data-bp`. */
export function snapshotBoxes(wrap: HTMLElement): Map<string, Box> {
  const w = wrap.getBoundingClientRect();
  const out = new Map<string, Box>();
  for (const [key, el] of partsOf(wrap)) {
    const r = el.getBoundingClientRect();
    out.set(key, { left: r.left - w.left, top: r.top - w.top, width: r.width, height: r.height });
  }
  return out;
}

type Animatable = Element & { animate?: Element['animate'] };

function canAnimate(el: Element): el is Element & { animate: Element['animate']; style: CSSStyleDeclaration } {
  return typeof (el as Animatable).animate === 'function' && 'style' in el;
}

/** Sets an SVG-safe transform origin for the animation, restoring it after. */
function withOrigin(el: Element & { style: CSSStyleDeclaration }, origin: string, anim: Animation): void {
  const prevBox = el.style.transformBox;
  const prevOrigin = el.style.transformOrigin;
  el.style.transformBox = 'fill-box';
  el.style.transformOrigin = origin;
  const restore = (): void => {
    el.style.transformBox = prevBox;
    el.style.transformOrigin = prevOrigin;
  };
  anim.addEventListener('finish', restore);
  anim.addEventListener('cancel', restore);
}

/**
 * Plays the FLIP for the re-rendered `wrap` against a `before` snapshot. Call
 * from a layout effect keyed on the new HTML (the DOM is measured but not yet
 * painted, so the first frame already shows the inverted transform).
 */
export function playFlip(
  wrap: HTMLElement,
  before: ReadonlyMap<string, Box>,
  isEdge: (key: string) => boolean,
  opts: { readonly moves?: boolean } = {},
): FlipPlan {
  const after = snapshotBoxes(wrap);
  const plan = planFlip(before, after, isEdge, opts);
  if (prefersReducedMotion()) return plan;
  const parts = partsOf(wrap);
  for (const m of plan.moves) {
    const el = parts.get(m.key);
    if (el === undefined || !canAnimate(el)) continue;
    const anim = el.animate(
      [{ transform: invertTransform(m.from, m.to) }, { transform: 'none' }],
      { duration: MOVE_MS, easing: EASE_OUT },
    );
    withOrigin(el, '0 0', anim);
  }
  for (const key of plan.pops) {
    const el = parts.get(key);
    if (el === undefined || !canAnimate(el)) continue;
    const anim = el.animate(
      [{ transform: 'scale(0.92)', opacity: 0 }, { transform: 'none', opacity: 1 }],
      { duration: POP_MS, easing: EASE_OUT },
    );
    withOrigin(el, 'center', anim);
  }
  for (const key of plan.crossfades) {
    const el = parts.get(key);
    if (el === undefined || !canAnimate(el)) continue;
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: MOVE_MS, easing: 'ease-out' });
  }
  return plan;
}

/**
 * Fades the parts at `keys` out (every element sharing the key — a message's
 * arrow AND its step row), then calls `done`. Immediate under reduced motion
 * or when nothing matched.
 */
export function fadeOut(wrap: HTMLElement, keys: readonly string[], done: () => void): void {
  if (prefersReducedMotion() || keys.length === 0) {
    done();
    return;
  }
  const wanted = new Set(keys);
  const els = Array.from(wrap.querySelectorAll('[data-bp]')).filter(
    (el) =>
      wanted.has(el.getAttribute('data-bp') ?? '') &&
      el.closest('.stu-dx-hit') === null &&
      el.closest('.stu-dx-overlay') === null &&
      canAnimate(el),
  );
  if (els.length === 0) {
    done();
    return;
  }
  let pending = els.length;
  let called = false;
  const finish = (): void => {
    pending -= 1;
    if (pending <= 0 && !called) {
      called = true;
      done();
    }
  };
  for (const el of els) {
    if (!canAnimate(el)) continue;
    const anim = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, easing: 'ease-out', fill: 'forwards' });
    anim.addEventListener('finish', finish);
    anim.addEventListener('cancel', finish);
  }
  // Safety net: a throttled tab may never fire `finish`.
  setTimeout(() => {
    if (!called) {
      called = true;
      done();
    }
  }, FADE_MS + 80);
}
