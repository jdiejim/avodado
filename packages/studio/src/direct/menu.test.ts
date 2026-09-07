/**
 * The context menu's content per target, and — the part that matters — that
 * EVERY op it offers writes YAML the core schemas accept: each item's ops are
 * applied through the same `setPathsInSegment` / `deletePathInSegment` the
 * canvas host uses, then the doc is re-parsed and validated.
 */
import { describe, expect, it } from 'vitest';
import { parseDocument, validateDocument, type Document } from '@avodado/core';
import { specFor } from './connect.js';
import { applyReorder } from './drag.js';
import { deletePathInSegment, setPathsInSegment } from './host.js';
import {
  flattenMenu,
  freeCellFrom,
  isHomogeneous,
  isRemoveOp,
  menuFor,
  targetFor,
  wrapRange,
  type MenuCtx,
  type MenuItem,
  type MenuTarget,
  type Op,
} from './menu.js';

function must<T>(v: T | null | undefined): T {
  if (v === null || v === undefined) throw new Error('expected a value');
  return v;
}

const FENCES: Readonly<Record<string, string>> = {
  flow: [
    '```flow',
    'nodes:',
    '  - { id: a, label: Start, kind: start, col: 1, row: 1 }',
    '  - { id: b, label: Work, kind: process, col: 2, row: 1 }',
    'groups:',
    '  - { col: 1, row: 1, cols: 1, rows: 1, label: Entry }',
    'edges:',
    '  - { from: a, to: b, label: go }',
    '```',
  ].join('\n'),
  dfd: [
    '```dfd',
    'nodes:',
    '  - { id: a, name: Client, kind: external, col: 1, row: 1 }',
    '  - { id: b, name: Ingest, kind: process, col: 2, row: 1 }',
    'edges:',
    '  - { from: a, to: b }',
    '```',
  ].join('\n'),
  state: [
    '```state',
    'states:',
    '  - { id: a, name: Draft, kind: active, col: 1, row: 1 }',
    '  - { id: b, name: Live, kind: active, col: 2, row: 1 }',
    'transitions:',
    '  - { from: a, to: b, event: publish }',
    '```',
  ].join('\n'),
  c4: [
    '```c4',
    'nodes:',
    '  - { id: a, kind: person, name: User, col: 1, row: 1 }',
    '  - { id: b, kind: system, name: API, col: 2, row: 1 }',
    'edges:',
    '  - { from: a, to: b }',
    '```',
  ].join('\n'),
  block: [
    '```block',
    'preset: k8s',
    'groups:',
    '  - { id: ns, col: 1, row: 1, cols: 2, rows: 1, label: namespace }',
    'nodes:',
    '  - { id: a, name: Ingress, kind: ingress, col: 1, row: 1 }',
    '  - { id: b, name: API, kind: service, col: 2, row: 1, replicas: 2 }',
    '  - { id: c, name: DB, kind: postgres, col: 3, row: 1 }',
    'edges:',
    '  - { from: a, to: b }',
    '  - { from: b, to: c, kind: dashed }',
    '```',
  ].join('\n'),
  felogic: [
    '```felogic',
    'nodes:',
    '  - { id: a, name: OrderService, kind: service, col: 1, row: 1 }',
    '  - { id: b, name: orders-db, kind: db, col: 2, row: 1 }',
    'edges:',
    '  - { from: a, to: b, kind: reads }',
    '```',
  ].join('\n'),
  graph: [
    '```graph',
    'nodes:',
    '  - { id: a, label: Alpha, col: 1, row: 1, group: 1 }',
    '  - { id: b, label: Beta, col: 2, row: 1 }',
    'edges:',
    '  - { from: a, to: b }',
    '```',
  ].join('\n'),
  cluster: [
    '```cluster',
    'clusters:',
    '  - { id: c1, label: prod }',
    '  - { id: c2, label: staging }',
    'services:',
    '  - { id: a, cluster: c1, label: api, kind: service }',
    '  - { id: b, cluster: c1, label: db, kind: db }',
    'edges:',
    '  - { from: a, to: b }',
    '```',
  ].join('\n'),
  sequence: [
    '```sequence',
    'actors:',
    '  - { id: web, name: Web }',
    '  - { id: api, name: API }',
    'messages:',
    '  - { from: web, to: api, label: request }',
    '  - { from: api, to: web, label: response, kind: response }',
    '  - { from: web, to: api, label: retry, activate: true }',
    '```',
  ].join('\n'),
  glossary: [
    '```glossary',
    'terms:',
    '  - { term: Saga, def: A transaction split across services }',
    '  - { term: Outbox, def: A table of pending events }',
    '  - { term: Idempotent, def: Safe to repeat }',
    '```',
  ].join('\n'),
  faq: [
    '```faq',
    'items:',
    '  - { q: Why a saga?, a: No shared transaction }',
    '  - { q: When does it run?, a: On checkout }',
    '```',
  ].join('\n'),
  steps: [
    '```steps',
    'items:',
    '  - { title: Install the CLI }',
    '  - { title: Add a config, body: Write avodado.config.ts }',
    '```',
  ].join('\n'),
  list: [
    '```list',
    'items:',
    '  - { lead: First }',
    '  - { lead: Second, text: with a detail }',
    '```',
  ].join('\n'),
  takeaways: [
    '```takeaways',
    'items:',
    '  - { text: One }',
    '  - { text: Two }',
    '  - { text: Three }',
    '  - { text: Four }',
    '  - { text: Five }',
    '  - { text: Six }',
    '```',
  ].join('\n'),
  // The same kind at its schema MINIMUM (2) — where `Delete` must go dark.
  takeaways2: ['```takeaways', 'items:', '  - { text: One }', '  - { text: Two }', '```'].join('\n'),
  agenda: [
    '```agenda',
    'items:',
    '  - { title: Intro, duration: 5m }',
    '  - { title: Demo, owner: Ada }',
    '```',
  ].join('\n'),
  team: [
    '```team',
    'members:',
    '  - { name: Ada }',
    '  - { name: Lin, role: Design }',
    '```',
  ].join('\n'),
  stats: [
    '```stats',
    'stats:',
    '  - { value: 99.9%, label: Uptime, trend: up }',
    '  - { value: 12, label: Errors }',
    '```',
  ].join('\n'),
  saga: [
    '```saga',
    'steps:',
    '  - { id: reserve, name: Reserve stock, service: inventory, compensate: release stock }',
    '  - { id: charge, name: Charge card, service: payments }',
    '  - { id: ship, name: Book shipment, service: shipping }',
    'failAt: charge',
    '```',
  ].join('\n'),
  erd: [
    '```erd',
    'entities:',
    '  - { name: Users, columns: [ { name: id, pk: true }, { name: email, unique: true } ] }',
    '  - { name: Orders, columns: [ { name: id, pk: true }, { name: user_id, fk: true } ] }',
    'relations:',
    '  - { from: Orders, to: Users, card: "N:1" }',
    '```',
  ].join('\n'),
};

