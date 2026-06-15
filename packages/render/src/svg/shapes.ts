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
