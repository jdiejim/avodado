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

/**
 * Renders collected edge labels either as on-edge pills (sparse diagrams) or —
 * when the diagram has 4+ labelled edges — as circled step numerals with the
 * text moved to a legend under the SVG (the agent-loop language; pills at that
 * density collide and read cluttered). Legend entries carry the same `data-bp`
 * as their arrow, so twin highlighting works out of the box.
 */
export function edgeLabelLayer(pending: ReadonlyArray<EdgeLabelPoint>): {
  overlay: string;
  legend: string;
} {
  const labelled = pending.filter((l) => l.label !== undefined && l.label !== '');
  const numbered = labelled.length >= 4;
  const overlay: string[] = [];
  const steps: Array<{ label: string; err?: boolean; path?: string }> = [];
  for (const l of pending) {
    if (l.label === undefined || l.label === '') continue;
    const err = l.err === true;
    if (numbered) {
      steps.push({ label: l.label, path: l.path, ...(err ? { err: true } : {}) });
      overlay.push(`<g${bp(l.path)}>${edgeStep({ lx: l.lx, ly: l.ly }, steps.length, err)}</g>`);
    } else {
      overlay.push(`<g${bp(l.path)}>${edgePill({ lx: l.lx, ly: l.ly }, l.label, err)}</g>`);
    }
  }
  return { overlay: overlay.join(''), legend: stepsLegend(steps) };
}
