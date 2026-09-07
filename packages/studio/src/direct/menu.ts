/**
 * Pure rules for the diagram CONTEXT MENU — what a right-click (or ⇧F10 /
 * the Menu key) on a rendered part offers, and the YAML writes each choice
 * commits. The menu is a second entry point to the SAME ops the drag /
 * connect / marquee layers already emit ({@link edgeOp}, {@link newNodeOps},
 * {@link groupOps}, …): it never grows its own YAML-writing logic, only the
 * choice of WHERE (a free cell in a direction) and WHAT (a kind, a toggle).
 *
 * - {@link targetFor} maps the right-clicked `data-bp` path (plus the grid
 *   cell under the pointer, when off every part) to a {@link MenuTarget};
 * - {@link menuFor} builds the item tree for that target from the block data
 *   and the renderer's effective grid ({@link MenuCtx});
 * - every item's `op()` yields ops that are HOMOGENEOUS — all `set`s (one
 *   `commitPaths`, one undo step) or exactly one `remove` (one `deletePath`)
 *   — so the DOM glue never has to compose two commits.
 *
 * No React, no DOM. The glue (positioning, keyboard, connect mode, the
 * micro-editor hand-off) lives in `ContextMenu.tsx` / `DirectLayer.tsx`.
 */

import { SEQUENCE_FRAME_KINDS } from '@avodado/core';
import {
  edgeIndexFromPath,
  newNodeAtOps,
  newNodeOps,
  nodeIndexFromPath,
  specFor,
  type ConnectKind,
  type ConnectSpec,
} from './connect.js';
import { applyReorder, REORDER_LISTS, type Placement } from './drag.js';
import { isSequenceMessage } from './duals.js';
import { groupIndexFromPath, groupOps, groupRangeAt, type CellRange } from './groupMarquee.js';
import type { PathSeg } from './paths.js';
import { blankListItem, withUniqueId } from './seedItem.js';

/* ─── ops ─────────────────────────────────────────────────────────────────── */

/** One YAML write: set `path` to `value`, or remove the node at `path`. */
export type Op =
  | { readonly path: ReadonlyArray<PathSeg>; readonly value: unknown; readonly remove?: undefined }
  | { readonly path: ReadonlyArray<PathSeg>; readonly remove: true; readonly value?: undefined };

/** True for the `remove` form of an {@link Op}. */
export function isRemoveOp(op: Op): op is { path: ReadonlyArray<PathSeg>; remove: true } {
  return op.remove === true;
}

/* ─── targets ─────────────────────────────────────────────────────────────── */

/** What was right-clicked, resolved from the DOM's `data-bp` / grid attrs. */
export type MenuTarget =
  | { readonly type: 'node'; readonly index: number }
  | { readonly type: 'edge'; readonly index: number }
  | { readonly type: 'group'; readonly index: number }
  | { readonly type: 'cell'; readonly col: number; readonly row: number }
  | { readonly type: 'actor'; readonly index: number }
  | { readonly type: 'message'; readonly index: number }
  | { readonly type: 'entity'; readonly index: number }
  | { readonly type: 'column'; readonly entity: number; readonly index: number }
  /** One item of a list-ordered block (glossary term, saga step, stat…). */
  | { readonly type: 'item'; readonly index: number }
  | { readonly type: 'background' };

/**
 * Resolves the right-clicked part. `path` is the nearest `data-bp` (null off
 * every part); `cell` is the grid cell under the pointer when the click
 * landed inside a grid SVG. A leaf inside a node (`states.2.name`) counts as
 * the node; an unknown path falls back to the block background.
 */
export function targetFor(
  kind: string,
  path: string | null,
  cell: Placement | null = null,
): MenuTarget {
  if (kind === 'sequence' && path !== null) {
    let m = /^actors\.(\d+)(?:\..+)?$/.exec(path);
    if (m !== null) return { type: 'actor', index: Number(m[1]) };
    m = /^messages\.(\d+)(?:\..+)?$/.exec(path);
    if (m !== null) return { type: 'message', index: Number(m[1]) };
    return { type: 'background' };
  }
  if (kind === 'erd' && path !== null) {
    let m = /^entities\.(\d+)\.columns\.(\d+)(?:\..+)?$/.exec(path);
    if (m !== null) return { type: 'column', entity: Number(m[1]), index: Number(m[2]) };
    m = /^entities\.(\d+)(?:\..+)?$/.exec(path);
    if (m !== null) return { type: 'entity', index: Number(m[1]) };
    m = /^relations\.(\d+)(?:\..+)?$/.exec(path);
    if (m !== null) return { type: 'edge', index: Number(m[1]) };
    return { type: 'background' };
  }
  const listField = REORDER_LISTS[kind];
  if (listField !== undefined) {
    if (path === null) return { type: 'background' };
    const m = new RegExp(`^${listField}\\.(\\d+)(?:\\..+)?$`).exec(path);
    return m !== null ? { type: 'item', index: Number(m[1]) } : { type: 'background' };
  }
  const spec = specFor(kind);
  if (spec !== null && path !== null) {
    const ni = nodeIndexFromPath(spec, path) ?? nodeIndexFromPath(spec, path.replace(/^((?:[^.]+)\.\d+)\..+$/, '$1'));
    if (ni !== null) return { type: 'node', index: ni };
    const ei = edgeIndexFromPath(spec, path) ?? edgeIndexFromPath(spec, path.replace(/^((?:[^.]+)\.\d+)\..+$/, '$1'));
    if (ei !== null) return { type: 'edge', index: ei };
    if (spec.groups) {
      const gi = groupIndexFromPath(path);
      if (gi !== null) return { type: 'group', index: gi };
    }
    return { type: 'background' };
  }
  if (path === null && cell !== null && spec !== null && spec.gridNodes) {
    return { type: 'cell', col: cell.col, row: cell.row };
  }
  return { type: 'background' };
}

/* ─── items ───────────────────────────────────────────────────────────────── */

/** A non-op choice the layer carries out (editor focus, connect mode…). */
export type MenuAction =
  /** Open the micro-editor on `path`, focused on `field`. */
  | { readonly type: 'edit'; readonly path: string; readonly field: string }
  /** Enter click-to-connect mode from node `fromIndex` (next click completes). */
  | { readonly type: 'connect'; readonly fromIndex: number }
  /** Open the block's full editor (YAML tab). */
  | { readonly type: 'openYaml' };

