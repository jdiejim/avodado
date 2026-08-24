/**
 * `lintDensity` — per-type complexity budgets over a parsed document.
 *
 * Pure analysis, no I/O: takes a {@link Document}, returns {@link Diagnostic}s
 * (always level `warn`, code `W_DENSE_BLOCK`; the CLI never escalates them).
 * A diagram past its budget reads worse than two focused diagrams — the
 * warning names the count, the cap, and a concrete way to split.
 *
 * Deliberately conservative: only array counts, no heuristics. A block at
 * exactly the cap is fine; strictly greater warns. Counting is defensive —
 * a missing or malformed array counts as 0 and never throws. Schema errors
 * belong to `validateDocument`, not here.
 */

import type { Diagnostic } from './diagnostics.js';
import type { BlockType, Document, Segment } from './types.js';
import { locateYamlPath } from './yaml.js';

/** One budget: an array field, its cap, and how to split past it. */
export interface DensityBudget {
  /** Top-level array field that is counted (e.g. `messages`). */
  readonly field: string;
  /** Highest count that passes. Strictly greater warns. */
  readonly cap: number;
  /** Plural noun for messages (e.g. `messages`, `entities`). */
  readonly unit: string;
  /** One STE sentence: the concrete split move for this block type. */
  readonly split: string;
}

/**
 * The per-type complexity budgets, keyed by block type.
 *
 * Types without an entry have no budget. `sequence` carries two budgets
 * (actors and messages); each is checked on its own.
 */
export const DENSITY_BUDGETS: Partial<Record<BlockType, readonly DensityBudget[]>> = {
  sequence: [
    { field: 'actors', cap: 8, unit: 'actors', split: 'Split the flow into one sequence per scenario.' },
    { field: 'messages', cap: 24, unit: 'messages', split: 'Split the flow into one sequence per scenario.' },
  ],
  flow: [{ field: 'nodes', cap: 24, unit: 'nodes', split: 'Split the flow into one diagram per phase.' }],
  dfd: [{ field: 'nodes', cap: 24, unit: 'nodes', split: 'Split the diagram into one dfd per process.' }],
  state: [{ field: 'states', cap: 16, unit: 'states', split: 'Split the machine into one diagram per lifecycle phase.' }],
  c4: [{ field: 'nodes', cap: 20, unit: 'nodes', split: 'Zoom one level: draw one c4 diagram per container.' }],
  block: [{ field: 'nodes', cap: 20, unit: 'nodes', split: 'Split the diagram by layer or by domain.' }],
  felogic: [{ field: 'nodes', cap: 20, unit: 'nodes', split: 'Split the logic into one diagram per feature.' }],
  frontend: [{ field: 'nodes', cap: 20, unit: 'nodes', split: 'Split the tree into one diagram per page.' }],
  erd: [{ field: 'entities', cap: 12, unit: 'entities', split: 'Split the model by domain.' }],
  tree: [{ field: 'nodes', cap: 40, unit: 'nodes', split: 'Split the tree into one block per top branch.' }],
  graph: [{ field: 'nodes', cap: 30, unit: 'nodes', split: 'Split the graph into one block per cluster.' }],
  cluster: [{ field: 'services', cap: 16, unit: 'services', split: 'Draw one diagram per cluster.' }],
  archmap: [{ field: 'areas', cap: 8, unit: 'areas', split: 'Split the map into one archmap per domain.' }],
  kanban: [{ field: 'columns', cap: 8, unit: 'columns', split: 'Merge related columns, or split the board by team.' }],
  timeline: [{ field: 'items', cap: 20, unit: 'items', split: 'Split the timeline into one block per phase.' }],
  journey: [{ field: 'stages', cap: 10, unit: 'stages', split: 'Split the journey into one block per persona.' }],
  storymap: [{ field: 'backbone', cap: 10, unit: 'steps', split: 'Split the map into one storymap per journey phase.' }],
  slopegraph: [{ field: 'items', cap: 20, unit: 'items', split: 'Keep the items that move, or split the list into one slopegraph per group.' }],
};

/** Length of `data[field]` when it is an array; 0 for anything else. */
function countArray(data: unknown, field: string): number {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return 0;
  const value = (data as Record<string, unknown>)[field];
  return Array.isArray(value) ? value.length : 0;
}

/**
 * Checks every typed block against its type's complexity budget. Returns
 * `W_DENSE_BLOCK` warnings — never errors, never throws on odd data.
 *
 * @param doc - The parsed document (same input as `validateDocument`).
 * @param file - The file path to use in diagnostics.
 */
export function lintDensity(doc: Document, file: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const seg of doc.segments as readonly Segment[]) {
    if (seg.kind === 'markdown') continue;
    if (seg.parseError !== undefined) continue;
    const budgets = DENSITY_BUDGETS[seg.kind];
    if (budgets === undefined) continue;

    for (const budget of budgets) {
      const count = countArray(seg.data, budget.field);
      if (count <= budget.cap) continue;

      const loc = locateYamlPath(seg.raw, [budget.field]);
      const name = seg.id !== undefined ? `'${seg.id}'` : `at line ${seg.line}`;
      diagnostics.push({
        file,
        line: loc !== undefined ? seg.line + loc.line : seg.line,
        ...(loc !== undefined ? { column: loc.column } : {}),
        level: 'warn',
        code: 'W_DENSE_BLOCK',
        message: `Dense ${seg.kind} block ${name}: ${count} ${budget.unit}. The budget is ${budget.cap}.`,
        hint: `${budget.split} Two focused diagrams read better than one dense diagram.`,
        value: `${count} ${budget.unit}`,
      });
    }
  }

  return diagnostics;
}
