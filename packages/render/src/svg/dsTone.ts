/**
 * Series and tone palette — the one place a chart may spend colour, and the
 * tone vocabulary of the algorithms & data-structures family.
 *
 * The skin (`DESIGN.md`) spends one accent per diagram. Charts are the
 * exception: a chart with 2–5 series needs a series ramp. That ramp lives in
 * CSS custom properties (`--series-1` … `--series-5`, defined in `css.ts`),
 * and this file carries their fallbacks — the ONLY hex values a chart renderer
 * touches — so the no-hex test keeps this file on its allowlist and nothing
 * else.
 *
 * Three vocabularies:
 *
 * - {@link seriesColor}: the series ramp (`ink` alone, the ramp for 2–5 series,
 *   `negative` for a series the author marked `accent: red`).
 * - {@link inkTone}: the ink ramp (`ink` → `muted` → `soft` → `rule-solid` →
 *   `paper-2`) for donut / funnel / waterfall / gauge, where the parts of one
 *   whole are told apart by tone, plus a `dark` flag that says whether text
 *   on that step is `paper` or `ink`.
 * - {@link dsTone}: the `array` / `linkedlist` / `bintree` / `hashmap` states.
 */

/**
 * Fallbacks for `--series-N` — desaturated, every step ≥ 3:1 against
 * `paper-2` in light mode. `css.ts` defines the properties themselves (and
 * their dark-mode values); these only apply when a host stylesheet lacks them.
 */
export const SERIES_FALLBACK: readonly string[] = ['#3d4656', '#8a5a3c', '#5f7f6e', '#6b6f9c', '#8a7a48'];

/** How many distinct series steps the ramp has before it cycles. */
export const SERIES_STEPS = SERIES_FALLBACK.length;

/**
 * Label colours for a swatch whose fill is author DATA (the `palette` block):
 * the label must contrast with that fixed colour in both themes, so it cannot
 * be a theme token. The fallback swatch stands in for an unsafe colour value.
 */
export const SWATCH_TEXT = { dark: '#1f2937', light: '#ffffff', fallback: '#d1d5db' } as const;

/**
 * The colour of series `i` (0-based) in a chart of `count` series.
 *
 * - One series: `ink` — nothing to tell apart, so nothing is coloured.
 * - Several: `var(--series-N)` with its fallback, cycling past five.
 * - `accent: red` on a series is the author saying "this one is the bad one":
 *   it takes `negative`. Every other legacy accent name is ignored — the ramp
 *   is assigned in series order, so the skin (not the author) picks hues.
 */
export function seriesColor(i: number, count: number, accent?: string | undefined): string {
  if (accent === 'red') return 'var(--negative)';
  if (count <= 1) return 'var(--ink)';
  const step = ((i % SERIES_STEPS) + SERIES_STEPS) % SERIES_STEPS;
  return `var(--series-${step + 1}, ${SERIES_FALLBACK[step] ?? ''})`;
}

/** One step of the ink ramp: fill, the stroke that keeps a pale step visible, and whether text on it is paper. */
export interface InkTone {
  readonly fill: string;
  readonly stroke: string;
  /** True when the step is dark enough that text on it must be `paper`. */
  readonly dark: boolean;
}

const INK_RAMP: readonly InkTone[] = [
  { fill: 'var(--ink)', stroke: 'var(--ink)', dark: true },
  { fill: 'var(--muted)', stroke: 'var(--muted)', dark: true },
  { fill: 'var(--soft)', stroke: 'var(--soft)', dark: true },
  { fill: 'var(--rule-solid)', stroke: 'var(--rule-solid)', dark: false },
  { fill: 'var(--paper-2)', stroke: 'var(--ink)', dark: false },
];

/** How many distinct steps the ink ramp has before it cycles. */
export const INK_STEPS = INK_RAMP.length;

/** What an item's legacy `accent` name means under the skin — see {@link markOf}. */
export type Mark = 'focal' | 'negative' | undefined;

/**
 * Resolves the `accent` names on a list of items to the one meaning the skin
 * keeps: `red` is `negative`; any other name is a flag, and the flag means
 * "focal" only when exactly ONE item carries it — an author who coloured every
 * slice from the old palette marked nothing, so the ramp applies to all.
 */
