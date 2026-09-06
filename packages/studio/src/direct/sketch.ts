/**
 * Pen mode: a rough one-stroke shape drawn over a diagram becomes the right
 * node. Two pure halves, no DOM:
 *
 * - {@link recognize} — a $1 unistroke recognizer (Wobbrock, Wilson & Li):
 *   resample to 64 points, scale, translate to the centroid, golden-section
 *   search over rotation for the best path distance against programmatically
 *   generated templates (rect, diamond, pill, ellipse, cylinder, hexagon,
 *   triangle). Two cheap detections run BEFORE $1: a LINE (endpoint distance
 *   ≈ path length) and a SCRIBBLE (many turns — "delete what's under it").
 *
 *   Departures from the paper, each for a reason this feature needs:
 *   1. Rotation is BOUNDED (±15°) instead of normalized to the indicative
 *      angle. Full rotation invariance makes a square and a diamond the same
 *      stroke, and rect vs diamond is the distinction pen mode exists for.
 *   2. Scaling is UNIFORM and the templates are generated at the stroke's own
 *      aspect: diagram cells are ~3:1, and $1's non-uniform scale-to-square
 *      turns a 2px vertical wobble into a 10px one — wider than the gap
 *      between a rect and a pill.
 *   3. Templates are dense closed outlines in both windings, matched over a
 *      small window of START OFFSETS. Sharp-cornered templates are phase
 *      sensitive: one sample of drift puts the rect's corners between the
 *      stroke's, and a smoother template wins a shape it should not.
 *   4. The stroke is lightly smoothed before matching (hand jitter is
 *      high-frequency, shape is not), and the distance weights its WORST
 *      QUARTILE: several of these shapes differ only over a short arc, which
 *      a plain mean dilutes to nothing.
 *   5. A match is returned only when it also beats the runner-up by
 *      {@link ACCEPT_MARGIN}. Precision over recall — an ambiguous stroke
 *      opens the kind picker, and a wrong node is never inserted silently.
 *
 * - {@link sketchToOps} — maps a recognized shape + block kind + grid cell
 *   to the same writes the connect layer emits (`newNodeAtOps`, `newNodeOps`,
 *   `edgeOp`), or asks for the kind picker when the shape means nothing on
 *   that kind (a cylinder on a state machine) — never a silent wrong insert.
 */

import {
  edgeOp,
  newNodeAtOps,
  newNodeOps,
  specFor,
  type ConnectSpec,
} from './connect.js';
import type { PathSet, Placement } from './drag.js';

/* ─── geometry ────────────────────────────────────────────────────────────── */

export interface Pt {
  readonly x: number;
  readonly y: number;
}

/** The closed shapes the recognizer knows (template-matched). */
export type SketchShape = 'rect' | 'diamond' | 'pill' | 'ellipse' | 'cylinder' | 'hexagon' | 'triangle';
/** Everything a stroke can resolve to. */
export type Stroke = SketchShape | 'line' | 'scribble';

export interface Recognition {
  /** The read shape — `undefined` when two shapes tie ({@link Recognition.ambiguous}). */
  readonly shape: Stroke | undefined;
  /** 0..1 — $1 score for shapes, straightness for a line, turn ratio for a scribble. */
  readonly score: number;
  /** True when the runner-up's residual is within {@link ACCEPT_MARGIN} of the winner's. */
  readonly ambiguous?: boolean;
  /** The tied shapes, best first — the picker lists their kinds first. */
  readonly candidates?: readonly SketchShape[];
}

export const SKETCH_SHAPES: readonly SketchShape[] = [
  'rect',
  'diamond',
  'pill',
  'ellipse',
  'cylinder',
  'hexagon',
  'triangle',
];

