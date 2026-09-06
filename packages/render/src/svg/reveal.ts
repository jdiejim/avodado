/**
 * Step-through reveal order for decks.
 *
 * A renderer whose diagram has a natural order (messages, steps, transitions,
 * bars by start time) marks the element group that should appear at step `n`
 * with `data-reveal="n"` (0-based; several elements may share a step — a
 * message and its badge, an edge and its label). The attribute is inert
 * metadata on every target: the page, print and the static deck show
 * everything; only the deck's runtime controller reads it, hiding the groups
 * and revealing one step per key press before the deck advances. Geometry
 * never changes — reveal is a lens on an already complete drawing.
 */

/** ` data-reveal="n"` — the element appears at step `n` of the slide's build. */
export function revealAttr(n: number): string {
  return ` data-reveal="${n}"`;
}