interface Fixture {
  readonly source: string;
  readonly doc: Document;
  readonly idx: number;
  readonly data: unknown;
}

function fixture(kind: string): Fixture {
  const source = `# T\n\n${must(FENCES[kind])}\n`;
  const doc = parseDocument(source, 't');
  const idx = doc.segments.findIndex((s) => s.kind !== 'markdown');
  const seg = doc.segments[idx];
  if (seg === undefined || seg.kind === 'markdown') throw new Error('fixture segment missing');
  return { source, doc, idx, data: seg.data };
}

/** Applies homogeneous ops the way the canvas host does (one step). */
function apply(f: Fixture, ops: readonly Op[]): string {
  if (ops.length === 1 && isRemoveOp(ops[0] as Op)) {
    return deletePathInSegment(f.source, f.doc, f.idx, (ops[0] as Op).path);
  }
  return setPathsInSegment(
    f.source,
    f.doc,
    f.idx,
    ops.map((o) => ({ path: o.path, value: o.value })),
  );
}

function errorsOf(source: string): string[] {
  const doc = parseDocument(source, 't');
  return validateDocument(doc, 't.md')
    .filter((d) => d.level === 'error')
    .map((d) => `${d.code}: ${d.message}`);
}

/** The renderer's effective placements for the grid fixtures (all placed). */
function ctxFor(kind: string, f: Fixture, extra: Partial<MenuCtx> = {}): MenuCtx {
  const spec = specFor(kind);
  const grid = spec !== null && spec.gridNodes;
  const nodes = spec !== null ? ((f.data as Record<string, unknown>)[spec.nodesField] as Array<Record<string, number>>) : [];
  return {
    kind,
    data: f.data,
    placements: grid ? nodes.map((n) => ({ col: n['col'] as number, row: n['row'] as number })) : null,
    grid: grid ? { cols: Math.max(...nodes.map((n) => n['col'] as number)), rows: Math.max(...nodes.map((n) => n['row'] as number)) } : null,
    quick: false,
    selected: null,
    ...extra,
  };
}

const labels = (items: readonly MenuItem[]): string[] =>
  items.filter((i) => i.separator !== true).map((i) => i.label);

/** Every leaf op of a menu, tagged with its breadcrumb for failure messages. */
function leafOps(items: readonly MenuItem[]): Array<{ crumb: string; item: MenuItem }> {
  const out: Array<{ crumb: string; item: MenuItem }> = [];
  const walk = (list: readonly MenuItem[], prefix: string): void => {
    for (const it of list) {
      if (it.separator === true) continue;
      const crumb = prefix === '' ? it.label : `${prefix} ▸ ${it.label}`;
      if (it.children !== undefined) walk(it.children, crumb);
      else if (it.op !== undefined && it.disabled !== true) out.push({ crumb, item: it });
    }
  };
  walk(items, '');
  return out;
}

/** Asserts every enabled leaf op of `items` yields valid YAML on `f`. */
function expectAllOpsValid(f: Fixture, items: readonly MenuItem[]): number {
  const leaves = leafOps(items);
  for (const { crumb, item } of leaves) {
    const ops = must(item.op)();
    expect(isHomogeneous(ops), `${crumb}: ops must be all sets or one remove`).toBe(true);
    if (ops.length === 0) continue; // a disabled-by-data choice (nothing to write)
    expect(errorsOf(apply(f, ops)), crumb).toEqual([]);
  }
  return leaves.length;
}

const GRID_KINDS = ['flow', 'dfd', 'state', 'c4', 'block', 'felogic', 'graph'];

/** The list-ordered family: the list field, the item noun, the move wording. */
const LIST_KINDS: ReadonlyArray<{
  readonly kind: string;
  readonly field: string;
  readonly noun: string;
  readonly move: readonly [string, string];
}> = [
  { kind: 'glossary', field: 'terms', noun: 'term', move: ['Move up', 'Move down'] },
  { kind: 'faq', field: 'items', noun: 'question', move: ['Move up', 'Move down'] },
  { kind: 'steps', field: 'items', noun: 'step', move: ['Move up', 'Move down'] },
  { kind: 'list', field: 'items', noun: 'item', move: ['Move up', 'Move down'] },
  { kind: 'takeaways', field: 'items', noun: 'takeaway', move: ['Move up', 'Move down'] },
  { kind: 'agenda', field: 'items', noun: 'item', move: ['Move up', 'Move down'] },
  { kind: 'team', field: 'members', noun: 'member', move: ['Move up', 'Move down'] },
  { kind: 'stats', field: 'stats', noun: 'stat', move: ['Move left', 'Move right'] },
  { kind: 'saga', field: 'steps', noun: 'step', move: ['Move left', 'Move right'] },
];