const N = 64;
const SIZE = 250;
const DENSE = N * 4;
export const ACCEPT_SCORE = 0.8;
/**
 * How far the best template must beat the runner-up to commit a node,
 * expressed as a RATIO of their residuals: the winner's error must be at most
 * 70% of the runner-up's. A plain score difference does not work here —
 * scores saturate in the 0.90–0.98 band, where a 0.01 gap can be decisive and
 * a 0.04 gap meaningless. The ratio is scale-free, so one threshold holds for
 * a crisp stroke and a shaky one.
 *
 * Tuned on the synthetic set for ZERO confident misreads: a stadium and an
 * ellipse under hand noise are genuinely close, and pen mode asks rather than
 * inserting the wrong node.
 */
export const ACCEPT_MARGIN = 0.7;
/**
 * Bounded rotation search. It must be well under 45°/2: at ±25° a square
 * tilted 12° is only 33° from a diamond template's reach, and the diamond
 * wins on noise — orientation, the single signal separating rect from
 * diamond, leaks away. At ±15° a tilted rect stays a rect, while a stroke
 * drawn at a true 45° needs NO rotation to match the diamond template.
 */
const ROT_BOUND = (15 * Math.PI) / 180;
const ROT_STOP = (2 * Math.PI) / 180;
const PHI = 0.5 * (-1 + Math.sqrt(5));
/** A line: endpoint distance over path length. */
export const LINE_STRAIGHTNESS = 0.92;
/** A scribble: total absolute turning on a coarse resample (2.5 turns). */
const SCRIBBLE_TURN = 5 * Math.PI;
const TURN_SAMPLES = 20;
/** Moving-average width over the dense (256-point) resample. */
const SMOOTH_WINDOW = 5;
/** Start-offset search: ±8% of the perimeter, in 9 steps. */
const START_WINDOW = 0.08;
const START_SAMPLES = 9;
/** How much of the path distance comes from its worst-fitting quartile. */
const WORST_WEIGHT = 0.7;
/** Aspect ratios outside this range are clamped (a sliver is not a shape). */
const ASPECT_MIN = 0.3;
const ASPECT_MAX = 5;

function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function pathLength(pts: readonly Pt[]): number {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += dist(pts[i - 1] as Pt, pts[i] as Pt);
  return d;
}

function centroid(pts: readonly Pt[]): Pt {
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p.x;
    y += p.y;
  }
  return { x: x / pts.length, y: y / pts.length };
}

function bbox(pts: readonly Pt[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

/** `n` points evenly spaced along the polyline (the $1 resample). */
export function resample(points: readonly Pt[], n: number): Pt[] {
  const pts = points.map((p) => ({ x: p.x, y: p.y }));
  const interval = pathLength(pts) / (n - 1);
  if (interval <= 0) return Array.from({ length: n }, () => ({ ...(pts[0] as Pt) }));
  let acc = 0;
  const out: Pt[] = [{ ...(pts[0] as Pt) }];
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1] as Pt;
    const cur = pts[i] as Pt;
    const d = dist(prev, cur);
    if (acc + d >= interval && d > 0) {
      const t = (interval - acc) / d;
      const q = { x: prev.x + t * (cur.x - prev.x), y: prev.y + t * (cur.y - prev.y) };
      out.push(q);
      pts.splice(i, 0, q); // q becomes the next segment's start
      acc = 0;
    } else {
      acc += d;
    }
  }
  while (out.length < n) out.push({ ...(pts[pts.length - 1] as Pt) });
  return out.slice(0, n);
}

/** Uniform scale so the longer side spans `SIZE` (aspect preserved). */
function scaleUniform(pts: readonly Pt[]): Pt[] {
  const b = bbox(pts);
  const s = SIZE / Math.max(b.maxX - b.minX, b.maxY - b.minY, 1e-6);
  return pts.map((p) => ({ x: p.x * s, y: p.y * s }));
}

function translateToOrigin(pts: readonly Pt[]): Pt[] {
  const c = centroid(pts);
  return pts.map((p) => ({ x: p.x - c.x, y: p.y - c.y }));
}

function rotateBy(pts: readonly Pt[], rad: number): Pt[] {
  if (rad === 0) return [...pts];
  const c = centroid(pts);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return pts.map((p) => ({
    x: (p.x - c.x) * cos - (p.y - c.y) * sin + c.x,
    y: (p.x - c.x) * sin + (p.y - c.y) * cos + c.y,
  }));
}