/** One menu entry. Leaves carry an `op` or an `action`; branches `children`. */
export interface MenuItem {
  readonly label: string;
  readonly shortcut?: string;
  readonly disabled?: boolean;
  readonly danger?: boolean;
  /** Toggle / radio state, rendered as a checkmark. */
  readonly checked?: boolean;
  /** A visual divider (label ignored). */
  readonly separator?: boolean;
  readonly children?: readonly MenuItem[];
  /** The writes this choice commits (see the module note on homogeneity). */
  readonly op?: () => Op[];
  readonly action?: MenuAction;
  /** After the op commits: select this part, optionally editing `field`. */
  readonly then?: { readonly select: string; readonly edit?: string };
  /** Parts that vanish — the layer fades them out before committing. */
  readonly fades?: readonly string[];
}

/** What the layer knows about the rendered block when the menu opens. */
export interface MenuCtx {
  readonly kind: string;
  readonly data: unknown;
  /** Effective cells of every node (renderer `data-col`/`data-row`), or null off-grid. */
  readonly placements: readonly Placement[] | null;
  /** The grid's extent (`data-cols`/`data-rows`), or null off-grid. */
  readonly grid: { readonly cols: number; readonly rows: number } | null;
  /** True when the renderer auto-laid the diagram out (`data-grid-auto`). */
  readonly quick: boolean;
  /** The selected part's path (a range wrap on sequences spans to it). */
  readonly selected: string | null;
}

const SEP: MenuItem = { label: '', separator: true };

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function listOf(data: unknown, field: string): unknown[] {
  const v = asRecord(data)?.[field];
  return Array.isArray(v) ? v : [];
}

function records(data: unknown, field: string): Array<Record<string, unknown>> {
  return listOf(data, field).map((x) => asRecord(x) ?? {});
}

/** `{...rec}` with `key` set, or with `key` dropped when `value` is undefined. */
function withKey(
  rec: Record<string, unknown>,
  key: string,
  value: unknown,
): Record<string, unknown> {
  const out = { ...rec };
  if (value === undefined) delete out[key];
  else out[key] = value;
  return out;
}

