/**
 * The accessible name of a diagram SVG.
 *
 * A screen reader announces an `<svg role="img">` by its `aria-label`, and a
 * pointer hover shows its `<title>`. A generic name ("Sequence diagram") tells
 * a non-sighted reader only what kind of picture they cannot see. A name built
 * from the block's OWN data — its title and the size of what it draws — tells
 * them what is in it, and whether the surrounding prose already covered it.
 *
 * One shape for every diagram:
 *
 *     <Diagram kind>: <block title>, <count>, <count>
 *
 * Both the title and the counts are optional; with neither, the name falls
 * back to the bare kind. The renderer supplies the counts because only it
 * knows what it drew (a sequence counts real messages, not frame markers).
 */

import { escapeHtml } from '../escape.js';

/** `1 message` / `3 messages` — the count phrases a diagram name is built from. */
export function countPhrase(n: number, noun: string, plural = `${noun}s`): string {
  return `${n} ${n === 1 ? noun : plural}`;
}

/**
 * The diagram's accessible name: the kind, then the block's own title (when it
 * has one), then the counts, comma separated. Blank/absent parts drop out.
 */
export function diagramName(
  kind: string,
  title: string | undefined,
  counts: readonly string[] = [],
): string {
  const t = (title ?? '').trim();
  const parts = [...(t !== '' ? [t] : []), ...counts.filter((c) => c.trim() !== '')];
  return parts.length === 0 ? kind : `${kind}: ${parts.join(', ')}`;
}

/**
 * ` role="img" aria-label="…"` — the open-tag attributes that carry the name
 * to assistive tech. Always paired with {@link svgTitleEl} in the same SVG:
 * the label is what a screen reader reads, the title what a pointer reveals.
 */
export function svgNameAttrs(name: string): string {
  return ` role="img" aria-label="${escapeHtml(name)}"`;
}

/** `<title>…</title>` — the first child of the SVG, matching the aria-label. */
export function svgTitleEl(name: string): string {
  return `<title>${escapeHtml(name)}</title>`;
}

/**
 * Both halves at once for a diagram whose name is built from block data:
 * `{ attrs, title }` to splice into the `<svg …>` tag and straight after it.
 */
export function svgName(
  kind: string,
  title: string | undefined,
  counts: readonly string[] = [],
): { name: string; attrs: string; title: string } {
  const name = diagramName(kind, title, counts);
  return { name, attrs: svgNameAttrs(name), title: svgTitleEl(name) };
}