/**
 * $1's mean point-to-point distance, blended with the mean of the WORST
 * quartile. Several of these shapes differ only over a short arc of their
 * outline — a cylinder is a rect with a dished top, a pill is a rect with two
 * round ends — and a plain mean spreads that evidence across 64 points until
 * it disappears under hand noise. The worst-quartile term keeps a localized
 * mismatch localized.
 */
function pathDistance(a: readonly Pt[], b: readonly Pt[]): number {
  const each: number[] = [];
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = dist(a[i] as Pt, b[i] as Pt);
    each.push(d);
    sum += d;
  }
  const mean = sum / a.length;
  each.sort((x, y) => y - x);
  const q = Math.max(1, Math.round(a.length / 4));
  let worst = 0;
  for (let i = 0; i < q; i++) worst += each[i] as number;
  return (1 - WORST_WEIGHT) * mean + WORST_WEIGHT * (worst / q);
}

/** Scale, resample to `n`, centre — the shared normalization. */
function normalize(pts: readonly Pt[], n: number): Pt[] {
  return translateToOrigin(resample(scaleUniform(pts), n));
}

/**
 * Hand jitter is high-frequency; shape is low-frequency. Resample densely
 * (uniform spacing) and run a short moving average so a wobbly edge reads
 * as the edge it meant to be. Endpoints stay put.
 */
export function smooth(pts: readonly Pt[], window = SMOOTH_WINDOW): Pt[] {
  if (pts.length < 3) return [...pts];
  const dense = resample(pts, DENSE);
  const half = Math.floor(window / 2);
  return dense.map((p, i) => {
    if (i < half || i >= dense.length - half) return p;
    let x = 0;
    let y = 0;
    for (let j = i - half; j <= i + half; j++) {
      x += (dense[j] as Pt).x;
      y += (dense[j] as Pt).y;
    }
    return { x: x / window, y: y / window };
  });
}

/** Sum of absolute heading changes along the stroke. */
function totalTurning(pts: readonly Pt[]): number {
  let turn = 0;
  let prev: number | null = null;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1] as Pt;
    const b = pts[i] as Pt;
    if (dist(a, b) < 1e-6) continue;
    const h = Math.atan2(b.y - a.y, b.x - a.x);
    if (prev !== null) {
      let d = h - prev;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      turn += Math.abs(d);
    }
    prev = h;
  }
  return turn;
}

/**
 * A closed stroke usually overshoots its start; cut the tail at the point
 * (past 60% of the length) that comes closest to the first point, when it
 * gets within 12% of the bbox diagonal — so the overlap doesn't skew the
 * resample.
 */
export function trimClosure(points: readonly Pt[]): Pt[] {
  if (points.length < 4) return [...points];
  const first = points[0] as Pt;
  const b = bbox(points);
  const near = 0.12 * Math.hypot(b.maxX - b.minX, b.maxY - b.minY);
  const total = pathLength(points);
  let acc = 0;
  let cut = -1;
  let cutD = Infinity;
  for (let i = 1; i < points.length; i++) {
    acc += dist(points[i - 1] as Pt, points[i] as Pt);
    if (acc < 0.6 * total) continue;
    const d = dist(points[i] as Pt, first);
    if (d <= near && d < cutD) {
      cutD = d;
      cut = i;
    }
  }
  return cut === -1 ? [...points] : points.slice(0, cut + 1);
}

/** +1 when the closed stroke runs clockwise on screen (y down), −1 otherwise. */
function winding(pts: readonly Pt[]): 1 | -1 {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i] as Pt;
    const b = pts[(i + 1) % pts.length] as Pt;
    area += a.x * b.y - b.x * a.y;
  }
  return area >= 0 ? 1 : -1;
}