describe('targetFor', () => {
  it('maps paths to targets per family (leaves count as their item)', () => {
    expect(targetFor('flow', 'nodes.2')).toEqual({ type: 'node', index: 2 });
    expect(targetFor('state', 'states.1.name')).toEqual({ type: 'node', index: 1 });
    expect(targetFor('state', 'transitions.0.event')).toEqual({ type: 'edge', index: 0 });
    expect(targetFor('flow', 'edges.3')).toEqual({ type: 'edge', index: 3 });
    expect(targetFor('flow', 'groups.0')).toEqual({ type: 'group', index: 0 });
    expect(targetFor('flow', null, { col: 2, row: 3 })).toEqual({ type: 'cell', col: 2, row: 3 });
    expect(targetFor('flow', null)).toEqual({ type: 'background' });
    expect(targetFor('flow', 'title')).toEqual({ type: 'background' });
    expect(targetFor('sequence', 'actors.1')).toEqual({ type: 'actor', index: 1 });
    expect(targetFor('sequence', 'messages.2')).toEqual({ type: 'message', index: 2 });
    expect(targetFor('sequence', 'foot.0')).toEqual({ type: 'background' });
    expect(targetFor('erd', 'entities.1')).toEqual({ type: 'entity', index: 1 });
    expect(targetFor('erd', 'entities.1.columns.0')).toEqual({ type: 'column', entity: 1, index: 0 });
    expect(targetFor('erd', 'relations.0')).toEqual({ type: 'edge', index: 0 });
    expect(targetFor('cluster', 'services.0')).toEqual({ type: 'node', index: 0 });
    expect(targetFor('cluster', null, { col: 1, row: 1 })).toEqual({ type: 'background' }); // no grid
    expect(targetFor('callout', 'text')).toEqual({ type: 'background' });
  });
});

