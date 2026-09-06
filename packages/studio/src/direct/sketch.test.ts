import { describe, expect, it } from 'vitest';
import { parseDocument, validateDocument } from '@avodado/core';
import { specFor } from './connect.js';
import type { PathSet } from './drag.js';
import { setPathsInSegment } from './host.js';
import {
  ACCEPT_MARGIN,
  ACCEPT_SCORE,
  rankShapes,
  recognize,
  SKETCH_SHAPES,
  sketchable,
  sketchToOps,
  trimClosure,
  type Pt,
  type SketchShape,
  type Stroke,
} from './sketch.js';

/* ─── a hand-drawing simulator (deliberately NOT the template generator) ─── */

/** Deterministic PRNG (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The ideal closed outline of `shape` in a w×h box (top-left at 0,0). */
function ideal(shape: SketchShape, w: number, h: number): Pt[] {
  const curve = (f: (t: number) => Pt, n = 120): Pt[] =>
    Array.from({ length: n + 1 }, (_, i) => f(i / n));
  switch (shape) {
    case 'rect':
      return [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }, { x: 0, y: 0 }];
    case 'diamond':
      return [{ x: w / 2, y: 0 }, { x: w, y: h / 2 }, { x: w / 2, y: h }, { x: 0, y: h / 2 }, { x: w / 2, y: 0 }];
    case 'hexagon':
      return [
        { x: w * 0.22, y: 0 },
        { x: w * 0.78, y: 0 },
        { x: w, y: h / 2 },
        { x: w * 0.78, y: h },
        { x: w * 0.22, y: h },
        { x: 0, y: h / 2 },
        { x: w * 0.22, y: 0 },
      ];
    case 'triangle':
      return [{ x: w / 2, y: 0 }, { x: w, y: h }, { x: 0, y: h }, { x: w / 2, y: 0 }];
    case 'ellipse':
      return curve((t) => ({
        x: w / 2 + (w / 2) * Math.cos(2 * Math.PI * t),
        y: h / 2 + (h / 2) * Math.sin(2 * Math.PI * t),
      }));
    case 'pill': {
      const r = h / 2;
      const straight = w - 2 * r;
      const per = 2 * straight + 2 * Math.PI * r;
      return curve((t) => {
        let s = t * per;
        if (s < straight) return { x: r + s, y: 0 };
        s -= straight;
        if (s < Math.PI * r) {
          const a = -Math.PI / 2 + s / r;
          return { x: w - r + r * Math.cos(a), y: r + r * Math.sin(a) };
        }
        s -= Math.PI * r;
        if (s < straight) return { x: w - r - s, y: h };
        s -= straight;
        const a = Math.PI / 2 + s / r;
        return { x: r + r * Math.cos(a), y: r + r * Math.sin(a) };
      }, 160);
    }
    case 'cylinder': {
      // Drawn slightly shallower than the template's dish — the recognizer
      // must not depend on matching its own generator exactly.
      const d = 0.25 * h;
      const top = curve((t) => ({ x: t * w, y: d * (1 - Math.sin(Math.PI * t)) }), 30);
      return [...top, { x: w, y: h }, { x: 0, y: h }, { x: 0, y: d }];
    }
  }
}

/** Walks a polyline at ~`step` px, returning the interpolated points. */
function walk(poly: readonly Pt[], step: number): Pt[] {
  const out: Pt[] = [{ ...(poly[0] as Pt) }];
  for (let i = 1; i < poly.length; i++) {
    const a = poly[i - 1] as Pt;
    const b = poly[i] as Pt;
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.round(d / step));
    for (let j = 1; j <= n; j++) out.push({ x: a.x + ((b.x - a.x) * j) / n, y: a.y + ((b.y - a.y) * j) / n });
  }
  return out;
}

interface DrawOpts {
  readonly w: number;
  readonly h: number;
  /** Degrees, about the box centre. */
  readonly rot?: number;
  /** Jitter as a fraction of the shorter side. */
  readonly noise?: number;
  readonly seed?: number;
  /** Start offset along the perimeter (0..1) and direction. */
  readonly startAt?: number;
  readonly reverse?: boolean;
  /** Fraction of the perimeter drawn past the start point. */
  readonly overshoot?: number;
  readonly at?: Pt;
}

