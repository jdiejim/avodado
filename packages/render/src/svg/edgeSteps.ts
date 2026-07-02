/**
 * Numbered edge steps — the agent-loop visual language generalized: instead of
 * a text pill riding every arrow (which collides on dense diagrams), each
 * labelled edge gets a small circled numeral at its midpoint, and the labels
 * move to a tidy step legend rendered under the SVG.
 */

import { escapeHtml } from '../escape.js';
import type { PillPoint } from './edgePill.js';

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

/** The legend row under the SVG: `① label · ② label …`. */
export function stepsLegend(steps: ReadonlyArray<{ label: string; err?: boolean }>): string {
  if (steps.length === 0) return '';
  const items = steps
    .map(
      (s, i) =>
        `<span class="edge-step${s.err === true ? ' err' : ''}"><b>${i + 1}</b>${escapeHtml(s.label)}</span>`,
    )
    .join('');
  return `<div class="edge-steps">${items}</div>`;
}