describe('node menu (grid family)', () => {
  for (const kind of GRID_KINDS) {
    it(`${kind}: offers add ×4 / kind / group / rename / delete, every op valid`, () => {
      const f = fixture(kind);
      const spec = must(specFor(kind));
      const items = menuFor({ type: 'node', index: 1 }, ctxFor(kind, f));
      const names = labels(items);
      expect(names.slice(0, 4)).toEqual(['Add node →', 'Add node ↓', 'Add node ←', 'Add node ↑']);
      if (kind !== 'graph') expect(names).toContain('Change kind');
      else expect(names).not.toContain('Change kind');
      expect(names).toContain('Rename');
      expect(names[names.length - 1]).toBe('Delete node');
      // Every direction's submenu lists the kinds (graph: a direct leaf).
      const right = must(items[0]);
      if (spec.nodeKinds.length > 1) {
        expect(right.children?.map((c) => c.label)).toEqual(
          expect.arrayContaining(spec.nodeKinds.map((k) => k.label)),
        );
      } else {
        expect(right.op).toBeDefined();
      }
      // ← from node 1 (col 2) is taken by node 0 (col 1) and would leave the
      // grid — disabled; → is free.
      expect(right.disabled).not.toBe(true);
      expect(must(items[2]).disabled).toBe(true);
      expect(expectAllOpsValid(f, items)).toBeGreaterThan(4);
    });
  }

  it('Add node → writes the node at the next free cell PLUS the edge (one step)', () => {
    const f = fixture('flow');
    const items = menuFor({ type: 'node', index: 1 }, ctxFor('flow', f));
    const process = must(must(items[0]).children?.find((c) => c.label === 'Process'));
    const ops = must(process.op)();
    expect(ops).toEqual([
      { path: ['nodes', 2], value: { id: 'n3', label: 'New process', kind: 'process', col: 3, row: 1 } },
      { path: ['edges', 1], value: { from: 'b', to: 'n3' } },
    ]);
    expect(process.then).toEqual({ select: 'nodes.2', edit: 'label' });
    const out = apply(f, ops);
    expect(errorsOf(out)).toEqual([]);
    expect(out).toContain('n3');
  });

  it('Add node ↓ steps past occupied cells and grows the grid by one row at most', () => {
    const f = fixture('flow');
    const spec = must(specFor('flow'));
    const ctx = ctxFor('flow', f, {
      placements: [{ col: 1, row: 1 }, { col: 1, row: 2 }],
      grid: { cols: 1, rows: 2 },
    });
    expect(freeCellFrom(ctx, spec, 0, 'down')).toEqual({ col: 1, row: 3 }); // past node 1, into the growth row
    expect(freeCellFrom(ctx, spec, 0, 'up')).toBeNull();
    expect(freeCellFrom(ctx, spec, 0, 'left')).toBeNull();
    expect(freeCellFrom(ctx, spec, 0, 'right')).toEqual({ col: 2, row: 1 });
    // A wide node (w: 2) starts → after its span.
    const wide = { ...ctx, grid: { cols: 2, rows: 2 }, data: { nodes: [{ id: 'a', w: 2 }, { id: 'b' }] } };
    expect(freeCellFrom(wide, spec, 0, 'right')).toEqual({ col: 3, row: 1 });
    // …but never past one column beyond the grid.
    expect(freeCellFrom({ ...wide, grid: { cols: 1, rows: 2 } }, spec, 0, 'right')).toBeNull();
  });

  it('Add node on an auto-laid-out diagram materializes every placement first', () => {
    const source = ['# T', '', '```flow', 'nodes:', '  - { id: a, label: A }', '  - { id: b, label: B }', 'edges:', '  - { from: a, to: b }', '```', ''].join('\n');
    const doc = parseDocument(source, 't');
    const idx = doc.segments.findIndex((s) => s.kind !== 'markdown');
    const seg = doc.segments[idx];
    if (seg === undefined || seg.kind === 'markdown') throw new Error('segment');
    const f: Fixture = { source, doc, idx, data: seg.data };
    const ctx: MenuCtx = {
      kind: 'flow',
      data: seg.data,
      placements: [{ col: 1, row: 1 }, { col: 2, row: 1 }],
      grid: { cols: 2, rows: 1 },
      quick: true,
      selected: null,
    };
    const items = menuFor({ type: 'node', index: 1 }, ctx);
    const ops = must(must(must(items[0]).children?.[0]).op)();
    expect(ops).toHaveLength(2 * 2 + 2); // 2 nodes × col+row, node, edge
    expect(ops[0]).toEqual({ path: ['nodes', 0, 'col'], value: 1 });
    expect(errorsOf(apply(f, ops))).toEqual([]);
  });

  it('Change kind writes the kind; block/k8s kinds already in use stay reachable', () => {
    const f = fixture('block');
    const items = menuFor({ type: 'node', index: 1 }, ctxFor('block', f));
    const kind = must(items.find((i) => i.label === 'Change kind'));
    const names = must(kind.children).map((c) => c.label);
    expect(names).toEqual(expect.arrayContaining(['Service', 'Database', 'Ingress', 'Postgres']));
    expect(must(kind.children).find((c) => c.label === 'Service')?.checked).toBe(true);
    const ops = must(must(must(kind.children).find((c) => c.label === 'Ingress')).op)();
    expect(ops).toEqual([
      { path: ['nodes', 1], value: { id: 'b', name: 'API', kind: 'ingress', col: 2, row: 1, replicas: 2 } },
    ]);
    expect(errorsOf(apply(f, ops))).toEqual([]);
  });

  it('Replicas (block only) offers 1/2/3/5/custom with the current one checked', () => {
    const f = fixture('block');
    const items = menuFor({ type: 'node', index: 1 }, ctxFor('block', f));
    const rep = must(items.find((i) => i.label === 'Replicas'));
    expect(must(rep.children).map((c) => c.label)).toEqual(['1 (single)', '×2', '×3', '×5', 'Custom…']);
    expect(must(rep.children)[1]?.checked).toBe(true);
    // ×1 drops the key rather than writing `replicas: 1`.
    const one = must(must(rep.children)[0]?.op)();
    expect((one[0] as { value: Record<string, unknown> }).value['replicas']).toBeUndefined();
    expect(must(rep.children)[4]?.action).toEqual({ type: 'edit', path: 'nodes.1', field: 'replicas' });
    expect(menuFor({ type: 'node', index: 1 }, ctxFor('flow', fixture('flow'))).some((i) => i.label === 'Replicas')).toBe(false);
  });

  it('Add to group moves the node into the range; Remove from group moves it out', () => {
    const f = fixture('block'); // ns spans cols 1–2; node c sits at col 3
    const items = menuFor({ type: 'node', index: 2 }, ctxFor('block', f));
    const add = must(items.find((i) => i.label === 'Add to group'));
    expect(must(add.children).map((c) => c.label)).toEqual(['namespace']);
    // Cols 1 and 2 of the namespace are taken — nothing free inside.
    expect(must(add.children)[0]?.disabled).toBe(true);
    // Node b (inside) can leave: the nearest free cell outside every group.
    const inside = menuFor({ type: 'node', index: 1 }, ctxFor('block', f));
    const remove = must(inside.find((i) => i.label === 'Remove from group'));
    const ops = must(remove.op)();
    expect(ops).toEqual([
      { path: ['nodes', 1, 'col'], value: 4 },
      { path: ['nodes', 1, 'row'], value: 1 },
    ]);
    expect(errorsOf(apply(f, ops))).toEqual([]);
    // A flow node outside a 1×1 group with a free cell inside can join it.
    const ff = fixture('flow');
    const ctx = ctxFor('flow', ff, { placements: [{ col: 2, row: 2 }, { col: 3, row: 1 }], grid: { cols: 3, rows: 2 } });
    const join = must(menuFor({ type: 'node', index: 1 }, ctx).find((i) => i.label === 'Add to group'));
    const entry = must(must(join.children)[0]);
    expect(entry.disabled).not.toBe(true);
    expect(must(entry.op)()).toEqual([
      { path: ['nodes', 1, 'col'], value: 1 },
      { path: ['nodes', 1, 'row'], value: 1 },
    ]);
  });

  it('graph: groups are the per-node `group` number', () => {
    const f = fixture('graph');
    const items = menuFor({ type: 'node', index: 1 }, ctxFor('graph', f));
    const add = must(items.find((i) => i.label === 'Add to group'));
    expect(must(add.children).map((c) => c.label)).toEqual(['Group 1', 'New group 2']);
    expect(errorsOf(apply(f, must(must(add.children)[1]?.op)()))).toEqual([]);
    const a = menuFor({ type: 'node', index: 0 }, ctxFor('graph', f));
    const remove = must(a.find((i) => i.label === 'Remove from group'));
    const ops = must(remove.op)();
    expect((ops[0] as { value: Record<string, unknown> }).value['group']).toBeUndefined();
    expect(errorsOf(apply(f, ops))).toEqual([]);
  });

  it('cluster: Add node joins the origin cluster; Move to cluster re-seats it', () => {
    const f = fixture('cluster');
    const items = menuFor({ type: 'node', index: 0 }, ctxFor('cluster', f));
    expect(labels(items)).toEqual(['Add node', 'Change kind', 'Replicas', 'Move to cluster', 'Rename', 'Delete node']);
    const add = must(must(must(items[0]).children)[0]);
    const ops = must(add.op)();
    expect(ops[0]).toEqual({ path: ['services', 2], value: { id: 'n3', label: 'New service', kind: 'service', cluster: 'c1' } });
    expect(ops[1]).toEqual({ path: ['edges', 1], value: { from: 'a', to: 'n3' } });
    expect(expectAllOpsValid(f, items)).toBeGreaterThan(5);
  });

  it('Delete node removes the node AND its edges, fading both', () => {
    const f = fixture('block');
    const items = menuFor({ type: 'node', index: 1 }, ctxFor('block', f));
    const del = must(items[items.length - 1]);
    expect(del.danger).toBe(true);
    expect(del.fades).toEqual(['nodes.1', 'edges.0', 'edges.1']);
    const ops = must(del.op)();
    expect(ops).toHaveLength(2);
    const out = apply(f, ops);
    expect(errorsOf(out)).toEqual([]);
    expect(out).not.toContain('id: b');
    expect(out).not.toContain('to: b');
  });
});