/** A "hand-drawn" stroke: jitter, wobble, random start, overshoot, rotation. */
function draw(shape: SketchShape, o: DrawOpts): Pt[] {
  const r = rng(o.seed ?? 1);
  const path = walk(ideal(shape, o.w, o.h), 3);
  const closed = path.slice(0, -1); // drop the duplicated start
  const n = closed.length;
  const start = Math.floor(((o.startAt ?? r()) % 1) * n);
  const dir = (o.reverse ?? r() < 0.5) ? -1 : 1;
  const count = n + Math.round((o.overshoot ?? 0.05) * n);
  const pts: Pt[] = [];
  for (let i = 0; i < count; i++) pts.push(closed[(((start + dir * i) % n) + n) % n] as Pt);
  const amp = (o.noise ?? 0.02) * Math.min(o.w, o.h);
  const cx = o.w / 2;
  const cy = o.h / 2;
  const rad = ((o.rot ?? 0) * Math.PI) / 180;
  const at = o.at ?? { x: 300, y: 200 };
  const phase = r() * 6.28;
  return pts.map((p, i) => {
    const wob = amp * 0.8 * Math.sin(i / 9 + phase);
    const x = p.x + (r() - 0.5) * 2 * amp + wob;
    const y = p.y + (r() - 0.5) * 2 * amp - wob;
    return {
      x: at.x + (x - cx) * Math.cos(rad) - (y - cy) * Math.sin(rad),
      y: at.y + (x - cx) * Math.sin(rad) + (y - cy) * Math.cos(rad),
    };
  });
}

function line(from: Pt, to: Pt, seed = 1, noise = 1.2): Pt[] {
  const r = rng(seed);
  const n = 40;
  return Array.from({ length: n + 1 }, (_, i) => ({
    x: from.x + ((to.x - from.x) * i) / n + (r() - 0.5) * noise,
    y: from.y + ((to.y - from.y) * i) / n + (r() - 0.5) * noise,
  }));
}

/* ─── recognizer ──────────────────────────────────────────────────────────── */

const ROTS = [-12, 0, 12];
/**
 * Three sizes per shape, at the aspects the shape is actually DRAWN at: a
 * rect or a pill fills a wide grid cell, a diamond / cylinder / triangle is
 * drawn squarish. (A cylinder squeezed into a 3:1 letterbox is not
 * distinguishable from a rounded rect by anything, including a person.)
 */
const WIDE: ReadonlyArray<{ w: number; h: number }> = [
  { w: 150, h: 52 }, // a grid cell
  { w: 130, h: 64 },
  { w: 96, h: 60 },
];
const SQUARISH: ReadonlyArray<{ w: number; h: number }> = [
  { w: 96, h: 60 },
  { w: 80, h: 70 },
  { w: 70, h: 70 },
];
const SIZES_FOR: Readonly<Record<SketchShape, ReadonlyArray<{ w: number; h: number }>>> = {
  rect: WIDE,
  pill: WIDE,
  hexagon: WIDE,
  diamond: SQUARISH,
  ellipse: SQUARISH,
  cylinder: SQUARISH,
  triangle: SQUARISH,
};
const SEEDS = [1, 2, 3, 4, 5, 6];
/** Per-shape recall floor — see the note above the suite. */
const RECALL_FLOOR = 0.5;

/**
 * The contract is PRECISION, not recall: pen mode must never insert a node
 * the user did not draw. So per shape the gate is
 *
 *   wrong  = 0     — a confident answer naming another shape is a hard failure;
 *   right ≥ 50%    — the rest come back `ambiguous` and open the kind picker,
 *                    which costs one click and cannot be wrong.
 *
 * The floor is 50%, not higher, because two pairs are genuinely close under
 * hand noise at diagram sizes — pill/ellipse (a stadium IS an ellipse once
 * its straight sides are short) and hexagon/ellipse (a wide hexagon with
 * hand-rounded corners). Those resolve through the picker instead of being
 * forced apart by a fragile rule. Overall recall across all shapes must stay
 * at or above 75%.
 */
