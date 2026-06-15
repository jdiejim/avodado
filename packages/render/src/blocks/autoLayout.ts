/**
 * Auto-layout for the coordinate-grid diagram blocks (flow, c4, state, dfd, uml).
 *
 * These renderers place nodes on an integer `col`/`row` grid. When an author
 * supplies coordinates we honour them exactly; when any are missing we derive a
 * clean layered grid from the edges using dagre (pure JS, no DOM) — ranks become
 * one axis, order-within-rank the other — so you can declare just nodes + edges
 * and still get a sensible diagram. The downstream renderers are unchanged.
 */

import dagre from '@dagrejs/dagre';

interface HasGrid {
  readonly id: string;
  readonly col?: number | undefined;
  readonly row?: number | undefined;
}

interface Edge {
  readonly from: string;
  readonly to: string;
}

/**
 * Returns the items with `col`/`row` guaranteed. If every item already has both,
 * they're used verbatim; otherwise all are placed by {@link autoGrid}.
 */
export function ensureGrid<T extends HasGrid>(
  items: readonly T[],
  edges: readonly Edge[],
  rankdir: 'TB' | 'LR',
): Array<T & { col: number; row: number }> {
  const allPlaced =
    items.length > 0 && items.every((n) => n.col !== undefined && n.row !== undefined);
  if (allPlaced) {
    return items.map((n) => ({ ...n, col: n.col as number, row: n.row as number }));
  }
  const grid = autoGrid(
    items.map((n) => n.id),
    edges,
    rankdir,
  );
  return items.map((n) => {
    const g = grid.get(n.id) ?? { col: 1, row: 1 };
    return { ...n, col: g.col, row: g.row };
  });
}

/**
 * Lays out a directed graph with dagre using uniform node sizes (we only want
 * topology, not pixels), then snaps the result to an integer grid: for `TB`,
 * each distinct rank is a row and nodes are ordered into columns within it; for
 * `LR`, the axes swap.
 */
function autoGrid(
  ids: readonly string[],
  edges: readonly Edge[],
  rankdir: 'TB' | 'LR',
): Map<string, { col: number; row: number }> {
  const idSet = new Set(ids);
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir, nodesep: 16, ranksep: 16, marginx: 0, marginy: 0 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const id of ids) g.setNode(id, { width: 10, height: 10 });
  for (const e of edges) {
    if (e.from !== e.to && idSet.has(e.from) && idSet.has(e.to)) g.setEdge(e.from, e.to);
  }
  dagre.layout(g);

  const pos = ids.map((id) => {
    const n = g.node(id) as { x?: number; y?: number } | undefined;
    return { id, x: Math.round(n?.x ?? 0), y: Math.round(n?.y ?? 0) };
  });

  const out = new Map<string, { col: number; row: number }>();
  // Group by the rank axis (same-rank nodes share a coordinate because all node
  // sizes are equal), then order within the rank along the other axis.
  if (rankdir === 'TB') {
    const ranks = [...new Set(pos.map((p) => p.y))].sort((a, b) => a - b);
    ranks.forEach((yv, ri) => {
      pos
        .filter((p) => p.y === yv)
        .sort((a, b) => a.x - b.x)
        .forEach((p, ci) => out.set(p.id, { col: ci + 1, row: ri + 1 }));
    });
  } else {
    const ranks = [...new Set(pos.map((p) => p.x))].sort((a, b) => a - b);
    ranks.forEach((xv, ci) => {
      pos
        .filter((p) => p.x === xv)
        .sort((a, b) => a.y - b.y)
        .forEach((p, ri) => out.set(p.id, { col: ci + 1, row: ri + 1 }));
    });
  }
  return out;
}