describe('edge menu', () => {
  for (const kind of [...GRID_KINDS, 'cluster']) {
    it(`${kind}: kind/direction, edit text, reverse, delete — every op valid`, () => {
      const f = fixture(kind);
      const spec = must(specFor(kind));
      const items = menuFor({ type: 'edge', index: 0 }, ctxFor(kind, f));
      const names = labels(items);
      if (spec.edgeKinds !== undefined) expect(names[0]).toBe('Kind');
      else if (kind === 'graph') expect(names[0]).toBe('Direction');
      else expect(names[0]).toMatch(/^Edit /);
      expect(names).toContain(kind === 'state' ? 'Edit event' : 'Edit label');
      expect(names).toContain('Reverse');
      expect(names[names.length - 1]).toBe('Delete edge');
      expectAllOpsValid(f, items);
    });
  }

  it('Kind ▸ lists the schema enum, checks the current one, and writes the choice', () => {
    const f = fixture('block');
    const items = menuFor({ type: 'edge', index: 1 }, ctxFor('block', f));
    const kind = must(items[0]);
    expect(must(kind.children).map((c) => c.label)).toEqual(['Solid', 'Dashed', 'Forbidden', 'Error']);
    expect(must(kind.children)[1]?.checked).toBe(true);
    const ops = must(must(kind.children)[3]?.op)();
    expect(ops).toEqual([{ path: ['edges', 1], value: { from: 'b', to: 'c', kind: 'error' } }]);
    // Choosing the default (solid) drops the key.
    const solid = must(must(kind.children)[0]?.op)();
    expect((solid[0] as { value: Record<string, unknown> }).value['kind']).toBeUndefined();
  });

  it('Reverse swaps from/to; Delete is a single remove', () => {
    const f = fixture('flow');
    const items = menuFor({ type: 'edge', index: 0 }, ctxFor('flow', f));
    const rev = must(items.find((i) => i.label === 'Reverse'));
    expect(must(rev.op)()).toEqual([{ path: ['edges', 0], value: { from: 'b', to: 'a', label: 'go' } }]);
    const del = must(items[items.length - 1]);
    const ops = must(del.op)();
    expect(ops).toEqual([{ path: ['edges', 0], remove: true }]);
    const out = apply(f, ops);
    expect(errorsOf(out)).toEqual([]);
    expect(out).not.toContain('label: go');
  });
});

describe('empty cell / background / group', () => {
  it('cell: Insert node here ▸ (kinds, no edge) and Insert group here (1×1)', () => {
    const f = fixture('flow');
    const items = menuFor({ type: 'cell', col: 3, row: 2 }, ctxFor('flow', f));
    expect(labels(items)).toEqual(['Insert node here', 'Insert group here']);
    const ins = must(must(must(items[0]).children)[0]);
    const ops = must(ins.op)();
    expect(ops).toEqual([{ path: ['nodes', 2], value: { id: 'n3', label: 'New process', kind: 'process', col: 3, row: 2 } }]);
    expect(ins.then).toEqual({ select: 'nodes.2', edit: 'label' });
    const grp = must(must(items[1]).op)();
    expect(grp).toEqual([{ path: ['groups', 1], value: { col: 3, row: 2, cols: 1, rows: 1, label: 'Group' } }]);
    expectAllOpsValid(f, items);
    // graph: one kind → the insert is a direct leaf; no groups.
    const g = menuFor({ type: 'cell', col: 3, row: 1 }, ctxFor('graph', fixture('graph')));
    expect(labels(g)).toEqual(['Insert node here']);
    expect(must(g[0]).op).toBeDefined();
  });

  it('background: Insert node ▸ at the first free cell, Direction ▸ where the schema has dir, Open YAML', () => {
    for (const kind of GRID_KINDS) {
      const f = fixture(kind);
      const items = menuFor({ type: 'background' }, ctxFor(kind, f));
      const names = labels(items);
      expect(names[0]).toBe('Insert node');
      expect(names.includes('Direction'), kind).toBe(kind !== 'graph');
      expect(names[names.length - 1]).toBe('Open YAML');
      expect(must(items[items.length - 1]).action).toEqual({ type: 'openYaml' });
      expectAllOpsValid(f, items);
    }
    const f = fixture('flow');
    const dir = must(menuFor({ type: 'background' }, ctxFor('flow', f)).find((i) => i.label === 'Direction'));
    expect(must(dir.children).map((c) => [c.label, c.checked])).toEqual([
      ['Left → right', true],
      ['Top → bottom', false],
    ]);
    expect(must(must(dir.children)[1]?.op)()).toEqual([{ path: ['dir'], value: 'TB' }]);
  });

  it('group: rename + delete', () => {
    const f = fixture('flow');
    const items = menuFor({ type: 'group', index: 0 }, ctxFor('flow', f));
    expect(labels(items)).toEqual(['Rename', 'Delete group']);
    expectAllOpsValid(f, items);
  });

  it('a kind without connectors gets only Open YAML on the background, nothing on parts', () => {
    const ctx: MenuCtx = { kind: 'callout', data: { text: 'x' }, placements: null, grid: null, quick: false, selected: null };
    expect(labels(menuFor({ type: 'background' }, ctx))).toEqual(['Open YAML']);
    expect(menuFor({ type: 'node', index: 0 }, ctx)).toEqual([]);
  });
});