export function marksOf(accents: ReadonlyArray<string | undefined>): Mark[] {
  const flagged = accents.filter((a) => a !== undefined && a !== 'red').length;
  return accents.map((a) => (a === 'red' ? 'negative' : a !== undefined && flagged === 1 ? 'focal' : undefined));
}

/** {@link marksOf} for one item in its list. */
export function markOf(accents: ReadonlyArray<string | undefined>, i: number): Mark {
  return marksOf(accents)[i];
}

/**
 * The ink-ramp step for slice / band / bar `i` — `ink` first, paling with
 * the index. A `negative` mark gives `negative`; a `focal` mark gives
 * `accent`. Text on an accent or negative fill is `paper`.
 */
export function inkTone(i: number, mark?: Mark): InkTone {
  if (mark === 'negative') return { fill: 'var(--negative)', stroke: 'var(--negative)', dark: true };
  if (mark === 'focal') return { fill: 'var(--accent)', stroke: 'var(--accent)', dark: true };
  const step = ((i % INK_STEPS) + INK_STEPS) % INK_STEPS;
  return INK_RAMP[step] ?? { fill: 'var(--ink)', stroke: 'var(--ink)', dark: true };
}

/** The tone names shared by the data-structure blocks. */
export type DsTone = 'active' | 'visited' | 'target' | 'muted';

/** Fill / stroke / text for one tone, plus the dash and weight the skin gives it. */
export interface DsToneStyle {
  readonly fill: string;
  readonly stroke: string;
  readonly text: string;
  readonly sw: number;
  /** `stroke-dasharray`, or `''` for a solid outline. */
  readonly dash: string;
}

/**
 * Algorithm states, told apart by stroke, fill and dash — never by hue alone
 * (`DESIGN.md`): `active` (the element under examination) is the accent
 * outline; `target` (the goal) is the accent outline on an accent tint;
 * `visited` is the inactive `paper-2` fill; `muted` (out of play) is a dashed
 * ghost. No tone is the plain paper cell with an ink outline.
 */
const TONES: Record<DsTone, DsToneStyle> = {
  active: { fill: 'var(--paper)', stroke: 'var(--accent)', text: 'var(--accent)', sw: 1.75, dash: '' },
  // Ink text: `accent` on the accent tint sits just under 4.5:1 at 13px.
  target: { fill: 'var(--accent-tint)', stroke: 'var(--accent)', text: 'var(--ink)', sw: 1.75, dash: '' },
  visited: { fill: 'var(--paper-2)', stroke: 'var(--rule-solid)', text: 'var(--muted)', sw: 1, dash: '' },
  muted: { fill: 'var(--paper)', stroke: 'var(--rule-solid)', text: 'var(--soft)', sw: 1, dash: '4 3' },
};

const NEUTRAL: DsToneStyle = { fill: 'var(--paper)', stroke: 'var(--ink)', text: 'var(--ink)', sw: 1.5, dash: '' };

/**
 * Resolves a tone (or none) to its style. Unknown tones (invalid per schema,
 * but render is lenient) fall back to the neutral cell.
 */
export function dsTone(tone: DsTone | undefined): DsToneStyle {
  if (tone === undefined) return NEUTRAL;
  return (TONES as Partial<Record<string, DsToneStyle>>)[tone] ?? NEUTRAL;
}

/** The SVG attributes for a tone's outline (fill, stroke, width, dash). */
export function dsToneAttrs(t: DsToneStyle): string {
  const dash = t.dash.length > 0 ? ` stroke-dasharray="${t.dash}"` : '';
  return ` fill="${t.fill}" stroke="${t.stroke}" stroke-width="${t.sw}"${dash}`;
}

/** The legend swatch and label for each tone the data-structure blocks share. */
export const DS_TONE_LEGEND: Readonly<Record<DsTone, { swatch: 'node-accent-outline' | 'node-accent' | 'node-fill2' | 'node-dashed'; label: string }>> = {
  active: { swatch: 'node-accent-outline', label: 'current' },
  target: { swatch: 'node-accent', label: 'target' },
  visited: { swatch: 'node-fill2', label: 'visited' },
  muted: { swatch: 'node-dashed', label: 'out of play' },
};
