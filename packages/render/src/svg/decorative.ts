/**
 * `data-decorative` — the marker a renderer puts on a stroked shape that is
 * chrome, not content.
 *
 * WCAG 1.4.11 asks 3:1 for "parts of graphics required to understand the
 * content". A tick gridline, a row separator inside a card, the silhouette
 * detail inside a node glyph, the gap a donut cuts between two slices: none of
 * those carry information — remove them and the diagram still says everything
 * it said. They are drawn at hairline weight on purpose, and darkening them to
 * 3:1 would make the page shout the parts that matter least.
 *
 * The attribute is inert (it changes no rendering) and covers descendants, so
 * a whole decorative layer can be marked once on its group. It is what
 * `scripts/contrast-audit.mjs --nontext` skips.
 */

/** ` data-decorative="1"` — chrome, not content; the non-text audit skips it. */
export const DECORATIVE = ' data-decorative="1"';
