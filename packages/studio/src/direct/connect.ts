/**
 * Pure rules for drag-to-connect on diagram blocks (flow, dfd, state, c4,
 * block, graph, swimlane — and sequence messages): selecting a node shows
 * connector dots on its edges; dragging from a dot to another node appends an
 * edge/transition/link/message to the YAML, and dragging to empty canvas
 * creates a new node at the drop cell plus the connecting edge.
 *
 * The {@link ConnectSpec} table is ALSO the source of truth for which kinds
 * place nodes on the col/row grid (drag-to-move, arrow moves — `gridNodes`)
 * and which support dashed `groups` cell ranges (`groups`), so the drag layer
 * never grows another hard-coded kind set.
 *
 * Everything here is spec-table + op-builder math — no React, no DOM — so the
 * per-kind field mapping and the committed writes are unit-testable against
 * the core schemas. The DOM glue (dots, rubber band, shape picker) lives in
 * `useConnect.ts` / `DirectLayer.tsx`.
 */

import type { PathSet, Placement } from './drag.js';

/** One choice in the empty-canvas shape picker. */
export interface ConnectKind {
  /** The schema value written to the new node's `kind`. */
  readonly kind: string;
  /** The human label shown in the picker (also seeds "New <label>"). */
  readonly label: string;
}

/** One choice in a drop-on-target edge picker (ERD relation cardinality). */
export interface ConnectChoice {
  /** The schema value written to the new edge's {@link ConnectSpec.edgeChoiceField}. */
  readonly value: string;
  /** The human label shown in the picker. */
  readonly label: string;
}

/** How one block kind spells its nodes and edges. */
export interface ConnectSpec {
  /** The node list field (`nodes`; `states` for state; `steps`/`actors`…). */
  readonly nodesField: string;
  /** The node id field — `id` everywhere today, kept explicit for clarity. */
  readonly idField: string;
  /** The node display-text field (`label` for flow, `name` elsewhere). */
  readonly labelField: string;
  /** The edge list field (`edges`, `transitions`, `links`, `messages`). */
  readonly edgesField: string;
  /**
   * The node kinds the shape picker offers. Exactly ONE choice → no picker,
   * an empty-canvas drop creates it directly (graph nodes have no kinds).
   * Empty → empty-canvas drops just cancel (sequence).
   */
  readonly nodeKinds: readonly ConnectKind[];
  /** True when an edge may loop back onto its own node. */
  readonly allowSelfLoop: boolean;
  /** True when nodes place on the col/row grid (drag-to-move, arrow moves). */
  readonly gridNodes: boolean;
  /** True when the kind carries the shared dashed `groups` cell ranges. */
  readonly groups: boolean;
  /** Same-direction duplicate edges allowed (sequence messages repeat). */
  readonly allowDuplicateEdges?: boolean;
  /**
   * Drop targets extend from each node's box down to the SVG's bottom edge
   * (sequence: an actor's lifeline is as good a target as its header).
   */
  readonly columnTargets?: boolean;
  /**
   * The edge's human-text field (`label`; `event` for state transitions):
   * what ⏎/double-click focuses on a selected edge — the micro-editor offers
   * it even when the YAML doesn't spell the optional field yet.
   */
  readonly edgeTextField: string;
  /** Open the micro-editor on the NEW edge's text right after connecting. */
  readonly editEdgeOnConnect?: boolean;
  /**
   * False when a drag/drop may NOT grow the grid by one row (swimlane rows
   * are the `lanes` list — a new lane needs a label, not a bare index).
   */
  readonly growRows?: boolean;
  /** Fields that must all be set for a node to count as explicitly placed. */
  readonly placeFields?: readonly string[];
  /** Maps a grid cell to the node's position writes (swimlane: 0-based lane). */
  readonly writeCell?: (cell: Placement) => Readonly<Record<string, number>>;
  /**
   * When set, dropping on a target node opens a picker of these choices
   * instead of committing immediately; the chosen value is written to
   * {@link edgeChoiceField} on the new edge. ERD relations use this for
   * cardinality (1:1 / 1:N / N:1 / N:M).
   */
  readonly edgeChoices?: readonly ConnectChoice[];
  /** The edge field an {@link edgeChoices} value is written to (`card`). */
  readonly edgeChoiceField?: string;
  /** Builds the edge object appended for a from → to connection. */
  readonly newEdge: (from: string, to: string) => Record<string, unknown>;
  /** Builds the node an empty-canvas drop creates (absent → drops cancel). */
  readonly newNode?: (args: {
    id: string;
    kind: string;
    label: string;
    cell: Placement;
  }) => Record<string, unknown>;
}

