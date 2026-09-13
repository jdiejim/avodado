/**
 * Shared SVG utilities — geometry, edge routing, label pills, global defs.
 *
 * Every block renderer that emits SVG should import from this barrel so the
 * shared `<defs>` markers (`gArrow`, `gSoft`, `gErr`, `gTri`, `gshadow`) are
 * available and the routing math stays consistent.
 */

export { globalDefsSvg } from './defs.js';
export { ortho, type Box, type Route } from './ortho.js';
export { wrapText } from './wrapText.js';
export { edgePill, type PillPoint } from './edgePill.js';
export type { NodeSkin, NodeColors, EdgeStyle } from './blockStyle.js';
export type { LegendItem, LegendSwatch } from './legend.js';
