/**
 * Dashed GROUP wrappers on the coordinate-grid diagrams (block, flow, dfd,
 * state, c4): an outline rect spanning a cell range with a corner label,
 * drawn beneath edges and nodes. One implementation for all five renderers —
 * each passes its own cell geometry. Extracted verbatim from the block-graph
 * renderer, so `block` output is byte-identical to the pre-extraction markup.
 */

import { escapeHtml } from '../escape.js';
import { safeColor } from '../sanitize.js';
import { bl, bp } from '../paths.js';

/** One group (the shared `gridGroupSchema` shape in core). */
export interface GridGroup {
  readonly id?: string | undefined;
  readonly col: number;
  readonly row: number;
  readonly cols?: number | undefined;
  readonly rows?: number | undefined;
  readonly label: string;
  readonly color?: string | undefined;
}

/** The cell geometry a renderer draws groups against. */
export interface GridGroupGeom {
  /** Left x of a column's cell. */
  readonly xOf: (col: number) => number;
  /** Top y of a row's cell. */
  readonly yOf: (row: number) => number;
  readonly cellW: number;
  readonly cellH: number;
  readonly gapX: number;
  readonly gapY: number;
  /**
   * The skin's group panel (`DESIGN.md`): `paper-2` fill, 1px `rule-solid`,
   * the label as a `.t-eyebrow` in `soft`. An explicit `color` on the group
   * still tints its outline and label — that is the author's data. Off for
   * the renderers that have not migrated.
   */
  readonly skin?: boolean;
}

/**
 * The extra room a group needs around its cell range (the rect overshoots the
 * cells by 28px left/right, 38px above — label headroom — and 28px below).
 * Renderers whose base padding is tighter than the block renderer's grow to
 * these values when groups are present, so an edge-hugging group is never
 * clipped by the viewBox; group-less documents keep their exact old padding.
 */
export const GROUP_PADS = { padX: 38, padTop: 52, padBot: 36 } as const;

/** The grid extent (max col/row) the groups reach — feeds cols/rows maths. */
export function groupExtent(groups: readonly GridGroup[]): { cols: number; rows: number } {
  return {
    cols: Math.max(1, ...groups.map((g) => g.col + (g.cols ?? 1) - 1)),
    rows: Math.max(1, ...groups.map((g) => g.row + (g.rows ?? 1) - 1)),
  };
}

/** True when `inner` sits fully inside a strictly bigger `outer`. */
function containedBy(inner: GridGroup, outer: GridGroup): boolean {
  if (inner === outer) return false;
  const ic2 = inner.col + (inner.cols ?? 1);
  const ir2 = inner.row + (inner.rows ?? 1);
  const oc2 = outer.col + (outer.cols ?? 1);
  const or2 = outer.row + (outer.rows ?? 1);
  const inside = inner.col >= outer.col && inner.row >= outer.row && ic2 <= oc2 && ir2 <= or2;
  const bigger = (outer.cols ?? 1) * (outer.rows ?? 1) > (inner.cols ?? 1) * (inner.rows ?? 1);
  return inside && bigger;
}

/**
 * Renders the `<g data-bl="groups">…</g>` layer: one dashed outline + corner
 * label per group (`data-bp="groups.N"`), largest groups first so smaller
 * ones layer on top, nested groups inset by containment depth with their
 * label anchored top-RIGHT so it never sits on the container's label.
 */
export function gridGroupsSvg(groups: readonly GridGroup[], geo: GridGroupGeom): string {
  const groupRect = (g: GridGroup): { x: number; y: number; w: number; h: number } => ({
    x: geo.xOf(g.col) - 28,
    y: geo.yOf(g.row) - 38,
    w: (g.cols ?? 1) * geo.cellW + ((g.cols ?? 1) - 1) * geo.gapX + 56,
    h: (g.rows ?? 1) * geo.cellH + ((g.rows ?? 1) - 1) * geo.gapY + 66,
  });

  // Largest groups first so smaller ones layer on top (index kept for paths).
  const sortedGroups = groups
    .map((g, gi) => ({ g, gi }))
    .sort(
      (a, b) => (b.g.cols ?? 1) * (b.g.rows ?? 1) - (a.g.cols ?? 1) * (a.g.rows ?? 1),
    );

  let s = `<g${bl('groups')}>`;
  for (const { g, gi } of sortedGroups) {
    const raw = groupRect(g);
    const col = safeColor(g.color, 'var(--slate)');
    // Nested zones inset by containment depth so a subnet's border never sits
    // on top of its VPC's border — the containing area reads clearly.
    const depth = groups.filter((o) => containedBy(g, o)).length;
    const r = {
      x: raw.x + depth * 12,
      y: raw.y + depth * 11,
      w: raw.w - depth * 24,
      h: raw.h - depth * 17,
    };
    const nested = depth > 0;
    if (geo.skin === true) {
      const tint = safeColor(g.color, '');
      const stroke = tint.length > 0 ? tint : 'var(--rule-solid)';
      const text = tint.length > 0 ? tint : 'var(--soft)';
      // A plain `.t-eyebrow` tab (mono), like a sequence frame's `ALT` / `OPT`.
      const lbl = nested
        ? `<text x="${r.x + r.w - 12}" y="${r.y + 16}" class="t-eyebrow" fill="${text}" text-anchor="end">${escapeHtml(g.label)}</text>`
        : `<text x="${r.x + 12}" y="${r.y + 16}" class="t-eyebrow" fill="${text}">${escapeHtml(g.label)}</text>`;
      s +=
        `<g${bp(`groups.${gi}`)}>` +
        `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="6" fill="var(--paper-2)" fill-opacity="0.6" stroke="${stroke}" stroke-width="1"/>` +
        lbl +
        `</g>`;
      continue;
    }
    const label = nested
      ? `<text x="${r.x + r.w - 16}" y="${r.y + 19}" class="grp-label" fill="${col}" text-anchor="end">${escapeHtml(g.label)}</text>`
      : `<text x="${r.x + 16}" y="${r.y + 19}" class="grp-label" fill="${col}">${escapeHtml(g.label)}</text>`;
    // Elegant outline zone (fe/be style): no background fill, a dashed boundary,
    // and a plain label — no solid label badge.
    s +=
      `<g${bp(`groups.${gi}`)}>` +
      `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="12" fill="none" stroke="${col}" stroke-opacity="0.6" stroke-width="1.3" stroke-dasharray="7 5"/>` +
      label +
      `</g>`;
  }
  s += `</g>`; // close the groups list container
  return s;
}