function aspectOf(pts: readonly Pt[]): number {
  const b = bbox(pts);
  const w = Math.max(b.maxX - b.minX, 1e-6);
  const h = Math.max(b.maxY - b.minY, 1e-6);
  return Math.min(ASPECT_MAX, Math.max(ASPECT_MIN, w / h));
}

/* ─── templates ───────────────────────────────────────────────────────────── */

/** Polygon vertices, closed by repeating the first. */
function polygon(v: readonly Pt[]): Pt[] {
  return [...v, v[0] as Pt];
}

function arc(cx: number, cy: number, rx: number, ry: number, from: number, to: number, steps: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = from + ((to - from) * i) / steps;
    out.push({ x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) });
  }
  return out;
}

/** The canonical outline of `shape` in a `w`×1 box (y grows downward). */
export function outline(shape: SketchShape, w: number): Pt[] {
  const h = 1;
  switch (shape) {
    case 'rect':
      return polygon([{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }]);
    case 'diamond':
      return polygon([{ x: w / 2, y: 0 }, { x: w, y: h / 2 }, { x: w / 2, y: h }, { x: 0, y: h / 2 }]);
    case 'hexagon':
      return polygon([
        { x: w * 0.25, y: 0 },
        { x: w * 0.75, y: 0 },
        { x: w, y: h / 2 },
        { x: w * 0.75, y: h },
        { x: w * 0.25, y: h },
        { x: 0, y: h / 2 },
      ]);
    case 'triangle':
      return polygon([{ x: w / 2, y: 0 }, { x: w, y: h }, { x: 0, y: h }]);
    case 'ellipse':
      return arc(w / 2, h / 2, w / 2, h / 2, -Math.PI / 2, 1.5 * Math.PI, 96);
    case 'pill': {
      // A stadium: straight top/bottom, semicircle ends (a square one is a circle).
      const r = Math.min(w, h) / 2;
      if (w >= h) {
        return [
          { x: r, y: 0 },
          { x: w - r, y: 0 },
          ...arc(w - r, r, r, r, -Math.PI / 2, Math.PI / 2, 24),
          { x: r, y: h },
          ...arc(r, r, r, r, Math.PI / 2, 1.5 * Math.PI, 24),
        ];
      }
      return [
        ...arc(r, r, r, r, Math.PI, 2 * Math.PI, 24),
        { x: w, y: h - r },
        ...arc(r, h - r, r, r, 0, Math.PI, 24),
        { x: 0, y: r },
      ];
    }
    case 'cylinder': {
      // A rect whose top edge is a shallow upward arc (one stroke). The arc
      // bulges INSIDE the box: every outline must have bbox exactly w × h,
      // or the template is generated at a different aspect than the stroke
      // it is being compared with — which is what makes a drawn cylinder
      // score worse against the cylinder template than against a rect.
      const depth = 0.28 * h;
      const top: Pt[] = [];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        top.push({ x: t * w, y: depth * (1 - Math.sin(Math.PI * t)) });
      }
      return [...top, { x: w, y: h }, { x: 0, y: h }, { x: 0, y: depth }];
    }
  }
}

interface Template {
  readonly shape: SketchShape;
  /** The winding the outline runs in (see {@link winding}). */
  readonly dir: 1 | -1;
  /** `DENSE` evenly spaced, normalized points around the closed outline. */
  readonly pts: readonly Pt[];
}

const cache = new Map<number, readonly Template[]>();
/** Below this width/height a pill has no straight sides — it IS an ellipse. */
const PILL_MIN_ASPECT = 1.25;

/**
 * The template set at a width/height `aspect` (rounded to 0.05 and cached):
 * every shape, both windings.
 */
export function templatesAt(aspect: number): readonly Template[] {
  const key = Math.round(Math.min(ASPECT_MAX, Math.max(ASPECT_MIN, aspect)) * 20) / 20;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const out: Template[] = [];
  for (const shape of SKETCH_SHAPES) {
    if (shape === 'pill' && key < PILL_MIN_ASPECT && key > 1 / PILL_MIN_ASPECT) continue;
    const o = outline(shape, key);
    const pts = normalize(o, DENSE);
    const dir = winding(pts);
    out.push({ shape, dir, pts });
    out.push({ shape, dir: dir === 1 ? -1 : 1, pts: [...pts].reverse() });
  }
  cache.set(key, out);
  return out;
}

