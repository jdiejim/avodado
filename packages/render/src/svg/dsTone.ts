/**
 * Shared tone palette for the algorithms & data-structures family
 * (`array` / `linkedlist` / `bintree` / `hashmap`).
 *
 * Each tone maps to a `{ fill, stroke, text }` triple built from the theme's
 * CSS variables, so tinted cells retint with the active theme:
 *
 * - `active`  — solid navy, white text (the element under examination)
 * - `visited` — light-blue fill, navy text (already processed)
 * - `target`  — positive pair (the goal element)
 * - `muted`   — light-gray fill, gray text (out of play)
 * - none      — white fill, hairline border, charcoal text
 */

/** The tone names shared by the data-structure blocks. */
export type DsTone = 'active' | 'visited' | 'target' | 'muted';

/** Fill / stroke / text colors for one tone. */
export interface DsToneStyle {
  readonly fill: string;
  readonly stroke: string;
  readonly text: string;
}

const TONES: Record<DsTone, DsToneStyle> = {
  active: { fill: 'var(--navy)', stroke: 'var(--navy)', text: '#fff' },
  visited: { fill: 'var(--light-blue)', stroke: 'var(--navy)', text: 'var(--navy)' },
  target: { fill: 'var(--positive-soft)', stroke: 'var(--positive)', text: 'var(--positive)' },
  muted: { fill: 'var(--light-gray)', stroke: 'var(--rule)', text: 'var(--gray)' },
};

const NEUTRAL: DsToneStyle = { fill: '#fff', stroke: 'var(--rule)', text: 'var(--charcoal)' };

/** Resolves a tone (or none) to its style triple. */
export function dsTone(tone: DsTone | undefined): DsToneStyle {
  return tone === undefined ? NEUTRAL : TONES[tone];
}
