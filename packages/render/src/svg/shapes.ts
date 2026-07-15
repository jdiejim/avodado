/** Small SVG path helpers shared by the diagram renderers. */

/**
 * A rectangle path with only the **right** corners rounded — the left edge is
 * square so an accent stripe sits flush against it (no "weird" rounded notch at
 * the top-left / bottom-left). Returns the `d` attribute value.
 */
export function rectRoundRight(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h / 2);
  return (
    `M${x},${y} h${w - rr} a${rr},${rr} 0 0 1 ${rr},${rr} ` +
    `v${h - 2 * rr} a${rr},${rr} 0 0 1 ${-rr},${rr} h${-(w - rr)} z`
  );
}

interface XY {
  readonly x: number;
  readonly y: number;
}

/**
 * Builds an SVG path through `pts`, rounding each interior corner with a quadratic
 * so a routed edge reads as a smooth polyline rather than hard right angles.
 */
export function roundedPath(pts: readonly XY[], r = 7): string {
  const round = (n: number): number => Math.round(n * 10) / 10;
  const first = pts[0];
  if (first === undefined) return '';
  let d = `M${round(first.x)},${round(first.y)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    const a = pts[i - 1];
    const b = pts[i + 1];
    if (p === undefined || a === undefined || b === undefined) continue;
    const d1 = Math.hypot(p.x - a.x, p.y - a.y) || 1;
    const d2 = Math.hypot(b.x - p.x, b.y - p.y) || 1;
    const r1 = Math.min(r, d1 / 2);
    const r2 = Math.min(r, d2 / 2);
    const p1 = { x: p.x + ((a.x - p.x) / d1) * r1, y: p.y + ((a.y - p.y) / d1) * r1 };
    const p2 = { x: p.x + ((b.x - p.x) / d2) * r2, y: p.y + ((b.y - p.y) / d2) * r2 };
    d += ` L${round(p1.x)},${round(p1.y)} Q${round(p.x)},${round(p.y)} ${round(p2.x)},${round(p2.y)}`;
  }
  const last = pts[pts.length - 1];
  if (last !== undefined) d += ` L${round(last.x)},${round(last.y)}`;
  return d;
}
