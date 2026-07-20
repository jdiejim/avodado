/**
 * Numbered edge steps — the agent-loop visual language generalized: instead of
 * a text pill riding every arrow (which collides on dense diagrams), each
 * labelled edge gets a small circled numeral at its midpoint, and the labels
 * move to a tidy step legend rendered under the SVG.
 *
 * {@link edgeLabelLayer} packages the one rule every edge-bearing renderer
 * shares: fewer than four labelled edges keep on-edge pills; four or more
 * switch to circled numerals + a legend.
 */

import { escapeHtml } from '../escape.js';
import { bp } from '../paths.js';
import { edgePill, type PillPoint } from './edgePill.js';

/** A circled step numeral at an edge midpoint. */
export function edgeStep(p: PillPoint, n: number, err = false): string {
  const stroke = err ? 'var(--negative)' : 'var(--charcoal)';
  const text = err ? 'var(--negative)' : 'var(--charcoal)';
  return (
    `<g>` +
    `<circle cx="${p.lx}" cy="${p.ly}" r="9.5" fill="var(--white)" stroke="${stroke}" stroke-width="1.2"/>` +
    `<text x="${p.lx}" y="${p.ly + 3.5}" text-anchor="middle" style="font-family:var(--font-mono);font-size:10px;font-weight:700" fill="${text}">${n}</text>` +
    `</g>`
  );
}

/**
 * The legend row under the SVG: `① label · ② label …`. A step's `path` (its
 * edge's data path, e.g. `edges.3`) is emitted as `data-bp` so editors can
 * twin-highlight the legend entry with its arrow.
 */
export function stepsLegend(
  steps: ReadonlyArray<{ label: string; err?: boolean; path?: string }>,
): string {
  if (steps.length === 0) return '';
  const items = steps
    .map(
      (s, i) =>
        `<span class="edge-step${s.err === true ? ' err' : ''}"${s.path !== undefined ? bp(s.path) : ''}><b>${i + 1}</b>${escapeHtml(s.label)}</span>`,
    )
    .join('');
  return `<div class="edge-steps">${items}</div>`;
}

/** One collected edge-label midpoint, with the edge's data path. */
export interface EdgeLabelPoint {
  readonly lx: number;
  readonly ly: number;
  readonly label?: string | undefined;
  readonly err?: boolean;
  /** Data path of the edge in the block's YAML, e.g. `edges.3` / `links.0`. */
  readonly path: string;
}

/** A node box the badge layer must keep clear of. */
export interface AvoidRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Clearance around a node box: the badge radius (9.5) plus breathing room. */
const DODGE_PAD = 13;

/**
 * Nudges a label point out of any `avoid` box it overlaps: an edge midpoint
 * can land ON a node (a long edge passing a box in a tight layout), printing
 * the numeral over the node's label. The point escapes along the axis with the
 * shortest exit — which tracks the (orthogonal) edge it rides on. Two passes,
 * so escaping one box into a neighbour resolves too.
 */
function dodge(lx: number, ly: number, avoid: ReadonlyArray<AvoidRect>): PillPoint {
  let x = lx;
  let y = ly;
  let dodged = false;
  for (let pass = 0; pass < 2; pass++) {
    let moved = false;
    for (const r of avoid) {
      const x0 = r.x - DODGE_PAD;
      const y0 = r.y - DODGE_PAD;
      const x1 = r.x + r.w + DODGE_PAD;
      const y1 = r.y + r.h + DODGE_PAD;
      if (x <= x0 || x >= x1 || y <= y0 || y >= y1) continue;
      // Escape distances to each inflated side; take the cheapest.
      const dl = x - x0;
      const dr = x1 - x;
      const dt = y - y0;
      const db = y1 - y;
      const min = Math.min(dl, dr, dt, db);
      if (min === dl) x = x0;
      else if (min === dr) x = x1;
      else if (min === dt) y = y0;
      else y = y1;
      moved = true;
      dodged = true;
    }
    if (!moved) break;
  }
  // An undisturbed point passes through bit-exact (byte-determinism holds for
  // every diagram that never had a collision); a dodged one rounds cleanly.
  return dodged ? { lx: Math.round(x), ly: Math.round(y) } : { lx, ly };
}

/**
 * Renders collected edge labels either as on-edge pills (sparse diagrams) or —
 * when the diagram has 4+ labelled edges — as circled step numerals with the
 * text moved to a legend under the SVG (the agent-loop language; pills at that
 * density collide and read cluttered). Legend entries carry the same `data-bp`
 * as their arrow, so twin highlighting works out of the box. Pass the node
 * boxes as `avoid` and any badge whose midpoint lands on a node is nudged off
 * it along the edge's axis.
 */
export function edgeLabelLayer(
  pending: ReadonlyArray<EdgeLabelPoint>,
  avoid: ReadonlyArray<AvoidRect> = [],
): {
  overlay: string;
  legend: string;
} {
  const labelled = pending.filter((l) => l.label !== undefined && l.label !== '');
  const numbered = labelled.length >= 4;
  const overlay: string[] = [];
  const steps: Array<{ label: string; err?: boolean; path?: string }> = [];
  // Badges also keep clear of each other: each placed numeral joins the avoid
  // list (as a small box), so two edges whose midpoints coincide — or whose
  // dodges land in the same spot — stack apart instead of overlapping.
  const placed: AvoidRect[] = [...avoid];
  for (const l of pending) {
    if (l.label === undefined || l.label === '') continue;
    const err = l.err === true;
    const at = dodge(l.lx, l.ly, numbered ? placed : avoid);
    if (numbered) {
      placed.push({ x: at.lx - 6, y: at.ly - 6, w: 12, h: 12 });
      steps.push({ label: l.label, path: l.path, ...(err ? { err: true } : {}) });
      overlay.push(`<g${bp(l.path)}>${edgeStep(at, steps.length, err)}</g>`);
    } else {
      overlay.push(`<g${bp(l.path)}>${edgePill(at, l.label, err)}</g>`);
    }
  }
  return { overlay: overlay.join(''), legend: stepsLegend(steps) };
}
