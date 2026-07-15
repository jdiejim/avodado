/**
 * Renders an SVG edge label as a small rounded pill, sized to the label text.
 *
 * Returned as an SVG `<g>` fragment so it can be appended inside an enclosing
 * `<svg>`. Returns the empty string if `label` is falsy.
 *
 * Ported from `resources/doc-studio.jsx` `EdgePill`.
 */

import { escapeHtml } from '../escape.js';

/** Pill placement (midpoint of the labelled edge). */
export interface PillPoint {
  readonly lx: number;
  readonly ly: number;
}

/**
 * @param p - Midpoint of the edge (typically from {@link ortho}).
 * @param label - Label text. Empty/undefined yields an empty string.
 * @param err - If true, the label is rendered in the error style.
 */
export function edgePill(p: PillPoint, label: string | undefined, err = false): string {
  if (label === undefined || label === '') return '';
  const w = Math.max(26, label.length * 5.4);
  const errClass = err ? ' err' : '';
  return (
    `<g>` +
    `<rect x="${p.lx - w / 2}" y="${p.ly - 9}" width="${w}" height="18" rx="9" fill="var(--white)" stroke="var(--rule)"/>` +
    `<text x="${p.lx}" y="${p.ly + 3}" class="edge-label${errClass}">${escapeHtml(label)}</text>` +
    `</g>`
  );
}