/** "process" → "Process"; "1:N" stays. */
function titleCase(s: string): string {
  return s.length > 0 && /^[a-z]/.test(s) ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/* ─── grid occupancy ──────────────────────────────────────────────────────── */

/** A direction an `Add node` item grows the diagram in. */
export type Dir = 'right' | 'down' | 'left' | 'up';

export const DIRS: ReadonlyArray<{ readonly dir: Dir; readonly arrow: string }> = [
  { dir: 'right', arrow: '→' },
  { dir: 'down', arrow: '↓' },
  { dir: 'left', arrow: '←' },
  { dir: 'up', arrow: '↑' },
];

/** The cells (with spans) the nodes occupy, from the effective placements. */
function occupancy(ctx: MenuCtx, spec: ConnectSpec): Array<Placement & { w: number }> {
  if (ctx.placements === null) return [];
  const nodes = records(ctx.data, spec.nodesField);
  return ctx.placements.map((p, i) => {
    const w = nodes[i]?.['w'];
    return { col: p.col, row: p.row, w: typeof w === 'number' && w >= 1 ? Math.floor(w) : 1 };
  });
}

function isOccupied(cells: ReadonlyArray<Placement & { w: number }>, col: number, row: number): boolean {
  return cells.some((c) => c.row === row && col >= c.col && col < c.col + c.w);
}

/**
 * The nearest free cell from node `index` in `dir`: the first empty cell
 * stepping outward, allowed to grow the grid by one col/row (never past
 * that; never below 1; never a new row when the spec forbids it). Null when
 * every cell up to the growth limit is taken.
 */
export function freeCellFrom(
  ctx: MenuCtx,
  spec: ConnectSpec,
  index: number,
  dir: Dir,
): Placement | null {
  if (ctx.placements === null || ctx.grid === null) return null;
  const cells = occupancy(ctx, spec);
  const me = cells[index];
  if (me === undefined) return null;
  const maxCol = ctx.grid.cols + 1;
  const maxRow = spec.growRows === false ? ctx.grid.rows : ctx.grid.rows + 1;
  let col = me.col;
  let row = me.row;
  const step = (): void => {
    if (dir === 'right') col += 1;
    else if (dir === 'left') col -= 1;
    else if (dir === 'down') row += 1;
    else row -= 1;
  };
  if (dir === 'right') col = me.col + me.w;
  else step();
  while (col >= 1 && row >= 1 && col <= maxCol && row <= maxRow) {
    if (!isOccupied(cells, col, row)) return { col, row };
    step();
  }
  return null;
}

/** The first free cell scanning row-major, growing a column when full. */
export function firstFreeCell(ctx: MenuCtx, spec: ConnectSpec): Placement {
  if (ctx.grid === null) return { col: 1, row: 1 };
  const cells = occupancy(ctx, spec);
  for (let row = 1; row <= ctx.grid.rows; row++) {
    for (let col = 1; col <= ctx.grid.cols; col++) {
      if (!isOccupied(cells, col, row)) return { col, row };
    }
  }
  return { col: ctx.grid.cols + 1, row: 1 };
}

/** The first free cell inside a group's range, or null when it is full. */
function freeCellInRange(
  ctx: MenuCtx,
  spec: ConnectSpec,
  range: CellRange,
  except: number,
): Placement | null {
  const cells = occupancy(ctx, spec).filter((_, i) => i !== except);
  for (let row = range.row; row < range.row + range.rows; row++) {
    for (let col = range.col; col < range.col + range.cols; col++) {
      if (!isOccupied(cells, col, row)) return { col, row };
    }
  }
  return null;
}

function inRange(p: Placement, r: CellRange): boolean {
  return p.col >= r.col && p.col < r.col + r.cols && p.row >= r.row && p.row < r.row + r.rows;
}

/** The writes that move node `index` to `cell` (materializing on a quick grid). */
function moveNodeOps(ctx: MenuCtx, spec: ConnectSpec, index: number, cell: Placement): Op[] {
  const writeCell = spec.writeCell ?? ((p: Placement): Record<string, number> => ({ col: p.col, row: p.row }));
  const ops: Op[] = [];
  if (ctx.quick && ctx.placements !== null) {
    ctx.placements.forEach((p, i) => {
      if (i === index) return;
      for (const [k, v] of Object.entries(writeCell(p))) ops.push({ path: [spec.nodesField, i, k], value: v });
    });
  }
  for (const [k, v] of Object.entries(writeCell(cell))) ops.push({ path: [spec.nodesField, index, k], value: v });
  return ops;
}

/* ─── kinds ───────────────────────────────────────────────────────────────── */

/**
 * The node kinds the `Change kind ▸` / `Insert node ▸` submenus offer: the
 * spec's documented subset PLUS every kind the block already uses (free-form
 * kinds — a k8s block's `ingress`/`pod` — stay reachable).
 */
export function nodeKindChoices(ctx: MenuCtx, spec: ConnectSpec): ConnectKind[] {
  const out = [...spec.nodeKinds];
  const seen = new Set(out.map((k) => k.kind));
  for (const n of records(ctx.data, spec.nodesField)) {
    const k = n['kind'];
    if (typeof k === 'string' && k !== '' && !seen.has(k)) {
      seen.add(k);
      out.push({ kind: k, label: titleCase(k) });
    }
  }
  return out;
}

/* ─── the menu per target ─────────────────────────────────────────────────── */

/** Builds the menu for `target` — an empty list means "no menu". */
export function menuFor(target: MenuTarget, ctx: MenuCtx): MenuItem[] {
  if (ctx.kind === 'sequence') return sequenceMenu(target, ctx);
  if (ctx.kind === 'erd') return erdMenu(target, ctx);
  const listField = REORDER_LISTS[ctx.kind];
  if (listField !== undefined) return listMenu(target, ctx, listField);
  const spec = specFor(ctx.kind);
  if (spec === null) return target.type === 'background' ? [openYaml()] : [];
  switch (target.type) {
    case 'node':
      return nodeMenu(target.index, ctx, spec);
    case 'edge':
      return edgeMenu(target.index, ctx, spec);
    case 'group':
      return groupMenu(target.index, ctx);
    case 'cell':
      return cellMenu(target, ctx, spec);
    default:
      return backgroundMenu(ctx, spec);
  }
}

function openYaml(): MenuItem {
  return { label: 'Open YAML', shortcut: '⏎', action: { type: 'openYaml' } };
}

function dirItem(ctx: MenuCtx): MenuItem | null {
  if (!DIR_KINDS.has(ctx.kind)) return null;
  const cur = asRecord(ctx.data)?.['dir'];
  const current = cur === 'TB' ? 'TB' : 'LR';
  return {
    label: 'Direction',
    children: (['LR', 'TB'] as const).map((d) => ({
      label: d === 'LR' ? 'Left → right' : 'Top → bottom',
      checked: current === d,
      op: () => [{ path: ['dir'], value: d }],
    })),
  };
}

/** Kinds whose schema carries the shared `dir: LR | TB` auto-layout field. */
const DIR_KINDS = new Set(['flow', 'dfd', 'state', 'c4', 'block', 'felogic', 'erd']);

/* ---- grid family: node ---- */

function nodeMenu(index: number, ctx: MenuCtx, spec: ConnectSpec): MenuItem[] {
  const nodes = records(ctx.data, spec.nodesField);
  const node = nodes[index];
  if (node === undefined) return [];
  const id = typeof node[spec.idField] === 'string' ? (node[spec.idField] as string) : '';
  const nodePath = `${spec.nodesField}.${index}`;
  const items: MenuItem[] = [];
  const kinds = nodeKindChoices(ctx, spec);
  const hasKinds = kinds.length > 1 || (kinds.length === 1 && node['kind'] !== undefined);

  // Add node → / ↓ / ← / ↑ — a new node at the nearest free cell in that
  // direction plus the edge from this node (newNodeOps: node + edge, one step).
  if (spec.newNode !== undefined && spec.gridNodes) {
    for (const { dir, arrow } of DIRS) {
      const cell = freeCellFrom(ctx, spec, index, dir);
      const build = (kind: string): Op[] => {
        if (cell === null) return [];
        const r = newNodeOps(spec, ctx.data, id, cell, kind, ctx.placements ?? undefined);
        return r === null ? [] : r.sets;
      };
      const thenFor = { select: `${spec.nodesField}.${nodes.length}`, edit: spec.labelField };
      items.push(
        spec.nodeKinds.length === 1
          ? {
              label: `Add node ${arrow}`,
              disabled: cell === null,
              op: () => build((spec.nodeKinds[0] as ConnectKind).kind),
              then: thenFor,
            }
          : {
              label: `Add node ${arrow}`,
              disabled: cell === null,
              children: kinds.map((k) => ({
                label: k.label,
                op: () => build(k.kind),
                then: thenFor,
              })),
            },
      );
    }
  } else if (spec.memberField !== undefined) {
    // Cluster: no grid — the new service joins this node's cluster.
    items.push({
      label: 'Add node',
      children: kinds.map((k) => ({
        label: k.label,
        op: () => {
          const r = newNodeOps(spec, ctx.data, id, { col: 1, row: 1 }, k.kind);
          return r === null ? [] : r.sets;
        },
        then: { select: `${spec.nodesField}.${nodes.length}`, edit: spec.labelField },
      })),
    });
  }

  if (hasKinds) {
    const cur = node['kind'];
    items.push({
      label: 'Change kind',
      children: kinds.map((k) => ({
        label: k.label,
        checked: cur === k.kind,
        op: () => [{ path: [spec.nodesField, index], value: withKey(node, 'kind', k.kind) }],
      })),
    });
  }

  if (ctx.kind === 'block' || ctx.kind === 'cluster') {
    const cur = typeof node['replicas'] === 'number' ? (node['replicas'] as number) : 1;
    const preset = [1, 2, 3, 5];
    items.push({
      label: 'Replicas',
      children: [
        ...preset.map((n) => ({
          label: n === 1 ? '1 (single)' : `×${n}`,
          checked: cur === n,
          op: (): Op[] => [
            { path: [spec.nodesField, index], value: withKey(node, 'replicas', n === 1 ? undefined : n) },
          ],
        })),
        { label: 'Custom…', action: { type: 'edit', path: nodePath, field: 'replicas' } },
      ],
    });
  }

  items.push(...membershipItems(index, node, ctx, spec));

  items.push(SEP);
  items.push({ label: 'Rename', shortcut: '⏎', action: { type: 'edit', path: nodePath, field: spec.labelField } });
  items.push({
    label: 'Delete node',
    shortcut: '⌫',
    danger: true,
    fades: [nodePath, ...edgesTouching(ctx, spec, id).map((ei) => `${spec.edgesField}.${ei}`)],
    op: () => deleteNodeOps(ctx, spec, index, id),
  });
  return items;
}

/** Indices of the edges that start or end at node `id`. */
function edgesTouching(ctx: MenuCtx, spec: ConnectSpec, id: string): number[] {
  const out: number[] = [];
  records(ctx.data, spec.edgesField).forEach((e, i) => {
    if (e['from'] === id || e['to'] === id) out.push(i);
  });
  return out;
}

/**
 * Node `index` and every edge touching it. A leaf node — nothing points at it
 * — is ONE targeted remove, so the diff is the node's own lines and nothing
 * else. With edges to drop the op must stay homogeneous (a remove plus a set
 * is two commits), so both lists are rewritten as sets; core's terse-aware
 * write keeps the surviving lines byte-identical.
 */
function deleteNodeOps(ctx: MenuCtx, spec: ConnectSpec, index: number, id: string): Op[] {
  const nodes = listOf(ctx.data, spec.nodesField);
  const edges = records(ctx.data, spec.edgesField);
  const touched = edges.filter((e) => e['from'] === id || e['to'] === id);
  if (touched.length === 0) return [{ path: [spec.nodesField, index], remove: true }];
  return [
    { path: [spec.nodesField], value: nodes.filter((_, i) => i !== index) },
    { path: [spec.edgesField], value: edges.filter((e) => e['from'] !== id && e['to'] !== id) },
  ];
}

/**
 * `Add to group ▸` / `Remove from group` per kind: grid kinds move the node
 * into (out of) a dashed cell range; `graph` writes its per-node `group`
 * number; `cluster` re-seats the service in another cluster.
 */
function membershipItems(
  index: number,
  node: Record<string, unknown>,
  ctx: MenuCtx,
  spec: ConnectSpec,
): MenuItem[] {
  if (spec.groups && ctx.placements !== null) {
    const groups = records(ctx.data, 'groups');
    if (groups.length === 0) return [];
    const me = ctx.placements[index];
    const ranges = groups.map((_, gi) => groupRangeAt(ctx.data, gi));
    const inside = ranges.findIndex((r) => r !== null && me !== undefined && inRange(me, r));
    const items: MenuItem[] = [
      {
        label: 'Add to group',
        children: groups.map((g, gi) => {
          const r = ranges[gi] ?? null;
          const cell = r !== null ? freeCellInRange(ctx, spec, r, index) : null;
          return {
            label: typeof g['label'] === 'string' ? (g['label'] as string) : `Group ${gi + 1}`,
            checked: inside === gi,
            disabled: inside === gi || cell === null,
            op: (): Op[] => (cell === null ? [] : moveNodeOps(ctx, spec, index, cell)),
          };
        }),
      },
    ];
    if (inside >= 0 && ctx.grid !== null) {
      // The nearest free cell outside EVERY group, scanning row-major.
      const cells = occupancy(ctx, spec).filter((_, i) => i !== index);
      let target: Placement | null = null;
      for (let row = 1; row <= ctx.grid.rows + 1 && target === null; row++) {
        for (let col = 1; col <= ctx.grid.cols + 1; col++) {
          const p = { col, row };
          if (!isOccupied(cells, col, row) && !ranges.some((r) => r !== null && inRange(p, r))) {
            target = p;
            break;
          }
        }
      }
      const out = target;
      items.push({
        label: 'Remove from group',
        disabled: out === null,
        op: () => (out === null ? [] : moveNodeOps(ctx, spec, index, out)),
      });
    }
    return items;
  }
  if (ctx.kind === 'graph') {
    const used = new Set<number>();
    for (const n of records(ctx.data, spec.nodesField)) {
      if (typeof n['group'] === 'number') used.add(n['group'] as number);
    }
    const cur = typeof node['group'] === 'number' ? (node['group'] as number) : null;
    const next = used.size === 0 ? 1 : Math.max(...used) + 1;
    const items: MenuItem[] = [
      {
        label: 'Add to group',
        children: [
          ...[...used].sort((a, b) => a - b).map((g) => ({
            label: `Group ${g}`,
            checked: cur === g,
            disabled: cur === g,
            op: (): Op[] => [{ path: [spec.nodesField, index], value: withKey(node, 'group', g) }],
          })),
          {
            label: `New group ${next}`,
            op: (): Op[] => [{ path: [spec.nodesField, index], value: withKey(node, 'group', next) }],
          },
        ],
      },
    ];
    if (cur !== null) {
      items.push({
        label: 'Remove from group',
        op: () => [{ path: [spec.nodesField, index], value: withKey(node, 'group', undefined) }],
      });
    }
    return items;
  }
  if (spec.memberField !== undefined) {
    const field = spec.memberField;
    const clusters = records(ctx.data, 'clusters');
    if (clusters.length < 2) return [];
    return [
      {
        label: 'Move to cluster',
        children: clusters.map((c) => ({
          label: typeof c['label'] === 'string' ? (c['label'] as string) : String(c['id'] ?? ''),
          checked: node[field] === c['id'],
          disabled: node[field] === c['id'],
          op: (): Op[] => [{ path: [spec.nodesField, index], value: withKey(node, field, c['id']) }],
        })),
      },
    ];
  }
  return [];
}

/* ---- grid family: edge ---- */

function edgeMenu(index: number, ctx: MenuCtx, spec: ConnectSpec): MenuItem[] {
  const edges = records(ctx.data, spec.edgesField);
  const edge = edges[index];
  if (edge === undefined) return [];
  const edgePath = `${spec.edgesField}.${index}`;
  const items: MenuItem[] = [];
  if (spec.edgeKinds !== undefined) {
    const cur = typeof edge['kind'] === 'string' ? (edge['kind'] as string) : null;
    const dflt = spec.edgeKinds.includes('solid') ? 'solid' : spec.edgeKinds.includes('sync') ? 'sync' : null;
    items.push({
      label: 'Kind',
      children: spec.edgeKinds.map((k) => ({
        label: titleCase(k),
        checked: cur === k || (cur === null && k === dflt),
        op: (): Op[] => [{ path: [spec.edgesField, index], value: withKey(edge, 'kind', k === dflt ? undefined : k) }],
      })),
    });
  } else if (ctx.kind === 'graph') {
    const cur = edge['dir'] === 'undirected' ? 'undirected' : 'directed';
    items.push({
      label: 'Direction',
      children: (['directed', 'undirected'] as const).map((d) => ({
        label: titleCase(d),
        checked: cur === d,
        op: (): Op[] => [{ path: [spec.edgesField, index], value: withKey(edge, 'dir', d === 'directed' ? undefined : d) }],
      })),
    });
  }
  if (spec.edgeChoices !== undefined && spec.edgeChoiceField !== undefined) {
    const field = spec.edgeChoiceField;
    items.push({
      label: 'Cardinality',
      children: spec.edgeChoices.map((c) => ({
        label: c.label,
        checked: edge[field] === c.value,
        op: (): Op[] => [{ path: [spec.edgesField, index], value: withKey(edge, field, c.value) }],
      })),
    });
  }
  items.push({
    label: spec.edgeTextField === 'event' ? 'Edit event' : 'Edit label',
    shortcut: '⏎',
    action: { type: 'edit', path: edgePath, field: spec.edgeTextField },
  });
  items.push({
    label: 'Reverse',
    disabled: edge['from'] === edge['to'],
    op: () => [{ path: [spec.edgesField, index], value: { ...edge, from: edge['to'], to: edge['from'] } }],
  });
  items.push(SEP);
  items.push({
    label: 'Delete edge',
    shortcut: '⌫',
    danger: true,
    fades: [edgePath],
    op: () => [{ path: [spec.edgesField, index], remove: true }],
  });
  return items;
}

/* ---- grid family: group / cell / background ---- */

function groupMenu(index: number, ctx: MenuCtx): MenuItem[] {
  const groups = listOf(ctx.data, 'groups');
  if (groups[index] === undefined) return [];
  const path = `groups.${index}`;
  return [
    { label: 'Rename', shortcut: '⏎', action: { type: 'edit', path, field: 'label' } },
    SEP,
    {
      label: 'Delete group',
      shortcut: '⌫',
      danger: true,
      fades: [path],
      op: () => [{ path: ['groups', index], remove: true }],
    },
  ];
}

/** `Insert node ▸` at `cell` (no edge) — one item per kind. */
function insertNodeItem(label: string, cell: Placement, ctx: MenuCtx, spec: ConnectSpec): MenuItem | null {
  if (spec.newNode === undefined) return null;
  const kinds = nodeKindChoices(ctx, spec);
  const count = listOf(ctx.data, spec.nodesField).length;
  const then = { select: `${spec.nodesField}.${count}`, edit: spec.labelField };
  const build = (kind: string): Op[] => {
    const r = newNodeAtOps(spec, ctx.data, cell, kind, ctx.placements ?? undefined);
    return r === null ? [] : r.sets;
  };
  if (spec.nodeKinds.length === 1) {
    return { label, op: () => build((spec.nodeKinds[0] as ConnectKind).kind), then };
  }
  return { label, children: kinds.map((k) => ({ label: k.label, op: () => build(k.kind), then })) };
}

function cellMenu(cell: { col: number; row: number }, ctx: MenuCtx, spec: ConnectSpec): MenuItem[] {
  const items: MenuItem[] = [];
  const ins = insertNodeItem('Insert node here', { col: cell.col, row: cell.row }, ctx, spec);
  if (ins !== null) items.push(ins);
  if (spec.groups) {
    const count = listOf(ctx.data, 'groups').length;
    items.push({
      label: 'Insert group here',
      op: () => {
        const r = groupOps(ctx.kind, ctx.data, { col: cell.col, row: cell.row, cols: 1, rows: 1 });
        return r === null ? [] : r.sets;
      },
      then: { select: `groups.${count}`, edit: 'label' },
    });
  }
  // (No clipboard in the layer yet — no Paste.)
  return items;
}

function backgroundMenu(ctx: MenuCtx, spec: ConnectSpec): MenuItem[] {
  const items: MenuItem[] = [];
  if (spec.gridNodes && ctx.grid !== null) {
    const ins = insertNodeItem('Insert node', firstFreeCell(ctx, spec), ctx, spec);
    if (ins !== null) items.push(ins);
  }
  const dir = dirItem(ctx);
  if (dir !== null) items.push(dir);
  if (items.length > 0) items.push(SEP);
  items.push(openYaml());
  return items;
}

/* ─── sequence ────────────────────────────────────────────────────────────── */

const MESSAGE_KINDS = ['sync', 'response', 'async', 'error', 'note'] as const;

function sequenceMenu(target: MenuTarget, ctx: MenuCtx): MenuItem[] {
  const actors = records(ctx.data, 'actors');
  const messages = listOf(ctx.data, 'messages');
  if (target.type === 'actor') {
    const actor = actors[target.index];
    if (actor === undefined) return [];
    const id = typeof actor['id'] === 'string' ? (actor['id'] as string) : '';
    const path = `actors.${target.index}`;
    return [
      { label: 'Add message from here…', action: { type: 'connect', fromIndex: target.index } },
      {
        label: 'Add note here',
        op: () => [{ path: ['messages', messages.length], value: { from: id, to: id, kind: 'note', label: 'note' } }],
        then: { select: `messages.${messages.length}`, edit: 'label' },
      },
      SEP,
      { label: 'Rename', shortcut: '⏎', action: { type: 'edit', path, field: 'name' } },
      {
        label: 'Delete actor',
        shortcut: '⌫',
        danger: true,
        fades: [
          path,
          ...messages.flatMap((m, i) => {
            const r = asRecord(m);
            return r !== null && (r['from'] === id || r['to'] === id) ? [`messages.${i}`] : [];
          }),
        ],
        // An actor no message mentions is one targeted remove; otherwise the
        // messages must be filtered too, and one op can carry only one remove.
        op: (): Op[] => {
          const kept = messages.filter((m) => {
            const r = asRecord(m);
            return r === null || (r['from'] !== id && r['to'] !== id);
          });
          if (kept.length === messages.length) {
            return [{ path: ['actors', target.index], remove: true }];
          }
          return [
            { path: ['actors'], value: actors.filter((_, i) => i !== target.index) },
            { path: ['messages'], value: kept },
          ];
        },
      },
    ];
  }
  if (target.type === 'message') {
    const item = asRecord(messages[target.index]);
    if (item === null) return [];
    const path = `messages.${target.index}`;
    if (!isSequenceMessage(item)) {
      // A frame marker (`{frame}` / `{else}` / `{end}`): only removal.
      return [
        ...('frame' in item ? [{ label: 'Edit label', shortcut: '⏎', action: { type: 'edit', path, field: 'label' } as MenuAction }] : []),
        {
          label: 'Delete marker',
          shortcut: '⌫',
          danger: true,
          fades: [path],
          op: (): Op[] => [{ path: ['messages', target.index], remove: true }],
        },
      ];
    }
    const cur = typeof item['kind'] === 'string' ? (item['kind'] as string) : 'sync';
    // A range wrap: the selected message (if another one in this block) to
    // the clicked one, inclusive.
    const sel = ctx.selected !== null ? /^messages\.(\d+)$/.exec(ctx.selected) : null;
    const other = sel !== null && isSequenceMessage(messages[Number(sel[1])]) ? Number(sel[1]) : target.index;
    const lo = Math.min(other, target.index);
    const hi = Math.max(other, target.index);
    const rangeLabel = lo === hi ? '' : ` (${hi - lo + 1} messages)`;
    return [
      {
        label: 'Kind',
        children: MESSAGE_KINDS.map((k) => ({
          label: titleCase(k),
          checked: cur === k,
          op: (): Op[] => [{ path: ['messages', target.index], value: withKey(item, 'kind', k === 'sync' ? undefined : k) }],
        })),
      },
      { label: 'Edit label', shortcut: '⏎', action: { type: 'edit', path, field: 'label' } },
      { label: 'Add step note', shortcut: 'n', action: { type: 'edit', path, field: 'summary' } },
      {
        label: `Wrap in${rangeLabel}`,
        children: SEQUENCE_FRAME_KINDS.map((frame) => ({
          label: frame,
          op: (): Op[] => [{ path: ['messages'], value: wrapRange(messages, lo, hi, frame) }],
          then: { select: `messages.${lo}`, edit: 'label' },
        })),
      },
      {
        label: 'Activate target',
        checked: item['activate'] === true,
        op: () => [{ path: ['messages', target.index], value: withKey(item, 'activate', item['activate'] === true ? undefined : true) }],
      },
      {
        label: 'Deactivate sender',
        checked: item['deactivate'] === true,
        op: () => [{ path: ['messages', target.index], value: withKey(item, 'deactivate', item['deactivate'] === true ? undefined : true) }],
      },
      SEP,
      {
        label: 'Delete',
        shortcut: '⌫',
        danger: true,
        fades: [path],
        op: () => [{ path: ['messages', target.index], remove: true }],
      },
    ];
  }
  // Background.
  return [
    {
      label: 'Add actor',
      op: () => [{ path: ['actors', actors.length], value: { id: uniqueActorId(actors), name: 'New actor' } }],
      then: { select: `actors.${actors.length}`, edit: 'name' },
    },
    SEP,
    openYaml(),
  ];
}

/**
 * `messages` with `{frame}` before `lo` and `{end: true}` after `hi`.
 *
 * Two insertions in the middle of the list: no per-index path expresses that,
 * so this is a whole-list set by nature. The wrapped messages keep their exact
 * source lines through core's terse-aware write.
 */
export function wrapRange(messages: readonly unknown[], lo: number, hi: number, frame: string): unknown[] {
  return [
    ...messages.slice(0, lo),
    { frame, label: '' },
    ...messages.slice(lo, hi + 1),
    { end: true },
    ...messages.slice(hi + 1),
  ];
}

function uniqueActorId(actors: ReadonlyArray<Record<string, unknown>>): string {
  const used = new Set(actors.map((a) => String(a['id'] ?? '')));
  let n = actors.length + 1;
  let id = `actor${n}`;
  while (used.has(id)) {
    n += 1;
    id = `actor${n}`;
  }
  return id;
}

/* ─── erd ─────────────────────────────────────────────────────────────────── */

const COLUMN_FLAGS: ReadonlyArray<{ readonly key: string; readonly label: string }> = [
  { key: 'pk', label: 'Primary key' },
  { key: 'fk', label: 'Foreign key' },
  { key: 'unique', label: 'Unique' },
  { key: 'nullable', label: 'Nullable' },
  { key: 'index', label: 'Indexed' },
];

function erdMenu(target: MenuTarget, ctx: MenuCtx): MenuItem[] {
  const spec = specFor('erd') as ConnectSpec;
  const entities = records(ctx.data, 'entities');
  if (target.type === 'entity') {
    const ent = entities[target.index];
    if (ent === undefined) return [];
    const name = typeof ent['name'] === 'string' ? (ent['name'] as string) : '';
    const cols = listOf(ent, 'columns');
    const path = `entities.${target.index}`;
    const relations = records(ctx.data, 'relations');
    return [
      {
        label: 'Add column',
        op: () => [{ path: ['entities', target.index, 'columns', cols.length], value: { name: 'new_column', type: 'text' } }],
        then: { select: `${path}.columns.${cols.length}`, edit: 'name' },
      },
      { label: 'Add relation to…', action: { type: 'connect', fromIndex: target.index } },
      SEP,
      { label: 'Rename', shortcut: '⏎', action: { type: 'edit', path, field: 'name' } },
      {
        label: 'Delete entity',
        shortcut: '⌫',
        danger: true,
        fades: [
          path,
          ...relations.flatMap((r, i) => (r['from'] === name || r['to'] === name ? [`relations.${i}`] : [])),
        ],
        // Same rule as a node: no relation touches it → one targeted remove.
        op: (): Op[] => {
          const kept = relations.filter((r) => r['from'] !== name && r['to'] !== name);
          if (kept.length === relations.length) {
            return [{ path: ['entities', target.index], remove: true }];
          }
          return [
            { path: ['entities'], value: entities.filter((_, i) => i !== target.index) },
            { path: ['relations'], value: kept },
          ];
        },
      },
    ];
  }
  if (target.type === 'column') {
    const ent = entities[target.entity];
    const col = ent !== undefined ? asRecord(listOf(ent, 'columns')[target.index]) : null;
    if (col === null) return [];
    const base = ['entities', target.entity, 'columns', target.index] as const;
    return [
      ...COLUMN_FLAGS.map((f) => ({
        label: f.label,
        checked: col[f.key] === true,
        op: (): Op[] => [{ path: [...base], value: withKey(col, f.key, col[f.key] === true ? undefined : true) }],
      })),
      SEP,
      { label: 'Rename', shortcut: '⏎', action: { type: 'edit', path: base.join('.'), field: 'name' } },
      {
        label: 'Delete column',
        shortcut: '⌫',
        danger: true,
        fades: [base.join('.')],
        op: () => [{ path: [...base], remove: true }],
      },
    ];
  }
  if (target.type === 'edge') return edgeMenu(target.index, ctx, spec);
  // Background.
  const items: MenuItem[] = [
    {
      label: 'Add entity',
      op: () => [
        {
          path: ['entities', entities.length],
          value: { name: uniqueEntityName(entities), columns: [{ name: 'id', type: 'uuid', pk: true }] },
        },
      ],
      then: { select: `entities.${entities.length}`, edit: 'name' },
    },
  ];
  const dir = dirItem(ctx);
  if (dir !== null) items.push(dir);
  items.push(SEP, openYaml());
  return items;
}

function uniqueEntityName(entities: ReadonlyArray<Record<string, unknown>>): string {
  const used = new Set(entities.map((e) => String(e['name'] ?? '')));
  let n = entities.length + 1;
  let name = `Entity${n}`;
  while (used.has(name)) {
    n += 1;
    name = `Entity${n}`;
  }
  return name;
}

/* ─── list-ordered kinds ──────────────────────────────────────────────────── */

/**
 * What the generic list menu needs per kind, on top of the list field that
 * {@link REORDER_LISTS} already owns:
 *
 * - `noun` names an item ("Add term", "Add member");
 * - `axis` is the direction the renderer lays the list out, so the move items
 *   read `up`/`down` (a column) or `left`/`right` (a row);
 * - `field` is the field a fresh item opens for editing;
 * - `min`/`max` mirror the item array's schema bounds — `Delete` is disabled
 *   at `min`, the inserts and `Duplicate` at `max`.
 */
interface ListShape {
  readonly noun: string;
  readonly axis: 'x' | 'y';
  readonly field: string;
  readonly min: number;
  readonly max?: number;
}

const LIST_SHAPES: Readonly<Record<string, ListShape>> = {
  glossary: { noun: 'term', axis: 'y', field: 'term', min: 0 },
  faq: { noun: 'question', axis: 'y', field: 'q', min: 1 },
  steps: { noun: 'step', axis: 'y', field: 'title', min: 1 },
  list: { noun: 'item', axis: 'y', field: 'lead', min: 1 },
  takeaways: { noun: 'takeaway', axis: 'y', field: 'text', min: 2, max: 6 },
  agenda: { noun: 'item', axis: 'y', field: 'title', min: 0 },
  team: { noun: 'member', axis: 'y', field: 'name', min: 1 },
  stats: { noun: 'stat', axis: 'x', field: 'label', min: 0 },
  saga: { noun: 'step', axis: 'x', field: 'name', min: 1 },
};

/**
 * The menu for a list-ordered kind: move / duplicate / insert / delete on an
 * item, `Add <noun>` on the background, plus the handful of per-kind choices
 * in {@link listExtras}. Position IS array order here, so every structural
 * item is the SAME splice the drag and the ⌥-arrow nudge commit
 * ({@link applyReorder}), written as one whole-list set.
 */
function listMenu(target: MenuTarget, ctx: MenuCtx, field: string): MenuItem[] {
  const shape = LIST_SHAPES[ctx.kind];
  if (shape === undefined) return [];
  const items = listOf(ctx.data, field);
  if (target.type !== 'item') return listBackgroundMenu(ctx, field, shape, items);
  const i = target.index;
  const item = asRecord(items[i]);
  if (item === null) return [];
  const n = items.length;
  const full = shape.max !== undefined && n >= shape.max;
  const seed = (): unknown => blankListItem(ctx.kind, items) ?? {};
  /** One new item at position `k`: an APPEND addresses the new index alone. */
  const insertAt = (k: number): Op[] =>
    k >= n
      ? [{ path: [field, n], value: seed() }]
      : [{ path: [field], value: [...items.slice(0, k), seed(), ...items.slice(k)] }];
  const extras = listExtras(i, item, ctx, field, items);
  return [
    ...extras,
    ...(extras.length > 0 ? [SEP] : []),
    {
      label: shape.axis === 'x' ? 'Move left' : 'Move up',
      shortcut: shape.axis === 'x' ? '⌥←' : '⌥↑',
      disabled: i === 0,
      op: (): Op[] => reorderOps(field, items, i, i - 1),
      then: { select: `${field}.${i - 1}` },
    },
    {
      label: shape.axis === 'x' ? 'Move right' : 'Move down',
      shortcut: shape.axis === 'x' ? '⌥→' : '⌥↓',
      disabled: i >= n - 1,
      op: (): Op[] => reorderOps(field, items, i, i + 2),
      then: { select: `${field}.${i + 1}` },
    },
    {
      label: 'Duplicate',
      disabled: full,
      op: (): Op[] =>
        i === n - 1
          ? [{ path: [field, n], value: withUniqueId(item, items) }]
          : [
              {
                path: [field],
                value: [...items.slice(0, i + 1), withUniqueId(item, items), ...items.slice(i + 1)],
              },
            ],
      then: { select: `${field}.${i + 1}` },
    },
    {
      label: 'Insert before',
      disabled: full,
      op: (): Op[] => insertAt(i),
      then: { select: `${field}.${i}`, edit: shape.field },
    },
    {
      label: 'Insert after',
      disabled: full,
      op: (): Op[] => insertAt(i + 1),
      then: { select: `${field}.${i + 1}`, edit: shape.field },
    },
    SEP,
    {
      label: 'Delete',
      shortcut: '⌫',
      danger: true,
      disabled: n <= shape.min,
      fades: [`${field}.${i}`],
      op: (): Op[] => listDeleteOps(ctx, field, items, i),
    },
  ];
}

function listBackgroundMenu(
  ctx: MenuCtx,
  field: string,
  shape: ListShape,
  items: readonly unknown[],
): MenuItem[] {
  return [
    {
      label: `Add ${shape.noun}`,
      disabled: shape.max !== undefined && items.length >= shape.max,
      op: (): Op[] => [
        { path: [field, items.length], value: blankListItem(ctx.kind, items) ?? {} },
      ],
      then: { select: `${field}.${items.length}`, edit: shape.field },
    },
    SEP,
    openYaml(),
  ];
}

/**
 * The whole-list set a from→gap move commits (the drag layer's own splice).
 * A reorder legitimately rewrites the list — position IS array order here, and
 * no per-index path can express a splice. The diff stays small because core's
 * terse-aware write moves the author's own YAML nodes instead of reserialising
 * them (`setYamlPath(…, kind)`).
 */
function reorderOps(field: string, items: readonly unknown[], from: number, gap: number): Op[] {
  const next = applyReorder(items, from, gap);
  return next === null ? [] : [{ path: [field], value: next }];
}

/**
 * Removing one item is a single `remove` — the raw YAML around it keeps its
 * formatting. One exception: a saga step named by the block's `failAt` would
 * leave that key dangling (the schema rejects it), so that case rewrites the
 * body without the key, as one set.
 */
function listDeleteOps(
  ctx: MenuCtx,
  field: string,
  items: readonly unknown[],
  i: number,
): Op[] {
  const data = asRecord(ctx.data);
  if (ctx.kind === 'saga' && data !== null && data['failAt'] === asRecord(items[i])?.['id']) {
    const rest = withKey(data, 'failAt', undefined);
    return [{ path: [], value: { ...rest, [field]: items.filter((_, k) => k !== i) } }];
  }
  return [{ path: [field, i], remove: true }];
}

/** The per-kind choices above the generic block (empty for most kinds). */
function listExtras(
  i: number,
  item: Record<string, unknown>,
  ctx: MenuCtx,
  field: string,
  items: readonly unknown[],
): MenuItem[] {
  if (ctx.kind === 'saga') return sagaStepItems(i, item, ctx, field, items);
  if (ctx.kind === 'stats') return [trendItem(i, item, field)];
  return [];
}

const SAGA_STATUSES = ['ok', 'failed', 'skipped', 'compensated'] as const;

/**
 * The effective status of step `i` — what the renderer draws: an explicit
 * `status` wins, otherwise `failAt` derives it (before it `compensated`, at
 * it `failed`, after it `skipped`).
 */
function sagaStatusAt(ctx: MenuCtx, steps: readonly unknown[], i: number): string {
  const explicit = asRecord(steps[i])?.['status'];
  if (typeof explicit === 'string') return explicit;
  const failAt = asRecord(ctx.data)?.['failAt'];
  const failIdx =
    failAt !== undefined
      ? steps.findIndex((s) => asRecord(s)?.['id'] === failAt)
      : steps.findIndex((s) => asRecord(s)?.['status'] === 'failed');
  if (failIdx < 0) return 'ok';
  return i < failIdx ? 'compensated' : i === failIdx ? 'failed' : 'skipped';
}

/**
 * A saga step's own choices: where the transaction fails (the block-level
 * `failAt`), an explicit status for this step, and dropping its compensation.
 */
function sagaStepItems(
  i: number,
  step: Record<string, unknown>,
  ctx: MenuCtx,
  field: string,
  steps: readonly unknown[],
): MenuItem[] {
  const id = typeof step['id'] === 'string' ? (step['id'] as string) : '';
  const fails = id !== '' && asRecord(ctx.data)?.['failAt'] === id;
  const effective = sagaStatusAt(ctx, steps, i);
  const items: MenuItem[] = [
    fails
      ? {
          label: 'Clear failure point',
          checked: true,
          op: (): Op[] => [{ path: ['failAt'], remove: true }],
        }
      : {
          label: 'Set as failure point',
          checked: false,
          disabled: id === '',
          op: (): Op[] => (id === '' ? [] : [{ path: ['failAt'], value: id }]),
        },
    {
      label: 'Status',
      children: SAGA_STATUSES.map((s) => ({
        label: titleCase(s),
        checked: effective === s,
        op: (): Op[] => [{ path: [field, i], value: withKey(step, 'status', s) }],
      })),
    },
  ];
  if (typeof step['compensate'] === 'string') {
    items.push({
      label: 'Remove compensation',
      op: (): Op[] => [{ path: [field, i], value: withKey(step, 'compensate', undefined) }],
    });
  }
  return items;
}

const TRENDS = ['up', 'down', 'flat'] as const;

/** `Trend ▸` for a KPI card (`statSchema.trend`); `None` drops the key. */
function trendItem(i: number, stat: Record<string, unknown>, field: string): MenuItem {
  const cur = stat['trend'];
  return {
    label: 'Trend',
    children: [
      ...TRENDS.map((t) => ({
        label: titleCase(t),
        checked: cur === t,
        op: (): Op[] => [{ path: [field, i], value: withKey(stat, 'trend', t) }],
      })),
      {
        label: 'None',
        checked: cur === undefined,
        op: (): Op[] => [{ path: [field, i], value: withKey(stat, 'trend', undefined) }],
      },
    ],
  };
}

/* ─── tree helpers (used by the glue and the tests) ───────────────────────── */

/** Every leaf item (op or action) in the tree, depth-first. */
export function flattenMenu(items: readonly MenuItem[]): MenuItem[] {
  const out: MenuItem[] = [];
  for (const it of items) {
    if (it.separator === true) continue;
    if (it.children !== undefined) out.push(...flattenMenu(it.children));
    else out.push(it);
  }
  return out;
}

/**
 * True when `ops` is committable as ONE step: all sets, or exactly one
 * remove. (The layer routes sets to `commitPaths`, a remove to `deletePath`.)
 */
export function isHomogeneous(ops: readonly Op[]): boolean {
  const removes = ops.filter(isRemoveOp).length;
  return removes === 0 || (removes === 1 && ops.length === 1);
}