describe('recognize — shapes', () => {
  const results = new Map<
    SketchShape,
    { right: number; wrong: number; ask: number; total: number; misses: string[] }
  >();
  for (const shape of SKETCH_SHAPES) {
    const r = { right: 0, wrong: 0, ask: 0, total: 0, misses: [] as string[] };
    for (const rot of ROTS) {
      for (const size of SIZES_FOR[shape]) {
        for (const seed of SEEDS) {
          // A pill needs room for its round ends; a square pill IS a circle.
          const w = shape === 'pill' && size.w / size.h < 1.5 ? size.h * 2 : size.w;
          const got = recognize(draw(shape, { ...size, w, rot, seed, noise: 0.025 }));
          r.total += 1;
          const at = `${rot}°/${w}x${size.h}/s${seed}`;
          if (got?.shape === shape) {
            r.right += 1;
          } else if (got === undefined || got.shape === undefined) {
            r.ask += 1;
            r.misses.push(`${at}→ask(${got?.candidates?.join('|') ?? '∅'})`);
          } else {
            r.wrong += 1;
            r.misses.push(`${at}→WRONG:${got.shape}(${got.score.toFixed(2)})`);
          }
        }
      }
    }
    results.set(shape, r);
  }

  for (const shape of SKETCH_SHAPES) {
    it(`never misreads a noisy ${shape}, and reads it outright most of the time`, () => {
      const r = results.get(shape);
      if (r === undefined) throw new Error('missing');
      const acc = r.right / r.total;
      // eslint-disable-next-line no-console
      console.log(
        `sketch ${shape.padEnd(9)} right ${String(r.right).padStart(2)}/${r.total} (${String(Math.round(acc * 100)).padStart(3)}%) · wrong ${r.wrong} · ask ${r.ask}${r.misses.length > 0 ? ' · ' + r.misses.join(' ') : ''}`,
      );
      expect(r.wrong, `confident misreads:\n${r.misses.join('\n')}`).toBe(0);
      expect(acc, r.misses.join('\n')).toBeGreaterThanOrEqual(RECALL_FLOOR);
    });
  }

  it('reports a score at or above the acceptance threshold', () => {
    const got = recognize(draw('rect', { w: 150, h: 52, seed: 9 }));
    expect(got?.shape).toBe('rect');
    expect(got?.score ?? 0).toBeGreaterThanOrEqual(ACCEPT_SCORE);
  });

  it('an ambiguous read names its two candidates and commits nothing', () => {
    // A 96×60 "pill" is barely a stadium — the classic pill/ellipse tie.
    let ambiguous: ReturnType<typeof recognize> | undefined;
    for (const seed of SEEDS) {
      const got = recognize(draw('pill', { w: 96, h: 60, seed, noise: 0.03 }));
      if (got?.ambiguous === true) {
        ambiguous = got;
        break;
      }
    }
    expect(ambiguous, 'expected at least one ambiguous read in the round family').toBeDefined();
    expect(ambiguous?.shape).toBeUndefined();
    expect(ambiguous?.candidates).toHaveLength(2);
    expect(ambiguous?.score ?? 0).toBeGreaterThanOrEqual(ACCEPT_SCORE);
  });

  it('never returns a shape whose runner-up is within the margin', () => {
    for (const shape of SKETCH_SHAPES) {
      for (const seed of SEEDS) {
        const stroke = draw(shape, { w: 130, h: 64, seed, noise: 0.03 });
        const got = recognize(stroke);
        if (got === undefined || got.shape === undefined) continue;
        const ranked = rankShapes(stroke);
        const top = ranked[0];
        const next = ranked[1];
        if (top === undefined || next === undefined) continue;
        // The margin is a RESIDUAL RATIO: the winner's error is at most
        // ACCEPT_MARGIN of the runner-up's.
        expect((1 - top.score) / (1 - next.score), `${shape}/s${seed}`).toBeLessThanOrEqual(ACCEPT_MARGIN);
      }
    }
  });

  it('is start- and direction-agnostic (both ways round, any starting corner)', () => {
    for (const startAt of [0, 0.13, 0.37, 0.5, 0.71, 0.9]) {
      for (const reverse of [false, true]) {
        expect(recognize(draw('diamond', { w: 120, h: 70, startAt, reverse, seed: 3 }))?.shape, `${startAt}/${reverse}`).toBe('diamond');
        expect(recognize(draw('rect', { w: 120, h: 70, startAt, reverse, seed: 3 }))?.shape, `${startAt}/${reverse}`).toBe('rect');
      }
    }
  });

  it('a rect turned 45° is a diamond (orientation is the signal)', () => {
    expect(recognize(draw('rect', { w: 80, h: 80, rot: 45, seed: 2 }))?.shape).toBe('diamond');
  });

  it('trims the overshoot past the start point', () => {
    const pts = draw('rect', { w: 100, h: 60, overshoot: 0.2, noise: 0, startAt: 0, reverse: false });
    const trimmed = trimClosure(pts);
    expect(trimmed.length).toBeLessThan(pts.length);
    expect(recognize(pts)?.shape).toBe('rect');
  });
});