const simpleEdge = (from: string, to: string): Record<string, unknown> => ({ from, to });

/** The default cell writer: literal `col`/`row` (1-based grid space). */
export function defaultWriteCell(cell: Placement): Readonly<Record<string, number>> {
  return { col: cell.col, row: cell.row };
}

/**
 * The per-kind connector table. Every field is verified against the core zod
 * schemas (strict objects): flow nodes are `{id,label,kind?,col?,row?,w?}` with
 * `{from,to}` edges; dfd/c4/block nodes carry `name`; state uses
 * `states`/`transitions` with a REQUIRED `event` (seeded empty for the user to
 * fill); c4 `kind` is required, so every picker choice writes one. The `block`
 * kind's node kinds are free-form strings — the picker offers the common
 * subset of the renderer's documented `KNOWN_NODE_KINDS`. `graph` nodes have
 * no kind at all (one picker-less choice); `swimlane` steps place by
 * `col` + 0-based `lane` and connect through `links`; `sequence` has no grid —
 * its "edges" are messages between actor columns, repeats and self-notes
 * allowed.
 */
const SPECS: Readonly<Record<string, ConnectSpec>> = {
  flow: {
    nodesField: 'nodes',
    idField: 'id',
    labelField: 'label',
    edgesField: 'edges',
    edgeTextField: 'label',
    nodeKinds: [
      { kind: 'process', label: 'Process' },
      { kind: 'decision', label: 'Decision' },
      { kind: 'start', label: 'Start' },
      { kind: 'end', label: 'End' },
    ],
    allowSelfLoop: false,
    gridNodes: true,
    groups: true,
    newEdge: simpleEdge,
    newNode: ({ id, kind, label, cell }) => ({ id, label, kind, col: cell.col, row: cell.row }),
  },
  dfd: {
    nodesField: 'nodes',
    idField: 'id',
    labelField: 'name',
    edgesField: 'edges',
    edgeTextField: 'label',
    nodeKinds: [
      { kind: 'process', label: 'Process' },
      { kind: 'external', label: 'External' },
      { kind: 'store', label: 'Store' },
    ],
    allowSelfLoop: false,
    gridNodes: true,
    groups: true,
    newEdge: simpleEdge,
    newNode: ({ id, kind, label, cell }) => ({ id, name: label, kind, col: cell.col, row: cell.row }),
  },
  state: {
    nodesField: 'states',
    idField: 'id',
    labelField: 'name',
    edgesField: 'transitions',
    edgeTextField: 'event',
    nodeKinds: [
      { kind: 'active', label: 'Active' },
      { kind: 'wait', label: 'Wait' },
      { kind: 'terminal', label: 'Terminal' },
    ],
    allowSelfLoop: true,
    gridNodes: true,
    groups: true,
    // `event` is required by the schema; seeded empty — the micro-editor
    // opens right after so the user names it immediately.
    newEdge: (from, to) => ({ from, to, event: '' }),
    newNode: ({ id, kind, label, cell }) => ({ id, name: label, kind, col: cell.col, row: cell.row }),
  },
  c4: {
    nodesField: 'nodes',
    idField: 'id',
    labelField: 'name',
    edgesField: 'edges',
    edgeTextField: 'label',
    nodeKinds: [
      { kind: 'person', label: 'Person' },
      { kind: 'system', label: 'System' },
      { kind: 'external', label: 'External' },
    ],
    allowSelfLoop: false,
    gridNodes: true,
    groups: true,
    newEdge: simpleEdge,
    // `kind` is REQUIRED on c4 nodes; `desc`/`tech` stay optional and unset.
    newNode: ({ id, kind, label, cell }) => ({ id, kind, name: label, col: cell.col, row: cell.row }),
  },
  block: {
    nodesField: 'nodes',
    idField: 'id',
    labelField: 'name',
    edgesField: 'edges',
    edgeTextField: 'label',
    nodeKinds: [
      { kind: 'service', label: 'Service' },
      { kind: 'client', label: 'Client' },
      { kind: 'db', label: 'Database' },
      { kind: 'queue', label: 'Queue' },
      { kind: 'cache', label: 'Cache' },
      { kind: 'gateway', label: 'Gateway' },
      { kind: 'external', label: 'External' },
    ],
    allowSelfLoop: false,
    gridNodes: true,
    groups: true,
    newEdge: simpleEdge,
    newNode: ({ id, kind, label, cell }) => ({ id, name: label, kind, col: cell.col, row: cell.row }),
  },
  graph: {
    nodesField: 'nodes',
    idField: 'id',
    labelField: 'label',
    edgesField: 'edges',
    edgeTextField: 'label',
    // Graph nodes have no `kind` — one choice, so drops skip the picker.
    nodeKinds: [{ kind: 'node', label: 'Node' }],
    allowSelfLoop: false,
    gridNodes: true,
    groups: false, // graph's per-node `group` int is a different concept
    newEdge: simpleEdge,
    newNode: ({ id, label, cell }) => ({ id, label, col: cell.col, row: cell.row }),
  },
  swimlane: {
    nodesField: 'steps',
    idField: 'id',
    labelField: 'label',
    edgesField: 'links',
    edgeTextField: 'label',
    nodeKinds: [
      { kind: 'action', label: 'Action' },
      { kind: 'decision', label: 'Decision' },
      { kind: 'start', label: 'Start' },
      { kind: 'end', label: 'End' },
      { kind: 'wait', label: 'Wait' },
    ],
    allowSelfLoop: false,
    gridNodes: true,
    groups: false,
    growRows: false, // rows are the `lanes` list — no drag-created lanes
    placeFields: ['col', 'lane'],
    // The grid row is 1-based; the schema's `lane` is a 0-based lane index.
    writeCell: (cell) => ({ col: cell.col, lane: cell.row - 1 }),
    newEdge: simpleEdge,
    newNode: ({ id, kind, label, cell }) => ({ id, kind, label, col: cell.col, lane: cell.row - 1 }),
  },
  sequence: {
    nodesField: 'actors',
    idField: 'id',
    labelField: 'name',
    edgesField: 'messages',
    edgeTextField: 'label',
    nodeKinds: [], // no grid, no empty-canvas creation
    allowSelfLoop: true, // a drop on the origin actor becomes a note
    gridNodes: false,
    groups: false,
    allowDuplicateEdges: true, // repeated a → b messages are the norm
    columnTargets: true, // an actor's lifeline targets like its header
    editEdgeOnConnect: true, // name the new message immediately
    newEdge: (from, to) =>
      from === to ? { from, to, kind: 'note', label: 'note' } : { from, to, label: 'message' },
  },
  erd: {
    // Entities are keyed by `name` (no `id`) and laid out by dagre — there is
    // no grid, so like sequence there's no empty-canvas node creation. Dropping
    // one entity onto another opens the cardinality picker (`edgeChoices`) and
    // appends a `relations` entry `{from, to, card}`.
    nodesField: 'entities',
    idField: 'name',
    labelField: 'name',
    edgesField: 'relations',
    edgeTextField: 'label',
    nodeKinds: [],
    allowSelfLoop: false,
    gridNodes: false,
    groups: false,
    edgeChoices: [
      { value: '1:1', label: '1:1 · one-to-one' },
      { value: '1:N', label: '1:N · one-to-many' },
      { value: 'N:1', label: 'N:1 · many-to-one' },
      { value: 'N:M', label: 'N:M · many-to-many' },
    ],
    edgeChoiceField: 'card',
    newEdge: simpleEdge,
  },
};

