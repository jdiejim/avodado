/**
 * Swimlane placement — the one place that turns a `swimlane` body into cells.
 *
 * A step names its lane by label, by `id`, or by 0-based index, and may omit
 * `col`. This module resolves both so every consumer (`chiltepin-render`, the
 * Studio canvas, `chiltepin check`) sees the same grid:
 *
 * - `resolveSwimlaneLane` — the lane index a `lane` value names, or
 *   `undefined` when nothing matches (validation reports that as
 *   `E_SWIMLANE_LANE`; a renderer falls back to lane 0 so the step stays
 *   visible).
 * - `swimlaneColumns` — one column per step. When every step carries `col`
 *   the columns are exactly those. Otherwise a step's column is its
 *   longest-path rank through `links`: `1 + max(col of its predecessors)`,
 *   an explicit `col` acting as a floor; steps with no links go after the
 *   last linked column, one column each in author order; two steps that
 *   land on the same cell are pushed right so nothing overlaps.
 *
 * Pure: data in, numbers out. No I/O, no DOM.
 */

/** The fields the layout reads from a step. */
export interface SwimlaneStepInput {
  readonly id: string;
  readonly col?: number | undefined;
  readonly lane: number | string;
}

/** The fields the layout reads from a lane. */
export interface SwimlaneLaneInput {
  readonly id?: string | undefined;
  readonly label: string;
}

/** The fields the layout reads from a link. */
export interface SwimlaneLinkInput {
  readonly from: string;
  readonly to: string;
}

/** A step's effective cell: 1-based column, 0-based lane index. */
export interface SwimlanePlacement {
  readonly col: number;
  readonly lane: number;
}

/** A lane name compared the way an author types it: trimmed, case-folded. */
const fold = (s: string): string => s.trim().toLowerCase();

/**
 * The 0-based index of the lane `ref` names — a number is taken as the index
 * (when it exists), a string matches a lane's `label` or `id`
 * (case-insensitive, trimmed). `undefined` when nothing matches.
 */
export function resolveSwimlaneLane(
  ref: number | string,
  lanes: ReadonlyArray<SwimlaneLaneInput>,
): number | undefined {
  if (typeof ref === 'number') {
    return Number.isInteger(ref) && ref >= 0 && ref < lanes.length ? ref : undefined;
  }
  const want = fold(ref);
  if (want.length === 0) return undefined;
  const byId = lanes.findIndex((l) => l.id !== undefined && fold(l.id) === want);
  if (byId >= 0) return byId;
  const byLabel = lanes.findIndex((l) => fold(l.label) === want);
  return byLabel >= 0 ? byLabel : undefined;
}

/**
 * One 1-based column per step, in step order. Explicit columns are kept when
 * every step has one; otherwise columns are derived from `links` (see the
 * module note for the rule).
 */
export function swimlaneColumns(
  steps: ReadonlyArray<SwimlaneStepInput>,
  links: ReadonlyArray<SwimlaneLinkInput>,
): number[] {
  if (steps.every((s) => s.col !== undefined)) return steps.map((s) => s.col as number);

  const index = new Map<string, number>();
  steps.forEach((s, i) => {
    if (!index.has(s.id)) index.set(s.id, i);
  });
  const succs = steps.map((): number[] => []);
  const linked = new Set<number>();
  for (const l of links) {
    const a = index.get(l.from);
    const b = index.get(l.to);
    if (a === undefined || b === undefined || a === b) continue;
    (succs[a] as number[]).push(b);
    linked.add(a);
    linked.add(b);
  }

  // One depth-first pass in author order gives a topological order and drops
  // the links that close a loop (a link back onto the current path), so a
  // cycle cuts at the author's first step, not somewhere in the middle.
  const visited = new Set<number>();
  const onPath = new Set<number>();
  const order: number[] = []; // post-order; reversed below
  const kept = steps.map((): number[] => []);
  const walk = (u: number): void => {
    visited.add(u);
    onPath.add(u);
    for (const v of succs[u] as number[]) {
      if (onPath.has(v)) continue; // back edge
      (kept[u] as number[]).push(v);
      if (!visited.has(v)) walk(v);
    }
    onPath.delete(u);
    order.push(u);
  };
  steps.forEach((_, i) => {
    if (linked.has(i) && !visited.has(i)) walk(i);
  });

  // Longest path in topological order: a step sits one column after the
  // furthest of its predecessors, and never left of the `col` it carries.
  const rank = steps.map((s, i) => (linked.has(i) ? Math.max(1, s.col ?? 1) : 0));
  for (const u of order.reverse()) {
    for (const v of kept[u] as number[]) {
      rank[v] = Math.max(rank[v] as number, (rank[u] as number) + 1);
    }
  }
  const lastLinked = Math.max(0, ...rank);

  // Unlinked steps follow the linked ones, one column each, in author order.
  let next = lastLinked;
  steps.forEach((s, i) => {
    if (linked.has(i)) return;
    next = Math.max(next + 1, s.col ?? 0);
    rank[i] = next;
  });

  return rank;
}

/**
 * Every step's effective cell, in step order. Unknown lanes fall back to
 * lane 0 (validation has already named them); overlapping cells are pushed
 * right, later step first, so two steps never share a cell.
 */
export function swimlanePlacements(data: {
  readonly lanes?: ReadonlyArray<SwimlaneLaneInput> | undefined;
  readonly steps?: ReadonlyArray<SwimlaneStepInput> | undefined;
  readonly links?: ReadonlyArray<SwimlaneLinkInput> | undefined;
}): { readonly placements: SwimlanePlacement[]; readonly derived: boolean } {
  const lanes = data.lanes ?? [];
  const steps = data.steps ?? [];
  const links = data.links ?? [];
  const derived = steps.some((s) => s.col === undefined);
  const cols = swimlaneColumns(steps, links);
  const taken = new Set<string>();
  const placements = steps.map((s, i) => {
    const lane = resolveSwimlaneLane(s.lane, lanes) ?? 0;
    let col = cols[i] ?? 1;
    if (derived) {
      while (taken.has(`${col}:${lane}`)) col += 1;
    }
    taken.add(`${col}:${lane}`);
    return { col, lane };
  });
  return { placements, derived };
}
