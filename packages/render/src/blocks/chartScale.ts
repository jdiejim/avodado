/**
 * Scale helpers shared by the `chart` kinds (`chart.ts` and `chartKinds.ts`):
 * value formatting, nice tick steps, numeric axis domains, and the SVG opener.
 * Pure arithmetic — no data types, no drawing.
 */

/** Clamps negatives to 0 (charts render the non-negative range only). */
export const pos = (v: number): number => (Number.isFinite(v) && v > 0 ? v : 0);

/** Formats a value with the optional unit suffix, trimming float noise. */
export function fmt(v: number, unit: string | undefined): string {
  const n = Math.round(v * 100) / 100;
  return `${n}${unit ?? ''}`;
}

/**
 * A nice tick step (1 / 2 / 2.5 / 5 × 10^n) for a span, choosing the step
 * whose tick count over `span` lands in 4–6 (closest to 5).
 */
export function niceStep(span: number): number {
  if (!(span > 0)) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(span / 5)));
  const candidates = [1, 2, 2.5, 5, 10].map((m) => m * mag);
  let best = candidates[0] ?? 1;
  let bestScore = Infinity;
  for (const c of candidates) {
    const n = Math.ceil(span / c - 1e-9);
    const score = n >= 4 && n <= 6 ? Math.abs(n - 5) : 10 + Math.abs(n - 5);
    if (score < bestScore) {
      best = c;
      bestScore = score;
    }
  }
  return best;
}

/**
 * The nice number (1 / 2 / 2.5 / 5 × 10^n) closest to `raw` in log space —
 * a bin width or a step that should read as a round figure.
 */
export function niceNear(raw: number): number {
  if (!(raw > 0) || !Number.isFinite(raw)) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const candidates = [1, 2, 2.5, 5, 10].map((m) => m * mag);
  let best = candidates[0] ?? 1;
  let bestDist = Infinity;
  for (const c of candidates) {
    const d = Math.abs(Math.log10(c) - Math.log10(raw));
    if (d < bestDist) {
      best = c;
      bestDist = d;
    }
  }
  return best;
}

/** Nice ticks from 0 to the first step multiple at or above `max`. */
export function niceTicks(max: number): number[] {
  const step = niceStep(max);
  const n = Math.max(1, Math.ceil(max / step - 1e-9));
  return Array.from({ length: n + 1 }, (_v, i) => Math.round(i * step * 1e6) / 1e6);
}

export interface NumScale {
  readonly min: number;
  readonly max: number;
  readonly ticks: readonly number[];
}

/** Pads a data extent, snaps it to nice tick multiples, and lists the ticks. */
export function numScale(values: readonly number[]): NumScale {
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (lo === hi) {
    // A flat extent can't scale — open a symmetric window around the value.
    const pad = lo === 0 ? 1 : Math.abs(lo) * 0.2;
    lo -= pad;
    hi += pad;
  } else {
    const pad = (hi - lo) * 0.06;
    lo -= pad;
    hi += pad;
  }
  const step = niceStep(hi - lo);
  const min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  // Guard float drift so the last tick always lands on `max`.
  for (let t = min; t <= max + step / 2; t += step) ticks.push(Math.round(t * 1e6) / 1e6);
  return { min, max, ticks };
}

/** Rounds to one decimal — the precision SVG coordinates are emitted at. */
export const r1 = (n: number): number => Math.round(n * 10) / 10;

export function svgOpenSize(w: number, h: number): string {
  return `<svg viewBox="0 0 ${w} ${h}" role="img"><title>Chart</title>`;
}