describe('sequence', () => {
  it('actor: add message (connect mode), add note, rename, delete actor with its messages', () => {
    const f = fixture('sequence');
    const items = menuFor({ type: 'actor', index: 1 }, ctxFor('sequence', f));
    expect(labels(items)).toEqual(['Add message from here…', 'Add note here', 'Rename', 'Delete actor']);
    expect(must(items[0]).action).toEqual({ type: 'connect', fromIndex: 1 });
    const note = must(must(items[1]).op)();
    expect(note).toEqual([{ path: ['messages', 3], value: { from: 'api', to: 'api', kind: 'note', label: 'note' } }]);
    expect(must(items[1]).then).toEqual({ select: 'messages.3', edit: 'label' });
    const del = must(items.find((i) => i.label === 'Delete actor'));
    expect(del.fades).toEqual(['actors.1', 'messages.0', 'messages.1', 'messages.2']);
    expectAllOpsValid(f, items);
    const out = apply(f, must(del.op)());
    expect(out).not.toContain('api');
  });

  it('message: kind ▸ / edit label / wrap ▸ / activate / deactivate / delete — every op valid', () => {
    const f = fixture('sequence');
    const items = menuFor({ type: 'message', index: 1 }, ctxFor('sequence', f));
    expect(labels(items)).toEqual(['Kind', 'Edit label', 'Add step note', 'Wrap in', 'Activate target', 'Deactivate sender', 'Delete']);
    const kind = must(items[0]);
    expect(must(kind.children).map((c) => c.label)).toEqual(['Sync', 'Response', 'Async', 'Error', 'Note']);
    expect(must(kind.children)[1]?.checked).toBe(true);
    const wrap = must(items[3]);
    expect(must(wrap.children).map((c) => c.label)).toEqual(['alt', 'opt', 'loop', 'par', 'break', 'critical']);
    expectAllOpsValid(f, items);
  });

  it('Wrap in ▸ alt inserts {frame} before and {end} after — the selected↔clicked range', () => {
    const f = fixture('sequence');
    // Message 0 selected, right-click on message 1 → wrap 0..1.
    const items = menuFor({ type: 'message', index: 1 }, ctxFor('sequence', f, { selected: 'messages.0' }));
    const wrap = must(items.find((i) => i.label.startsWith('Wrap in')));
    expect(wrap.label).toBe('Wrap in (2 messages)');
    const alt = must(must(wrap.children).find((c) => c.label === 'alt'));
    const ops = must(alt.op)();
    expect(ops).toHaveLength(1);
    const value = (ops[0] as { value: unknown[] }).value;
    expect(value.map((m) => Object.keys(m as object)[0])).toEqual(['frame', 'from', 'from', 'end', 'from']);
    expect(alt.then).toEqual({ select: 'messages.0', edit: 'label' });
    const out = apply(f, ops);
    expect(errorsOf(out)).toEqual([]);
    expect(out).toContain('frame: alt');
    expect(out).toContain('end: true');
    // No other selection → wraps just the clicked message.
    const single = must(menuFor({ type: 'message', index: 2 }, ctxFor('sequence', f)).find((i) => i.label.startsWith('Wrap')));
    expect(single.label).toBe('Wrap in');
    expect(wrapRange(['a', 'b', 'c'], 2, 2, 'opt')).toEqual(['a', 'b', { frame: 'opt', label: '' }, 'c', { end: true }]);
  });

  it('activate/deactivate toggle (checked state, key dropped when off)', () => {
    const f = fixture('sequence');
    const on = must(menuFor({ type: 'message', index: 2 }, ctxFor('sequence', f)).find((i) => i.label === 'Activate target'));
    expect(on.checked).toBe(true);
    const off = must(on.op)();
    expect((off[0] as { value: Record<string, unknown> }).value['activate']).toBeUndefined();
    const deact = must(menuFor({ type: 'message', index: 2 }, ctxFor('sequence', f)).find((i) => i.label === 'Deactivate sender'));
    expect(deact.checked).toBe(false);
    expect((must(deact.op)()[0] as { value: Record<string, unknown> }).value['deactivate']).toBe(true);
    expect(errorsOf(apply(f, must(deact.op)()))).toEqual([]);
  });

  it('a frame marker offers only its label and removal; the background adds actors', () => {
    const f = fixture('sequence');
    const wrapped = apply(f, [{ path: ['messages'], value: wrapRange((f.data as { messages: unknown[] }).messages, 0, 0, 'opt') }]);
    const doc = parseDocument(wrapped, 't');
    const seg = doc.segments[doc.segments.findIndex((s) => s.kind !== 'markdown')];
    if (seg === undefined || seg.kind === 'markdown') throw new Error('segment');
    const ctx: MenuCtx = { kind: 'sequence', data: seg.data, placements: null, grid: null, quick: false, selected: null };
    expect(labels(menuFor({ type: 'message', index: 0 }, ctx))).toEqual(['Edit label', 'Delete marker']);
    expect(labels(menuFor({ type: 'message', index: 2 }, ctx))).toEqual(['Delete marker']);
    const bg = menuFor({ type: 'background' }, ctxFor('sequence', f));
    expect(labels(bg)).toEqual(['Add actor', 'Open YAML']);
    expectAllOpsValid(f, bg);
  });
});

describe('erd', () => {
  it('entity: add column, add relation (connect mode), rename, delete entity with its relations', () => {
    const f = fixture('erd');
    const items = menuFor({ type: 'entity', index: 0 }, ctxFor('erd', f));
    expect(labels(items)).toEqual(['Add column', 'Add relation to…', 'Rename', 'Delete entity']);
    const add = must(items[0]);
    expect(must(add.op)()).toEqual([{ path: ['entities', 0, 'columns', 2], value: { name: 'new_column', type: 'text' } }]);
    expect(add.then).toEqual({ select: 'entities.0.columns.2', edit: 'name' });
    expect(must(items[1]).action).toEqual({ type: 'connect', fromIndex: 0 });
    const del = must(items.find((i) => i.label === 'Delete entity'));
    expect(del.fades).toEqual(['entities.0', 'relations.0']);
    expectAllOpsValid(f, items);
    expect(apply(f, must(del.op)())).not.toContain('Users');
  });

  it('column: pk / fk / unique / nullable / indexed toggles with checkmarks, rename, delete', () => {
    const f = fixture('erd');
    const items = menuFor({ type: 'column', entity: 0, index: 1 }, ctxFor('erd', f));
    expect(labels(items)).toEqual(['Primary key', 'Foreign key', 'Unique', 'Nullable', 'Indexed', 'Rename', 'Delete column']);
    const real = items.filter((i) => i.separator !== true);
    expect(real.map((i) => i.checked)).toEqual([false, false, true, false, false, undefined, undefined]);
    const unique = must(must(real[2]).op)(); // toggles OFF → key dropped
    expect(unique).toEqual([{ path: ['entities', 0, 'columns', 1], value: { name: 'email' } }]);
    const nullable = must(must(real[3]).op)();
    expect(nullable).toEqual([{ path: ['entities', 0, 'columns', 1], value: { name: 'email', unique: true, nullable: true } }]);
    const del = must(must(real[6]).op)();
    expect(del).toEqual([{ path: ['entities', 0, 'columns', 1], remove: true }]);
    expectAllOpsValid(f, items);
  });

  it('relation: cardinality ▸, edit label, reverse, delete; background: add entity / direction / yaml', () => {
    const f = fixture('erd');
    const rel = menuFor({ type: 'edge', index: 0 }, ctxFor('erd', f));
    expect(labels(rel)).toEqual(['Cardinality', 'Edit label', 'Reverse', 'Delete edge']);
    const card = must(rel[0]);
    expect(must(card.children).find((c) => c.label.startsWith('N:1'))?.checked).toBe(true);
    expectAllOpsValid(f, rel);
    const bg = menuFor({ type: 'background' }, ctxFor('erd', f));
    expect(labels(bg)).toEqual(['Add entity', 'Direction', 'Open YAML']);
    const ent = must(must(bg[0]).op)();
    expect(ent[0]?.path).toEqual(['entities', 2]);
    expectAllOpsValid(f, bg);
  });
});

