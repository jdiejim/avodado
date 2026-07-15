/**
 * Global SVG `<defs>` shared by multiple block renderers (markers used as edge
 * arrow heads, a drop-shadow filter for boxed nodes).
 *
 * Emitted once near the top of the rendered body so subsequent SVGs can
 * reference them by id. Ported from `resources/doc-studio.jsx` `GlobalDefs`.
 */

/**
 * Returns the SVG element containing global marker + filter definitions.
 * The element is invisible (width/height = 0) but the defs are scoped to the
 * document so any subsequent `<svg>` can use `marker-end="url(#gArrow)"` etc.
 */
export function globalDefsSvg(): string {
  return (
    `<svg width="0" height="0" style="position:absolute" aria-hidden="true">` +
    `<defs>` +
    `<marker id="gArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">` +
    `<path d="M0,0 L10,5 L0,10 z" fill="var(--charcoal)"/></marker>` +
    `<marker id="gSoft" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">` +
    `<path d="M0,0 L10,5 L0,10 z" fill="var(--gray)"/></marker>` +
    `<marker id="gErr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">` +
    `<path d="M0,0 L10,5 L0,10 z" fill="#991b1b"/></marker>` +
    `<marker id="gTri" viewBox="0 0 14 14" refX="13" refY="7" markerWidth="14" markerHeight="14" orient="auto-start-reverse">` +
    `<path d="M1,1 L13,7 L1,13 z" fill="#fff" stroke="#6b21a8" stroke-width="1.2"/></marker>` +
    `<filter id="gshadow" x="-20%" y="-20%" width="140%" height="170%">` +
    `<feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#0e54a1" flood-opacity="0.13"/></filter>` +
    `</defs>` +
    `</svg>`
  );
}