/** The template's 64 points, walked from index `from`. */
function walkFrom(t: Template, from: number): Pt[] {
  // The candidate's 64 points span its whole (closed) path, so the last one
  // sits back on the first: step so the template's 64th point wraps to its
  // start too, or the two drift apart by 1/64 of the perimeter at the end.
  const step = t.pts.length / (N - 1);
  const out: Pt[] = [];
  for (let i = 0; i < N; i++) {
    out.push(t.pts[(((from + Math.round(i * step)) % t.pts.length) + t.pts.length) % t.pts.length] as Pt);
  }
  return out;
}

/** The outline index closest to the stroke's first point. */
function nearestIndex(t: Template, start: Pt): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < t.pts.length; i++) {
    const d = dist(t.pts[i] as Pt, start);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/**
 * The best path distance between `cand` and `t`, over a small window of start
 * offsets around the anchor point.
 *
 * The window matters most for the CORNERED shapes. A hand-drawn rect and the
 * rect template rarely distribute their 64 samples the same way, so the
 * template's corners can land between the stroke's — and with sharp corners
 * a phase error of one sample is a large distance, while a smooth template
 * (a cylinder, an ellipse) absorbs it. Without this window, a drawn rect
 * scores better against the cylinder than against a rect.
 */
function bestOverStarts(cand: readonly Pt[], t: Template): number {
  const anchor = nearestIndex(t, cand[0] as Pt);
  const span = Math.round(t.pts.length * START_WINDOW);
  const step = Math.max(1, Math.round(span / START_SAMPLES));
  let best = Infinity;
  for (let off = -span; off <= span; off += step) {
    const d = pathDistance(cand, walkFrom(t, anchor + off));
    if (d < best) best = d;
  }
  return best;
}

/**
 * Rotate the dense stroke by `rad`, normalize, and measure it against the
 * `shape` template generated at the ROTATED stroke's aspect (a tilted rect's
 * bounding box is not the rect's), in the stroke's own winding. Infinity
 * when no such template exists (a pill at a square aspect).
 */
function distanceAtAngle(dense: readonly Pt[], shape: SketchShape, dir: 1 | -1, rad: number): number {
  const turned = rotateBy(dense, rad);
  const t = templatesAt(aspectOf(turned)).find((x) => x.shape === shape && x.dir === dir);
  if (t === undefined) return Infinity;
  return bestOverStarts(normalize(turned, N), t);
}

/** Golden-section search for the rotation (within the bound) that fits `shape` best. */
function distanceAtBestAngle(dense: readonly Pt[], shape: SketchShape, dir: 1 | -1): number {
  let a = -ROT_BOUND;
  let b = ROT_BOUND;
  let x1 = PHI * a + (1 - PHI) * b;
  let f1 = distanceAtAngle(dense, shape, dir, x1);
  let x2 = (1 - PHI) * a + PHI * b;
  let f2 = distanceAtAngle(dense, shape, dir, x2);
  while (Math.abs(b - a) > ROT_STOP) {
    if (f1 < f2) {
      b = x2;
      x2 = x1;
      f2 = f1;
      x1 = PHI * a + (1 - PHI) * b;
      f1 = distanceAtAngle(dense, shape, dir, x1);
    } else {
      a = x1;
      x1 = x2;
      f1 = f2;
      x2 = (1 - PHI) * a + PHI * b;
      f2 = distanceAtAngle(dense, shape, dir, x2);
    }
  }
  return Math.min(f1, f2);
}

/* ─── recognition ─────────────────────────────────────────────────────────── */

/**
 * Recognizes one stroke. Order: a tap (path shorter than `minLength`) is
 * nothing; a LINE wins on straightness; a SCRIBBLE wins on turning; else the
 * best-scoring template — but only when it is both confident
 * ({@link ACCEPT_SCORE}) and CLEARLY ahead of the runner-up
 * ({@link ACCEPT_MARGIN}).
 *
 * The contract is precision, not recall: a confident wrong node is worse than
 * a question. A top score that no runner-up trails by the margin comes back
 * `ambiguous` with its two best candidates, which the caller turns into an
 * anchored kind picker. `undefined` means "not a shape at all".
 */
export function recognize(
  points: readonly Pt[],
  opts: { readonly minLength?: number } = {},
): Recognition | undefined {
  if (points.length < 2) return undefined;
  const len = pathLength(points);
  if (len < (opts.minLength ?? 12)) return undefined;
  const straight = dist(points[0] as Pt, points[points.length - 1] as Pt) / len;
  if (straight >= LINE_STRAIGHTNESS) return { shape: 'line', score: straight };
  // Turning is measured on a COARSE resample: hand jitter turns a 64-point
  // outline into a sawtooth, but a real scribble survives 20 points.
  const turn = totalTurning(resample(points, TURN_SAMPLES));
  if (turn >= SCRIBBLE_TURN) return { shape: 'scribble', score: Math.min(1, turn / (2 * SCRIBBLE_TURN)) };
  const ranked = rankShapes(points);
  const top = ranked[0];
  if (top === undefined || top.score < ACCEPT_SCORE) return undefined;
  const next = ranked[1];
  if (next !== undefined && (1 - top.score) / (1 - next.score) > ACCEPT_MARGIN) {
    return {
      shape: undefined,
      score: top.score,
      ambiguous: true,
      candidates: [top.shape, next.shape],
    };
  }
  return { shape: top.shape, score: top.score };
}

/** Every template shape's best score for the stroke, highest first. */
export function rankShapes(points: readonly Pt[]): Array<{ shape: SketchShape; score: number }> {
  const dense = smooth(trimClosure(points));
  const dir = winding(dense);
  const aspect = aspectOf(dense);
  // The score's unit: half the diagonal of the normalized box ($1's 0.5·√2·size).
  const halfDiag = 0.5 * Math.hypot(SIZE, SIZE / Math.max(aspect, 1 / aspect));
  return SKETCH_SHAPES.map((shape) => ({
    shape,
    score: 1 - distanceAtBestAngle(dense, shape, dir) / halfDiag,
  }))
    .filter((r) => Number.isFinite(r.score))
    .sort((a, b) => b.score - a.score);
}

/* ─── mapping ─────────────────────────────────────────────────────────────── */

/** What the caller measured around the stroke (all DOM-derived, none required). */
export interface SketchCtx {
  readonly data: unknown;
  /** Effective cells of every node (renderer `data-col`/`data-row`) — lets an auto-laid-out diagram pin. */
  readonly placements?: readonly Placement[] | undefined;
  /** A LINE's endpoints: the node ids under each end (null = empty canvas) and the end cell. */
  readonly line?: {
    readonly fromId: string | null;
    readonly toId: string | null;
    readonly endCell: Placement;
  };
  /** A SCRIBBLE: the `data-bp` path of the node under it, if any. */
  readonly under?: string | null;
  /**
   * An AMBIGUOUS read's tied shapes (best first). The picker lists the kinds
   * they map to on this block first, so the near-miss is one click away.
   */
  readonly candidates?: readonly SketchShape[];
}

export type SketchResult =
  | {
      readonly type: 'node';
      readonly sets: PathSet[];
      readonly nodePath: string;
      readonly id: string;
      readonly materialized: boolean;
      readonly kind: string;
      readonly label: string;
    }
  | { readonly type: 'edge'; readonly sets: PathSet[]; readonly fromId: string; readonly toId: string }
  /** The shape means nothing certain here — open the kind picker at the cell. */
  /**
   * The shape means nothing certain here — open the kind picker at the cell.
   * `first` are the kinds the tied/near-miss shapes map to on this block,
   * hoisted to the top of the picker.
   */
  | { readonly type: 'pick'; readonly first: readonly string[] }
  | { readonly type: 'delete'; readonly path: string }
  | { readonly type: 'none'; readonly reason: string };

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function nodeRecords(spec: ConnectSpec, data: unknown): Array<Record<string, unknown>> {
  const v = asRecord(data)?.[spec.nodesField];
  return (Array.isArray(v) ? v : []).map(asRecord).filter((r): r is Record<string, unknown> => r !== null);
}

function hasKind(spec: ConnectSpec, data: unknown, kind: string): boolean {
  return nodeRecords(spec, data).some((n) => n['kind'] === kind);
}

/** A kind choice for a shape, with optional field overrides on the node. */
interface KindPick {
  readonly kind: string;
  readonly extra?: Readonly<Record<string, unknown>>;
}
type Chooser = (spec: ConnectSpec, data: unknown) => KindPick | null;

const k =
  (kind: string): Chooser =>
  () => ({ kind });
/** `start` while the diagram has none, then `end` (or the given closer). */
const opener =
  (open: string, close: string): Chooser =>
  (spec, data) => ({ kind: hasKind(spec, data, open) ? close : open });
const errorExit: Chooser = (spec) => ({ kind: 'end', extra: { [spec.labelField]: 'Error exit' } });

/**
 * Shape → node kind per block kind. A missing entry means "not meaningful
 * here" → the picker. `graph` has one kind, so every closed shape is a node.
 */
const KIND_TABLE: Readonly<Record<string, Partial<Readonly<Record<SketchShape, Chooser>>>>> = {
  flow: {
    rect: k('process'),
    diamond: k('decision'),
    pill: opener('start', 'end'),
    ellipse: opener('start', 'end'),
    triangle: errorExit,
  },
  swimlane: {
    rect: k('action'),
    diamond: k('decision'),
    pill: opener('start', 'end'),
    ellipse: opener('start', 'end'),
    triangle: errorExit,
  },
  state: {
    rect: k('active'),
    pill: opener('start', 'terminal'),
    ellipse: opener('start', 'terminal'),
  },
  block: {
    rect: k('service'),
    diamond: k('gateway'),
    pill: k('client'),
    cylinder: k('db'),
    hexagon: (spec, data) => ({ kind: hasKind(spec, data, 'gateway') ? 'queue' : 'gateway' }),
    // The k8s preset's entry kind; anywhere else a triangle means nothing.
    triangle: (_spec, data) => (asRecord(data)?.['preset'] === 'k8s' ? { kind: 'ingress' } : null),
  },
  c4: {
    rect: k('container'),
    ellipse: k('person'),
    cylinder: k('store'),
  },
  dfd: {
    rect: k('process'),
    ellipse: k('external'),
    cylinder: k('store'),
  },
  felogic: {
    rect: k('component'),
    cylinder: k('db'),
    hexagon: k('queue'),
  },
  graph: {
    rect: k('node'),
    diamond: k('node'),
    pill: k('node'),
    ellipse: k('node'),
    cylinder: k('node'),
    hexagon: k('node'),
    triangle: k('node'),
  },
};

/** True when pen mode makes sense on this block kind (grid nodes + a mapping). */
export function sketchable(blockKind: string): boolean {
  const spec = specFor(blockKind);
  return spec !== null && spec.gridNodes && spec.newNode !== undefined && KIND_TABLE[blockKind] !== undefined;
}

/**
 * The writes that append a node of `kind` at `cell` — through
 * {@link newNodeAtOps} for a kind the spec's picker offers, and for a
 * free-form kind (`ingress` on a k8s block, `start` on a state machine) via
 * the first picker kind with `kind` + label overridden, so the node still
 * carries every field the schema wants.
 */
export function sketchNodeOps(
  spec: ConnectSpec,
  data: unknown,
  cell: Placement,
  kind: string,
  placements?: readonly Placement[],
  extra?: Readonly<Record<string, unknown>>,
): { sets: PathSet[]; nodePath: string; id: string; materialized: boolean; label: string } | null {
  const known = spec.nodeKinds.find((c) => c.kind === kind);
  const base = known ?? spec.nodeKinds[0];
  if (base === undefined) return null;
  const label =
    typeof extra?.[spec.labelField] === 'string'
      ? (extra[spec.labelField] as string)
      : `New ${(known?.label ?? kind).toLowerCase()}`;
  const over: Record<string, unknown> = { ...(extra ?? {}) };
  if (known === undefined) {
    over['kind'] = kind;
    over[spec.labelField] = label;
  }
  const r = newNodeAtOps(spec, data, cell, base.kind, placements, Object.keys(over).length > 0 ? over : undefined);
  return r === null ? null : { ...r, label };
}

/** The kinds `shapes` map to on this block, in order, without repeats. */
function kindsFor(blockKind: string, spec: ConnectSpec, data: unknown, shapes: readonly SketchShape[]): string[] {
  const out: string[] = [];
  for (const s of shapes) {
    const pick = KIND_TABLE[blockKind]?.[s]?.(spec, data);
    if (pick !== null && pick !== undefined && !out.includes(pick.kind)) out.push(pick.kind);
  }
  return out;
}

/**
 * Maps a recognized stroke to writes. Closed shapes look the kind up in
 * {@link KIND_TABLE}; a LINE between two nodes is an edge (stroke direction =
 * edge direction), from a node into empty space a new node of the block's
 * default kind at the end cell, elsewhere nothing; a SCRIBBLE over a node
 * deletes it.
 *
 * `shape: undefined` is an AMBIGUOUS read — it always opens the picker, with
 * `ctx.candidates`' kinds hoisted to the top.
 */
export function sketchToOps(
  shape: Stroke | undefined,
  blockKind: string,
  cell: Placement,
  ctx: SketchCtx,
): SketchResult {
  const spec = specFor(blockKind);
  if (spec === null || spec.newNode === undefined || !spec.gridNodes) {
    return { type: 'none', reason: 'This block has no grid to draw on' };
  }
  const placements = ctx.placements ?? undefined;
  /** The picker, with the near-miss kinds first. */
  const askFor = (shapes: readonly SketchShape[]): SketchResult => ({
    type: 'pick',
    first: kindsFor(blockKind, spec, ctx.data, shapes),
  });
  if (shape === undefined) return askFor(ctx.candidates ?? []);

  if (shape === 'line') {
    const line = ctx.line;
    if (line === undefined || line.fromId === null) return { type: 'none', reason: '' };
    if (line.toId !== null) {
      if (line.toId === line.fromId) return { type: 'none', reason: '' };
      const sets = edgeOp(spec, ctx.data, line.fromId, line.toId);
      if (sets === null) return { type: 'none', reason: 'Already connected' };
      return { type: 'edge', sets, fromId: line.fromId, toId: line.toId };
    }
    const first = spec.nodeKinds[0];
    if (first === undefined) return { type: 'none', reason: '' };
    const r = newNodeOps(spec, ctx.data, line.fromId, line.endCell, first.kind, placements);
    if (r === null) return { type: 'none', reason: '' };
    return { type: 'node', ...r, kind: first.kind, label: `New ${first.label.toLowerCase()}` };
  }

  if (shape === 'scribble') {
    return ctx.under !== undefined && ctx.under !== null
      ? { type: 'delete', path: ctx.under }
      : { type: 'none', reason: '' };
  }

  const chooser = KIND_TABLE[blockKind]?.[shape];
  const pick = chooser === undefined ? null : chooser(spec, ctx.data);
  // An unmapped shape still hints: the picker leads with whatever the
  // runner-up candidates DO mean on this block.
  if (pick === null) return askFor(ctx.candidates ?? []);
  const r = sketchNodeOps(spec, ctx.data, cell, pick.kind, placements, pick.extra);
  if (r === null) return askFor([shape, ...(ctx.candidates ?? [])]);
  return { type: 'node', ...r, kind: pick.kind };
}