/** The connector spec for a block kind, or null when it has no connectors. */
export function specFor(kind: string): ConnectSpec | null {
  return SPECS[kind] ?? null;
}

/** The node index a selected `data-bp` path addresses (`nodes.3` → 3), or null. */
export function nodeIndexFromPath(spec: ConnectSpec, path: string): number | null {
  const m = new RegExp(`^${spec.nodesField}\\.(\\d+)$`).exec(path);
  return m !== null ? Number(m[1]) : null;
}

/** The edge index a selected `data-bp` path addresses (`edges.3` → 3), or null. */
export function edgeIndexFromPath(spec: ConnectSpec, path: string): number | null {
  const m = new RegExp(`^${spec.edgesField}\\.(\\d+)$`).exec(path);
  return m !== null ? Number(m[1]) : null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function listOf(data: unknown, field: string): unknown[] {
  const v = asRecord(data)?.[field];
  return Array.isArray(v) ? v : [];
}

/** The nodes of `data` as records (non-object entries filtered out). */
function nodeRecords(spec: ConnectSpec, data: unknown): Array<Record<string, unknown>> {
  return listOf(data, spec.nodesField)
    .map(asRecord)
    .filter((r): r is Record<string, unknown> => r !== null);
}

/** A node's id as a string, or null. */
function idOf(spec: ConnectSpec, node: Record<string, unknown>): string | null {
  const id = node[spec.idField];
  return typeof id === 'string' ? id : null;
}

/** A node's display text (label/name), falling back to its id. */
export function nodeLabel(spec: ConnectSpec, data: unknown, id: string): string {
  const node = nodeRecords(spec, data).find((n) => idOf(spec, n) === id);
  const label = node?.[spec.labelField];
  return typeof label === 'string' && label !== '' ? label : id;
}

/**
 * The write that connects `fromId` → `toId`: one append to the edge list
 * (committed as one applyOp → one undo step). Null when the connection is a
 * self-loop on a kind that forbids them, or a duplicate of an existing edge
 * in the same direction (the reverse direction is a different edge) on a kind
 * that forbids repeats — sequence messages repeat freely.
 */
export function edgeOp(
  spec: ConnectSpec,
  data: unknown,
  fromId: string,
  toId: string,
  extra?: Readonly<Record<string, unknown>>,
): PathSet[] | null {
  if (fromId === toId && !spec.allowSelfLoop) return null;
  const edges = listOf(data, spec.edgesField);
  if (spec.allowDuplicateEdges !== true) {
    const dup = edges.some((e) => {
      const r = asRecord(e);
      return r !== null && r['from'] === fromId && r['to'] === toId;
    });
    if (dup) return null;
  }
  const value = extra === undefined ? spec.newEdge(fromId, toId) : { ...spec.newEdge(fromId, toId), ...extra };
  return [{ path: [spec.edgesField, edges.length], value }];
}

/** `n2`, `n3`, … — the first auto id no existing node uses. */
export function uniqueNodeId(spec: ConnectSpec, data: unknown): string {
  const used = new Set(
    nodeRecords(spec, data)
      .map((n) => idOf(spec, n))
      .filter((id): id is string => id !== null),
  );
  let n = nodeRecords(spec, data).length + 1;
  let id = `n${n}`;
  while (used.has(id)) {
    n += 1;
    id = `n${n}`;
  }
  return id;
}

/**
 * The writes an empty-canvas drop commits (one applyOp → one undo step): the
 * new node at the drop cell, the edge connecting `fromId` to it, and — when
 * the diagram was auto-laid-out (some existing node lacks `col`/`row` in the
 * YAML) and the caller supplies the renderer's effective `placements` — a
 * materialization of every node's current cell first, so pinning the new node
 * doesn't reflow the rest of the diagram out from under it.
 *
 * Returns the sets plus the new node's `data-bp` path and auto id, or null
 * when `fromId` doesn't resolve or `kindChoice` isn't in the spec.
 */
export function newNodeOps(
  spec: ConnectSpec,
  data: unknown,
  fromId: string,
  cell: Placement,
  kindChoice: string,
  placements?: readonly Placement[],
): { sets: PathSet[]; nodePath: string; id: string; materialized: boolean } | null {
  const newNode = spec.newNode;
  if (newNode === undefined) return null;
  const choice = spec.nodeKinds.find((k) => k.kind === kindChoice);
  if (choice === undefined) return null;
  const nodes = nodeRecords(spec, data);
  if (!nodes.some((n) => idOf(spec, n) === fromId)) return null;

  const sets: PathSet[] = [];
  const placeFields = spec.placeFields ?? ['col', 'row'];
  const writeCell = spec.writeCell ?? defaultWriteCell;
  const allPlaced =
    nodes.length > 0 && nodes.every((n) => placeFields.every((f) => n[f] !== undefined));
  const materialized =
    !allPlaced && placements !== undefined && placements.length === nodes.length;
  if (materialized) {
    placements.forEach((p, i) => {
      for (const [field, value] of Object.entries(writeCell(p))) {
        sets.push({ path: [spec.nodesField, i, field], value });
      }
    });
  }

  const id = uniqueNodeId(spec, data);
  const label = `New ${choice.label.toLowerCase()}`;
  sets.push({
    path: [spec.nodesField, nodes.length],
    value: newNode({ id, kind: kindChoice, label, cell }),
  });
  const edges = listOf(data, spec.edgesField);
  sets.push({ path: [spec.edgesField, edges.length], value: spec.newEdge(fromId, id) });
  return { sets, nodePath: `${spec.nodesField}.${nodes.length}`, id, materialized };
}