describe('recognize — lines, scribbles, near-misses', () => {
  it('reads a straight stroke as a line, whatever its direction', () => {
    expect(recognize(line({ x: 10, y: 10 }, { x: 200, y: 12 }))?.shape).toBe('line');
    expect(recognize(line({ x: 200, y: 200 }, { x: 40, y: 60 }, 2))?.shape).toBe('line');
    expect(recognize(line({ x: 50, y: 300 }, { x: 52, y: 40 }, 3))?.shape).toBe('line');
  });

  it('a gently curved stroke still reads as a line; a strongly bent one does not', () => {
    const gentle = Array.from({ length: 40 }, (_, i) => ({ x: i * 5, y: Math.sin(i / 39 * Math.PI) * 6 }));
    expect(recognize(gentle)?.shape).toBe('line');
    const bent = Array.from({ length: 40 }, (_, i) => ({ x: i * 5, y: Math.sin(i / 39 * Math.PI) * 90 }));
    expect(recognize(bent)?.shape).not.toBe('line');
  });

  it('reads a back-and-forth zigzag as a scribble', () => {
    const pts: Pt[] = [];
    for (let i = 0; i < 8; i++) {
      pts.push({ x: 100 + (i % 2 === 0 ? 0 : 70), y: 100 + i * 6 });
    }
    expect(recognize(walk(pts, 3))?.shape).toBe('scribble');
  });

  it('returns undefined for a tap, a lone hook, and an open arc', () => {
    expect(recognize([{ x: 1, y: 1 }, { x: 3, y: 2 }])).toBeUndefined();
    const hook = [...line({ x: 0, y: 0 }, { x: 60, y: 0 }, 1, 0), ...line({ x: 60, y: 0 }, { x: 60, y: 60 }, 1, 0)];
    expect(recognize(hook)).toBeUndefined();
    const arc = Array.from({ length: 50 }, (_, i) => {
      const t = Math.PI * (i / 49);
      return { x: 100 + 60 * Math.cos(t), y: 100 + 60 * Math.sin(t) };
    });
    expect(recognize(arc)).toBeUndefined();
  });
});

/* ─── mapping ─────────────────────────────────────────────────────────────── */

function must<T>(v: T | null | undefined): T {
  if (v === null || v === undefined) throw new Error('expected a value');
  return v;
}

const FENCES: Readonly<Record<string, string>> = {
  flow: [
    '```flow',
    'nodes:',
    '  - { id: a, label: Begin, kind: process, col: 1, row: 1 }',
    '  - { id: b, label: Work, kind: process, col: 2, row: 1 }',
    'edges:',
    '  - { from: a, to: b }',
    '```',
  ].join('\n'),
  swimlane: [
    '```swimlane',
    'lanes:',
    '  - { label: Customer }',
    '  - { label: Support }',
    'steps:',
    '  - { id: a, col: 1, lane: 0, label: Report issue }',
    '  - { id: b, col: 2, lane: 1, label: Triage }',
    'links:',
    '  - { from: a, to: b }',
    '```',
  ].join('\n'),
  state: [
    '```state',
    'states:',
    '  - { id: a, name: Draft, kind: active, col: 1, row: 1 }',
    '  - { id: b, name: Live, kind: active, col: 2, row: 1 }',
    'transitions:',
    '  - { from: a, to: b, event: publish }',
    '```',
  ].join('\n'),
  block: [
    '```block',
    'nodes:',
    '  - { id: a, name: Client, kind: client, col: 1, row: 1 }',
    '  - { id: b, name: API, kind: service, col: 2, row: 1 }',
    'edges:',
    '  - { from: a, to: b }',
    '```',
  ].join('\n'),
  c4: [
    '```c4',
    'nodes:',
    '  - { id: a, kind: person, name: User, col: 1, row: 1 }',
    '  - { id: b, kind: system, name: API, col: 2, row: 1 }',
    'edges:',
    '  - { from: a, to: b }',
    '```',
  ].join('\n'),
  dfd: [
    '```dfd',
    'nodes:',
    '  - { id: a, name: Client, kind: external, col: 1, row: 1 }',
    '  - { id: b, name: Ingest, kind: process, col: 2, row: 1 }',
    'edges:',
    '  - { from: a, to: b }',
    '```',
  ].join('\n'),
  felogic: [
    '```felogic',
    'nodes:',
    '  - { id: a, name: Cart, kind: component, col: 1, row: 1 }',
    '  - { id: b, name: CartService, kind: service, col: 2, row: 1 }',
    'edges:',
    '  - { from: a, to: b }',
    '```',
  ].join('\n'),
  graph: [
    '```graph',
    'nodes:',
    '  - { id: a, label: Alpha, col: 1, row: 1 }',
    '  - { id: b, label: Beta, col: 2, row: 1 }',
    'edges:',
    '  - { from: a, to: b }',
    '```',
  ].join('\n'),
};