describe('list-ordered kinds', () => {
  for (const k of LIST_KINDS) {
    it(`${k.kind}: item = move/duplicate/insert/delete, background = add + yaml, every op valid`, () => {
      const f = fixture(k.kind);
      const ctx = ctxFor(k.kind, f);
      const items = menuFor({ type: 'item', index: 1 }, ctx);
      expect(labels(items).slice(-6)).toEqual([
        ...k.move,
        'Duplicate',
        'Insert before',
        'Insert after',
        'Delete',
      ]);
      for (const leaf of flattenMenu(items)) {
        expect(leaf.op !== undefined || leaf.action !== undefined, leaf.label).toBe(true);
      }
      expect(expectAllOpsValid(f, items)).toBeGreaterThan(0);

      const bg = menuFor({ type: 'background' }, ctx);
      expect(labels(bg)).toEqual([`Add ${k.noun}`, 'Open YAML']);
      expect(must(bg[bg.length - 1]).action).toEqual({ type: 'openYaml' });
      const count = ((f.data as Record<string, unknown[]>)[k.field] ?? []).length;
      expect(must(bg[0]).then).toEqual({ select: `${k.field}.${count}`, edit: expect.any(String) });
      expectAllOpsValid(f, bg);

      // targetFor: an item (or any leaf inside it) is the item; else background.
      expect(targetFor(k.kind, `${k.field}.1`)).toEqual({ type: 'item', index: 1 });
      expect(targetFor(k.kind, `${k.field}.0.label`)).toEqual({ type: 'item', index: 0 });
      expect(targetFor(k.kind, 'title')).toEqual({ type: 'background' });
      expect(targetFor(k.kind, null)).toEqual({ type: 'background' });
    });
  }

  it('the ends disable their move; the schema bounds disable delete and the inserts', () => {
    const f = fixture('glossary');
    const first = menuFor({ type: 'item', index: 0 }, ctxFor('glossary', f));
    expect(must(first.find((i) => i.label === 'Move up')).disabled).toBe(true);
    expect(must(first.find((i) => i.label === 'Move down')).disabled).not.toBe(true);
    const last = menuFor({ type: 'item', index: 2 }, ctxFor('glossary', f));
    expect(must(last.find((i) => i.label === 'Move down')).disabled).toBe(true);
    expect(must(last.find((i) => i.label === 'Move up')).disabled).not.toBe(true);
    // takeaways at its schema max (6): no duplicate, no insert, no add.
    const full = fixture('takeaways');
    const items = menuFor({ type: 'item', index: 1 }, ctxFor('takeaways', full));
    expect(
      ['Duplicate', 'Insert before', 'Insert after'].map(
        (l) => must(items.find((i) => i.label === l)).disabled,
      ),
    ).toEqual([true, true, true]);
    expect(must(items.find((i) => i.label === 'Delete')).disabled).not.toBe(true);
    expect(must(menuFor({ type: 'background' }, ctxFor('takeaways', full))[0]).disabled).toBe(true);
    // …and at its minimum (2): no delete.
    const small = fixture('takeaways2');
    const tight = menuFor({ type: 'item', index: 0 }, ctxFor('takeaways', small));
    expect(must(tight.find((i) => i.label === 'Delete')).disabled).toBe(true);
    expect(must(tight.find((i) => i.label === 'Duplicate')).disabled).not.toBe(true);
  });

  it("Move is the drag layer's own splice, written as one whole-list set", () => {
    const f = fixture('list');
    const items = menuFor({ type: 'item', index: 0 }, ctxFor('list', f));
    const down = must(items.find((i) => i.label === 'Move down'));
    const ops = must(down.op)();
    const arr = (f.data as { items: unknown[] }).items;
    expect(ops).toEqual([{ path: ['items'], value: applyReorder(arr, 0, 2) }]);
    expect(down.then).toEqual({ select: 'items.1' });
    const out = apply(f, ops);
    expect(errorsOf(out)).toEqual([]);
    expect(out.indexOf('Second')).toBeLessThan(out.indexOf('First'));
  });

  it('Duplicate inserts the copy after the item and regenerates its id', () => {
    const f = fixture('saga');
    const items = menuFor({ type: 'item', index: 0 }, ctxFor('saga', f));
    const ops = must(must(items.find((i) => i.label === 'Duplicate')).op)();
    const list = (ops[0] as { value: Array<Record<string, unknown>> }).value;
    expect(list).toHaveLength(4);
    expect(list[1]?.['id']).toBe('reserve2');
    expect(list[1]?.['name']).toBe('Reserve stock');
    expect(errorsOf(apply(f, ops))).toEqual([]);
    // A kind whose items carry no id copies them verbatim.
    const g = fixture('glossary');
    const gops = must(
      must(menuFor({ type: 'item', index: 0 }, ctxFor('glossary', g)).find((i) => i.label === 'Duplicate')).op,
    )();
    expect((gops[0] as { value: unknown[] }).value[1]).toEqual({
      term: 'Saga',
      def: 'A transaction split across services',
    });
  });

  it('Insert before / after seed a blank item and open its main field', () => {
    const f = fixture('team');
    const items = menuFor({ type: 'item', index: 1 }, ctxFor('team', f));
    const before = must(items.find((i) => i.label === 'Insert before'));
    const ops = must(before.op)();
    expect((ops[0] as { value: unknown[] }).value[1]).toEqual({ name: 'New member' });
    expect(before.then).toEqual({ select: 'members.1', edit: 'name' });
    expect(errorsOf(apply(f, ops))).toEqual([]);
    // `Insert after` on the LAST item is an append — one index, not a rewrite.
    const after = must(items.find((i) => i.label === 'Insert after'));
    expect(after.then).toEqual({ select: 'members.2', edit: 'name' });
    const afterOps = must(after.op)();
    expect(afterOps).toEqual([{ path: ['members', 2], value: { name: 'New member' } }]);
    expect(errorsOf(apply(f, afterOps))).toEqual([]);
  });

  it('saga: the failure point toggles, and Status ▸ checks the derived one', () => {
    const f = fixture('saga');
    const ctx = ctxFor('saga', f);
    const failing = menuFor({ type: 'item', index: 1 }, ctx);
    expect(labels(failing)).toEqual([
      'Clear failure point',
      'Status',
      'Move left',
      'Move right',
      'Duplicate',
      'Insert before',
      'Insert after',
      'Delete',
    ]);
    const clear = must(failing[0]);
    expect(clear.checked).toBe(true);
    expect(must(clear.op)()).toEqual([{ path: ['failAt'], remove: true }]);
    const cleared = apply(f, must(clear.op)());
    expect(errorsOf(cleared)).toEqual([]);
    expect(cleared).not.toContain('failAt');
    // Another step takes the failure over.
    const set = must(menuFor({ type: 'item', index: 2 }, ctx)[0]);
    expect([set.label, set.checked]).toEqual(['Set as failure point', false]);
    const out = apply(f, must(set.op)());
    expect(errorsOf(out)).toEqual([]);
    expect(out).toContain('failAt: ship');
    // The checkmark tracks the DERIVED status: before / at / after the failure.
    const statusOf = (i: number): string | undefined =>
      must(must(menuFor({ type: 'item', index: i }, ctx).find((x) => x.label === 'Status')).children).find(
        (c) => c.checked === true,
      )?.label;
    expect([0, 1, 2].map(statusOf)).toEqual(['Compensated', 'Failed', 'Skipped']);
    // Only the step that has a compensation offers to drop it.
    expect(labels(menuFor({ type: 'item', index: 0 }, ctx))).toContain('Remove compensation');
    const drop = must(menuFor({ type: 'item', index: 0 }, ctx).find((i) => i.label === 'Remove compensation'));
    expect(apply(f, must(drop.op)())).not.toContain('release stock');
  });

  it('saga: deleting the failing step drops the dangling failAt in the same write', () => {
    const f = fixture('saga');
    const ctx = ctxFor('saga', f);
    const del = must(menuFor({ type: 'item', index: 1 }, ctx).find((i) => i.label === 'Delete'));
    const ops = must(del.op)();
    expect(isHomogeneous(ops)).toBe(true);
    const out = apply(f, ops);
    expect(errorsOf(out)).toEqual([]);
    expect(out).not.toContain('failAt');
    expect(out).not.toContain('charge');
    // A step the failure does not name is a plain remove.
    const other = must(menuFor({ type: 'item', index: 2 }, ctx).find((i) => i.label === 'Delete'));
    expect(must(other.op)()).toEqual([{ path: ['steps', 2], remove: true }]);
    expect(errorsOf(apply(f, must(other.op)()))).toEqual([]);
  });

  it('stats: Trend ▸ writes the schema enum; None drops the key', () => {
    const f = fixture('stats');
    const ctx = ctxFor('stats', f);
    const trend = must(menuFor({ type: 'item', index: 0 }, ctx).find((i) => i.label === 'Trend'));
    expect(must(trend.children).map((c) => [c.label, c.checked])).toEqual([
      ['Up', true],
      ['Down', false],
      ['Flat', false],
      ['None', false],
    ]);
    const none = must(must(trend.children).find((c) => c.label === 'None'));
    expect((must(none.op)()[0] as { value: Record<string, unknown> }).value['trend']).toBeUndefined();
    expect(errorsOf(apply(f, must(none.op)()))).toEqual([]);
    const bare = must(menuFor({ type: 'item', index: 1 }, ctx).find((i) => i.label === 'Trend'));
    expect(must(bare.children).find((c) => c.checked === true)?.label).toBe('None');
    // No other list kind grows extras above the generic block.
    expect(labels(menuFor({ type: 'item', index: 0 }, ctxFor('agenda', fixture('agenda'))))[0]).toBe('Move up');
    expect(labels(menuFor({ type: 'item', index: 0 }, ctxFor('team', fixture('team'))))[0]).toBe('Move up');
  });
});

