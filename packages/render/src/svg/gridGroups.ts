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
  /** The `id` of the group this one nests inside (region → zone → subnet). */
  readonly parent?: string | undefined;
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

/** How far a nested panel steps in from its container, per level. */
interface Inset {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/**
 * Declared nesting: the gap between one level's border and the next — 8px
 * at the sides and bottom, 18px above so a parent's tab band stays clear of
 * the child's panel. A child steps IN by half of it and its parent grows OUT
 * by the other half, so the deepest group keeps the standard panel and the
 * ancestors wrap around it.
 */
const STEP_IN: Inset = { x: 4, y: 8, w: 8, h: 12 };
const GROW_OUT: Inset = { x: 4, y: 10, w: 8, h: 14 };

interface Nest {
  readonly depth: number;
  readonly inset: Inset;
  readonly declared: boolean;
  /** Levels of declared descendants below this group (a leaf is 0). */
  readonly height: number;
}

/**
 * Nesting per group. Two sources, resolved per group:
 *
 * - **Declared** (`parent: id`): depth = the parent's depth + 1, inset = the
 *   parent's inset + {@link STEP_IN}; every ancestor then grows by
 *   {@link GROW_OUT} per level beneath it. Parents draw first; the tab of
 *   each level alternates left / right so three levels never collide.
 * - **Geometric** (no `parent`): the legacy rule — depth = how many strictly
 *   bigger groups contain this one, inset 12/11px per level, tab top-right.
 *   Documents without `parent` render exactly as before.
 */
function resolveNesting(groups: readonly GridGroup[]): Map<GridGroup, Nest> {
  const byId = new Map<string, GridGroup>();
  for (const g of groups) if (g.id !== undefined && !byId.has(g.id)) byId.set(g.id, g);
  const parentOf = (g: GridGroup): GridGroup | undefined => {
    const p = g.parent !== undefined ? byId.get(g.parent) : undefined;
    return p === g ? undefined : p;
  };
  const base = new Map<GridGroup, { depth: number; inset: Inset; declared: boolean }>();
  const geometric = (g: GridGroup): { depth: number; inset: Inset; declared: boolean } => {
    const depth = groups.filter((o) => containedBy(g, o)).length;
    return { depth, inset: { x: depth * 12, y: depth * 11, w: depth * 24, h: depth * 17 }, declared: false };
  };
  const resolve = (g: GridGroup, seen: ReadonlySet<GridGroup>): { depth: number; inset: Inset; declared: boolean } => {
    const cached = base.get(g);
    if (cached !== undefined) return cached;
    const p = parentOf(g);
    let res: { depth: number; inset: Inset; declared: boolean };
    if (p === undefined || seen.has(p)) {
      res = geometric(g);
    } else {
      const pr = resolve(p, new Set([...seen, g]));
      res = {
        depth: pr.depth + 1,
        inset: { x: pr.inset.x + STEP_IN.x, y: pr.inset.y + STEP_IN.y, w: pr.inset.w + STEP_IN.w, h: pr.inset.h + STEP_IN.h },
        declared: true,
      };
    }
    base.set(g, res);
    return res;
  };
  for (const g of groups) resolve(g, new Set());

  // Height: the longest declared chain beneath each group (cycle-guarded).
  const children = new Map<GridGroup, GridGroup[]>();
  for (const g of groups) {
    const p = parentOf(g);
    if (p !== undefined && base.get(g)?.declared === true) children.set(p, [...(children.get(p) ?? []), g]);
  }
  const heights = new Map<GridGroup, number>();
  const heightOf = (g: GridGroup, seen: ReadonlySet<GridGroup>): number => {
    const cached = heights.get(g);
    if (cached !== undefined) return cached;
    const kids = (children.get(g) ?? []).filter((k) => !seen.has(k));
    const h = kids.length === 0 ? 0 : 1 + Math.max(...kids.map((k) => heightOf(k, new Set([...seen, g]))));
    heights.set(g, h);
    return h;
  };

  const out = new Map<GridGroup, Nest>();
  for (const g of groups) {
    const b = base.get(g) ?? geometric(g);
    const h = heightOf(g, new Set());
    out.set(g, {
      ...b,
      height: h,
      // `inset` is what the panel loses from the raw rect, so growth subtracts.
      inset: { x: b.inset.x - GROW_OUT.x * h, y: b.inset.y - GROW_OUT.y * h, w: b.inset.w - GROW_OUT.w * h, h: b.inset.h - GROW_OUT.h * h },
    });
  }
  return out;
}

/**
 * The extra padding a diagram needs around its grid when groups nest by
 * declaration: the outermost ancestors grow past the standard group rect by
 * {@link GROW_OUT} per level beneath them. Zero for every other document.
 */
export function nestingPads(groups: readonly GridGroup[]): { padX: number; padTop: number; padBot: number } {
  if (!groups.some((g) => g.parent !== undefined)) return { padX: 0, padTop: 0, padBot: 0 };
  const h = Math.max(0, ...[...resolveNesting(groups).values()].map((n) => n.height));
  return { padX: GROW_OUT.x * h, padTop: GROW_OUT.y * h, padBot: (GROW_OUT.h - GROW_OUT.y) * h };
}

/**
 * Renders the `<g data-bl="groups">…</g>` layer: one dashed outline + corner
 * label per group (`data-bp="groups.N"`), largest groups first so smaller
 * ones layer on top, nested groups inset by containment depth with their
 * label anchored top-RIGHT so it never sits on the container's label.
 * Declared nesting (`parent`) draws parents first and steps each child in
 * 8px with its own `.t-eyebrow` tab (see {@link resolveNesting}).
 */
export function gridGroupsSvg(groups: readonly GridGroup[], geo: GridGroupGeom): string {
  const groupRect = (g: GridGroup): { x: number; y: number; w: number; h: number } => ({
    x: geo.xOf(g.col) - 28,
    y: geo.yOf(g.row) - 38,
    w: (g.cols ?? 1) * geo.cellW + ((g.cols ?? 1) - 1) * geo.gapX + 56,
    h: (g.rows ?? 1) * geo.cellH + ((g.rows ?? 1) - 1) * geo.gapY + 66,
  });

  const nesting = resolveNesting(groups);
  const declared = groups.some((g) => g.parent !== undefined);
  const area = (g: GridGroup): number => (g.cols ?? 1) * (g.rows ?? 1);
  // Largest groups first so smaller ones layer on top (index kept for paths).
  // With declared nesting, parents first (shallowest depth), then by area.
  const sortedGroups = groups
    .map((g, gi) => ({ g, gi }))
    .sort((a, b) =>
      declared
        ? (nesting.get(a.g)?.depth ?? 0) - (nesting.get(b.g)?.depth ?? 0) || area(b.g) - area(a.g) || a.gi - b.gi
        : area(b.g) - area(a.g),
    );

  let s = `<g${bl('groups')}>`;
  for (const { g, gi } of sortedGroups) {
    const raw = groupRect(g);
    const col = safeColor(g.color, 'var(--slate)');
    // Nested zones inset by containment depth so a subnet's border never sits
    // on top of its VPC's border — the containing area reads clearly.
    const nest = nesting.get(g) ?? { depth: 0, inset: { x: 0, y: 0, w: 0, h: 0 }, declared: false, height: 0 };
    const depth = nest.depth;
    const r = {
      x: raw.x + nest.inset.x,
      y: raw.y + nest.inset.y,
      w: raw.w - nest.inset.w,
      h: raw.h - nest.inset.h,
    };
    // Geometric nesting anchors the tab right; declared nesting alternates by
    // level, so a subnet's tab sits under its region's, not on its zone's.
    const nested = nest.declared ? depth % 2 === 1 : depth > 0;
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