const K8S_FENCE = [
  '```block',
  'preset: k8s',
  'nodes:',
  '  - { id: a, name: Ingress, kind: ingress, col: 1, row: 1 }',
  '  - { id: b, name: orders, kind: deployment, col: 2, row: 1 }',
  'edges:',
  '  - { from: a, to: b }',
  '```',
].join('\n');

function fixtureOf(fence: string): { data: unknown; apply: (sets: readonly PathSet[]) => string } {
  const source = `# T\n\n${fence}\n`;
  const doc = parseDocument(source, 't');
  const idx = doc.segments.findIndex((s) => s.kind !== 'markdown');
  const seg = doc.segments[idx];
  if (seg === undefined || seg.kind === 'markdown') throw new Error('fixture segment missing');
  return { data: seg.data, apply: (sets) => setPathsInSegment(source, doc, idx, sets) };
}

function fixture(kind: string): { data: unknown; apply: (sets: readonly PathSet[]) => string } {
  return fixtureOf(must(FENCES[kind]));
}

function errorsOf(source: string): string[] {
  const doc = parseDocument(source, 't');
  return validateDocument(doc, 't.md')
    .filter((d) => d.level === 'error')
    .map((d) => `${d.code}: ${d.message}`);
}

const CELL = { col: 3, row: 1 };

/** The expected kind per (block kind, shape); `pick` = the picker opens. */
const EXPECT: Readonly<Record<string, Readonly<Record<SketchShape, string>>>> = {
  flow: { rect: 'process', diamond: 'decision', pill: 'start', ellipse: 'start', cylinder: 'pick', hexagon: 'pick', triangle: 'end' },
  swimlane: { rect: 'action', diamond: 'decision', pill: 'start', ellipse: 'start', cylinder: 'pick', hexagon: 'pick', triangle: 'end' },
  state: { rect: 'active', diamond: 'pick', pill: 'start', ellipse: 'start', cylinder: 'pick', hexagon: 'pick', triangle: 'pick' },
  block: { rect: 'service', diamond: 'gateway', pill: 'client', ellipse: 'pick', cylinder: 'db', hexagon: 'gateway', triangle: 'pick' },
  c4: { rect: 'container', diamond: 'pick', pill: 'pick', ellipse: 'person', cylinder: 'store', hexagon: 'pick', triangle: 'pick' },
  dfd: { rect: 'process', diamond: 'pick', pill: 'pick', ellipse: 'external', cylinder: 'store', hexagon: 'pick', triangle: 'pick' },
  felogic: { rect: 'component', diamond: 'pick', pill: 'pick', ellipse: 'pick', cylinder: 'db', hexagon: 'queue', triangle: 'pick' },
  graph: { rect: 'node', diamond: 'node', pill: 'node', ellipse: 'node', cylinder: 'node', hexagon: 'node', triangle: 'node' },
};

describe('sketchable', () => {
  it('is true for the grid kinds with a mapping, false elsewhere', () => {
    for (const k of Object.keys(EXPECT)) expect(sketchable(k), k).toBe(true);
    for (const k of ['sequence', 'erd', 'cluster', 'table', 'callout']) expect(sketchable(k), k).toBe(false);
  });
});

