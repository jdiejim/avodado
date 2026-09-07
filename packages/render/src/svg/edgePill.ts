/**
 * Renders an SVG edge label as a small rounded pill, sized to the label text.
 *
 * Returned as an SVG `<g>` fragment so it can be appended inside an enclosing
 * `<svg>`. Returns the empty string if `label` is falsy.
 *
 * Ported from `resources/doc-studio.jsx` `EdgePill`.
 */

import { escapeHtml } from '../escape.js';
import { DECORATIVE } from './decorative.js';

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
    `<rect x="${p.lx - w / 2}" y="${p.ly - 9}" width="${w}" height="18" rx="9" fill="var(--white)" stroke="var(--rule)"${DECORATIVE}/>` +
    `<text x="${p.lx}" y="${p.ly + 3}" class="edge-label${errClass}">${escapeHtml(label)}</text>` +
    `</g>`
  );
}

/**
 * The skin's edge label: `.t-arrow` on a plain `paper` mask (no pill outline)
 * so the text sits in a gap of the line it rides. `accent` colours the label
 * like its edge; `err` uses `negative`.
 */
export function edgeMask(
  p: PillPoint,
  label: string | undefined,
  tone: 'muted' | 'error' | 'accent' = 'muted',
): string {
  if (label === undefined || label === '') return '';
  const w = Math.round(label.length * 6 + 8);
  const cls = tone === 'error' ? ' c-negative' : tone === 'accent' ? ' c-accent' : '';
  return (
    `<g>` +
    `<rect x="${p.lx - w / 2}" y="${p.ly - 7}" width="${w}" height="14" fill="var(--paper)"/>` +
    `<text x="${p.lx}" y="${p.ly + 3.5}" class="t-arrow${cls}" text-anchor="middle">${escapeHtml(label)}</text>` +
    `</g>`
  );
}