describe('reachability + homogeneity across every target', () => {
  const targets: Array<[string, MenuTarget]> = [
    ...GRID_KINDS.flatMap((k): Array<[string, MenuTarget]> => [
      [k, { type: 'node', index: 0 }],
      [k, { type: 'edge', index: 0 }],
      [k, { type: 'cell', col: 3, row: 3 }],
      [k, { type: 'background' }],
    ]),
    ['cluster', { type: 'node', index: 1 }],
    ['cluster', { type: 'edge', index: 0 }],
    ['sequence', { type: 'actor', index: 0 }],
    ['sequence', { type: 'message', index: 0 }],
    ['sequence', { type: 'background' }],
    ['erd', { type: 'entity', index: 1 }],
    ['erd', { type: 'column', entity: 1, index: 1 }],
    ['erd', { type: 'edge', index: 0 }],
    ['erd', { type: 'background' }],
    ...LIST_KINDS.flatMap((k): Array<[string, MenuTarget]> => [
      [k.kind, { type: 'item', index: 0 }],
      [k.kind, { type: 'background' }],
    ]),
  ];
  for (const [kind, target] of targets) {
    it(`${kind}/${target.type}: every leaf is ≤ 2 levels deep, carries an op or an action, and its ops are one-step`, () => {
      const f = fixture(kind);
      const items = menuFor(target, ctxFor(kind, f));
      expect(items.length).toBeGreaterThan(0);
      const depth = (list: readonly MenuItem[], d: number): number =>
        Math.max(d, ...list.map((i) => (i.children !== undefined ? depth(i.children, d + 1) : d)));
      expect(depth(items, 1)).toBeLessThanOrEqual(2); // right-click + ≤ 2 clicks
      for (const leaf of flattenMenu(items)) {
        expect(leaf.op !== undefined || leaf.action !== undefined, leaf.label).toBe(true);
      }
      expectAllOpsValid(f, items);
    });
  }
});