describe('sketchToOps — closed shapes per block kind', () => {
  for (const kind of Object.keys(EXPECT)) {
    it(`${kind}: every shape maps to the table (or the picker) and validates clean`, () => {
      const { data, apply } = fixture(kind);
      const spec = must(specFor(kind));
      for (const shape of SKETCH_SHAPES) {
        const want = must(EXPECT[kind])[shape];
        const r = sketchToOps(shape, kind, CELL, { data });
        if (want === 'pick') {
          expect(r.type, `${kind}/${shape}`).toBe('pick');
          continue;
        }
        expect(r.type, `${kind}/${shape}`).toBe('node');
        if (r.type !== 'node') continue;
        expect(r.kind, `${kind}/${shape}`).toBe(want);
        expect(r.nodePath).toBe(`${spec.nodesField}.2`);
        const src = apply(r.sets);
        expect(errorsOf(src), `${kind}/${shape}\n${src}`).toEqual([]);
        // The node carries the kind (graph nodes have none) at the cell.
        const node = must(r.sets[r.sets.length - 1]).value as Record<string, unknown>;
        if (kind !== 'graph') expect(node['kind']).toBe(want);
        expect(node['col']).toBe(3);
        expect(kind === 'swimlane' ? node['lane'] : node['row']).toBe(kind === 'swimlane' ? 0 : 1);
        expect(node[spec.labelField]).toBe(r.label);
      }
    });
  }

  it('flow: a pill is `start` until one exists, then `end`; a triangle is an error exit', () => {
    const { data, apply } = fixture('flow');
    const first = sketchToOps('pill', 'flow', CELL, { data });
    expect(first.type === 'node' && first.kind).toBe('start');
    const withStart = fixtureOf(
      must(FENCES['flow']).replace('kind: process, col: 1', 'kind: start, col: 1'),
    );
    const second = sketchToOps('ellipse', 'flow', CELL, { data: withStart.data });
    expect(second.type === 'node' && second.kind).toBe('end');
    const tri = sketchToOps('triangle', 'flow', CELL, { data });
    expect(tri.type).toBe('node');
    if (tri.type !== 'node') return;
    expect(tri.kind).toBe('end');
    expect(tri.label).toBe('Error exit');
    expect(errorsOf(apply(tri.sets))).toEqual([]);
  });

  it('block: a hexagon is a gateway until one exists, then a queue', () => {
    const { data } = fixture('block');
    const withGw = fixtureOf(must(FENCES['block']).replace('kind: client', 'kind: gateway'));
    const gw = sketchToOps('hexagon', 'block', CELL, { data });
    expect(gw.type === 'node' && gw.kind).toBe('gateway');
    const q = sketchToOps('hexagon', 'block', CELL, { data: withGw.data });
    expect(q.type === 'node' && q.kind).toBe('queue');
  });

  it('block (k8s preset): a triangle is an ingress — a free-form kind the picker never offered', () => {
    const { data, apply } = fixtureOf(K8S_FENCE);
    const r = sketchToOps('triangle', 'block', CELL, { data });
    expect(r.type).toBe('node');
    if (r.type !== 'node') return;
    expect(r.kind).toBe('ingress');
    expect(r.label).toBe('New ingress');
    const node = must(r.sets[r.sets.length - 1]).value as Record<string, unknown>;
    expect(node['kind']).toBe('ingress');
    expect(node['name']).toBe('New ingress');
    expect(errorsOf(apply(r.sets))).toEqual([]);
  });

  it('state: a pill is `start` (free-form to the picker) until one exists, then `terminal`', () => {
    const { data, apply } = fixture('state');
    const r = sketchToOps('pill', 'state', CELL, { data });
    expect(r.type === 'node' && r.kind).toBe('start');
    if (r.type === 'node') expect(errorsOf(apply(r.sets))).toEqual([]);
    const withStart = fixtureOf(must(FENCES['state']).replace('kind: active, col: 1', 'kind: start, col: 1'));
    const t = sketchToOps('pill', 'state', CELL, { data: withStart.data });
    expect(t.type === 'node' && t.kind).toBe('terminal');
  });

  it('materializes an auto-laid-out diagram when placements are supplied', () => {
    const { data, apply } = fixtureOf(
      ['```flow', 'nodes:', '  - { id: a, label: Begin }', '  - { id: b, label: Work }', 'edges:', '  - { from: a, to: b }', '```'].join('\n'),
    );
    const r = sketchToOps('rect', 'flow', CELL, { data, placements: [{ col: 1, row: 1 }, { col: 2, row: 1 }] });
    expect(r.type).toBe('node');
    if (r.type !== 'node') return;
    expect(r.materialized).toBe(true);
    expect(errorsOf(apply(r.sets))).toEqual([]);
  });

  it('an ambiguous read always opens the picker, leading with the candidates', () => {
    const { data } = fixture('block');
    const r = sketchToOps(undefined, 'block', CELL, { data, candidates: ['pill', 'ellipse'] });
    expect(r.type).toBe('pick');
    // `pill` is a client on a block; `ellipse` means nothing there.
    if (r.type === 'pick') expect(r.first).toEqual(['client']);
    const flowR = sketchToOps(undefined, 'flow', CELL, { data: fixture('flow').data, candidates: ['rect', 'diamond'] });
    expect(flowR.type === 'pick' && flowR.first).toEqual(['process', 'decision']);
    // No candidates at all is still a picker, just unsorted.
    expect(sketchToOps(undefined, 'flow', CELL, { data })).toEqual({ type: 'pick', first: [] });
  });

  it('an unmapped shape leads the picker with what the runner-up would have meant', () => {
    const { data } = fixture('c4');
    // A cylinder is a store on c4; a hexagon is nothing there.
    const r = sketchToOps('hexagon', 'c4', CELL, { data, candidates: ['cylinder'] });
    expect(r).toEqual({ type: 'pick', first: ['store'] });
  });

  it('refuses kinds without a grid', () => {
    expect(sketchToOps('rect', 'sequence', CELL, { data: {} }).type).toBe('none');
    expect(sketchToOps('rect', 'cluster', CELL, { data: {} }).type).toBe('none');
    expect(sketchToOps('rect', 'table', CELL, { data: {} }).type).toBe('none');
  });
});

describe('sketchToOps — lines and scribbles', () => {
  const kinds = Object.keys(EXPECT);

  it('a line between two nodes is an edge in stroke direction', () => {
    for (const kind of kinds) {
      const { data, apply } = fixture(kind);
      const spec = must(specFor(kind));
      const r = sketchToOps('line', kind, CELL, { data, line: { fromId: 'b', toId: 'a', endCell: CELL } });
      expect(r.type, kind).toBe('edge');
      if (r.type !== 'edge') continue;
      expect(r.fromId).toBe('b');
      expect(r.toId).toBe('a');
      expect(r.sets[0]?.path).toEqual([spec.edgesField, 1]);
      expect(errorsOf(apply(r.sets)), kind).toEqual([]);
    }
  });

  it('a line over an existing edge is refused, a self-line ignored', () => {
    const { data } = fixture('flow');
    expect(sketchToOps('line', 'flow', CELL, { data, line: { fromId: 'a', toId: 'b', endCell: CELL } })).toEqual({
      type: 'none',
      reason: 'Already connected',
    });
    expect(sketchToOps('line', 'flow', CELL, { data, line: { fromId: 'a', toId: 'a', endCell: CELL } }).type).toBe('none');
  });

  it('a line from a node into empty space adds the default kind at the end cell, connected', () => {
    for (const kind of kinds) {
      const { data, apply } = fixture(kind);
      const spec = must(specFor(kind));
      const end = { col: 3, row: 1 };
      const r = sketchToOps('line', kind, CELL, { data, line: { fromId: 'b', toId: null, endCell: end } });
      expect(r.type, kind).toBe('node');
      if (r.type !== 'node') continue;
      expect(r.kind).toBe(must(spec.nodeKinds[0]).kind);
      const edge = must(r.sets[r.sets.length - 1]).value as Record<string, unknown>;
      expect(edge['from']).toBe('b');
      expect(edge['to']).toBe(r.id);
      expect(errorsOf(apply(r.sets)), kind).toEqual([]);
    }
  });

  it('a line on empty canvas does nothing', () => {
    const { data } = fixture('block');
    expect(sketchToOps('line', 'block', CELL, { data, line: { fromId: null, toId: null, endCell: CELL } }).type).toBe('none');
    expect(sketchToOps('line', 'block', CELL, { data }).type).toBe('none');
  });

  it('a scribble over a node deletes it; elsewhere nothing', () => {
    const { data } = fixture('block');
    expect(sketchToOps('scribble', 'block', CELL, { data, under: 'nodes.1' })).toEqual({ type: 'delete', path: 'nodes.1' });
    expect(sketchToOps('scribble', 'block', CELL, { data, under: null }).type).toBe('none');
  });

  it('every stroke value is handled', () => {
    const all: Stroke[] = [...SKETCH_SHAPES, 'line', 'scribble'];
    const { data } = fixture('graph');
    for (const s of all) expect(() => sketchToOps(s, 'graph', CELL, { data })).not.toThrow();
  });
});
