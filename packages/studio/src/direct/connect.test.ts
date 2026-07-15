import { describe, expect, it } from 'vitest';
import { parseDocument, validateDocument } from '@avodado/core';
import {
  defaultWriteCell,
  edgeIndexFromPath,
  edgeOp,
  newNodeOps,
  nodeIndexFromPath,
  nodeLabel,
  specFor,
  uniqueNodeId,
} from './connect.js';
import { setPathsInSegment } from './host.js';
import { gridMoveSets, type PathSet } from './drag.js';

/** Narrows away null/undefined (the test asserts the value exists). */
function must<T>(v: T | null | undefined): T {
  if (v === null || v === undefined) throw new Error('expected a value');
  return v;
}

/** Fence bodies with two connected nodes per connectable kind. */
const FENCES: Readonly<Record<string, string>> = {
  flow: [
    '```flow',
    'nodes:',
    '  - { id: a, label: Start, kind: start, col: 1, row: 1 }',
    '  - { id: b, label: Work, kind: process, col: 2, row: 1 }',
    'edges:',
    '  - { from: a, to: b }',
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
    'nodes:',
    '  - { id: a, name: Client, kind: client, col: 1, row: 1 }',
    '  - { id: b, name: API, kind: service, col: 2, row: 1 }',
    'edges:',
    '  - { from: a, to: b }',
    '```',
  ].join('\n'),
  graph: [
    '```graph',
    'nodes:',
    '  - { id: a, label: Alpha, col: 1, row: 1 }',
    '  - { id: b, label: Beta, col: 2, row: 1 }',
    'edges:',
    '  - { from: a, to: b }',
    '```',
  ].join('\n'),
  swimlane: [
    '```swimlane',
    'lanes:',
    '  - { label: Customer }',
    '  - { label: Support }',
    'steps:',
    '  - { id: a, col: 1, lane: 0, label: Report issue }',
    '  - { id: b, col: 2, lane: 1, label: Triage }',
    'links:',
    '  - { from: a, to: b }',
    '```',
  ].join('\n'),
};

const KINDS = Object.keys(FENCES);

/** The sequence fence — no grid, so it sits outside the KINDS loops. */
const SEQ_FENCE = [
  '```sequence',
  'actors:',
  '  - { id: web, name: Web }',
  '  - { id: api, name: API }',
  'messages:',
  '  - { from: web, to: api, label: request }',
  '```',
].join('\n');

function seqFixture(): { data: unknown; apply: (sets: readonly PathSet[]) => string } {
  const source = `# T\n\n${SEQ_FENCE}\n`;
  const doc = parseDocument(source, 't');
  const idx = doc.segments.findIndex((s) => s.kind !== 'markdown');
  const seg = doc.segments[idx];
  if (seg === undefined || seg.kind === 'markdown') throw new Error('fixture segment missing');
  return { data: seg.data, apply: (sets) => setPathsInSegment(source, doc, idx, sets) };
}

/** The ERD fence — name-keyed entities, `relations` with a cardinality field. */
const ERD_FENCE = [
  '```erd',
  'entities:',
  '  - { name: Users, columns: [ { name: id, pk: true } ] }',
  '  - { name: Orders, columns: [ { name: id, pk: true }, { name: user_id, fk: true } ] }',
  'relations:',
  '  - { from: Orders, to: Users, card: "N:1" }',
  '```',
].join('\n');

function erdFixture(): { data: unknown; apply: (sets: readonly PathSet[]) => string } {
  const source = `# T\n\n${ERD_FENCE}\n`;
  const doc = parseDocument(source, 't');
  const idx = doc.segments.findIndex((s) => s.kind !== 'markdown');
  const seg = doc.segments[idx];
  if (seg === undefined || seg.kind === 'markdown') throw new Error('fixture segment missing');
  return { data: seg.data, apply: (sets) => setPathsInSegment(source, doc, idx, sets) };
}

/** Parses the kind's fence doc and returns its data + an ops applier. */
function fixture(kind: string): { data: unknown; apply: (sets: readonly PathSet[]) => string } {
  const source = `# T\n\n${must(FENCES[kind])}\n`;
  const doc = parseDocument(source, 't');
  const idx = doc.segments.findIndex((s) => s.kind !== 'markdown');
  const seg = doc.segments[idx];
  if (seg === undefined || seg.kind === 'markdown') throw new Error('fixture segment missing');
  return {
    data: seg.data,
    apply: (sets) => setPathsInSegment(source, doc, idx, sets),
  };
}

/** Error-level diagnostics after re-parsing an edited source. */
function errorsOf(source: string): string[] {
  const doc = parseDocument(source, 't');
  return validateDocument(doc, 't.md')
    .filter((d) => d.level === 'error')
    .map((d) => `${d.code}: ${d.message}`);
}

describe('specFor', () => {
  it('covers the connectable kinds (sequence messages, ERD relations); nothing else', () => {
    for (const k of KINDS) expect(specFor(k), k).not.toBeNull();
    expect(specFor('sequence')).not.toBeNull();
    expect(specFor('erd')).not.toBeNull(); // entities → relations, cardinality picker
    expect(specFor('uml')).toBeNull();
    expect(specFor('cycle')).toBeNull(); // ring reorder, not connect
  });

  it('flags the grid/groups capabilities per kind', () => {
    for (const k of ['flow', 'dfd', 'state', 'c4', 'block']) {
      const s = must(specFor(k));
      expect(s.gridNodes, k).toBe(true);
      expect(s.groups, k).toBe(true);
    }
    const graph = must(specFor('graph'));
    expect(graph.gridNodes).toBe(true);
    expect(graph.groups).toBe(false);
    expect(graph.nodeKinds).toHaveLength(1); // picker-less empty-canvas drop
    const swim = must(specFor('swimlane'));
    expect(swim.gridNodes).toBe(true);
    expect(swim.groups).toBe(false);
    expect(swim.growRows).toBe(false); // lanes are a labelled list
    const seq = must(specFor('sequence'));
    expect(seq.gridNodes).toBe(false);
    expect(seq.groups).toBe(false);
    expect(seq.nodeKinds).toHaveLength(0);
    expect(seq.newNode).toBeUndefined();
  });

  it("maps node selections through each kind's node-list field", () => {
    const flow = must(specFor('flow'));
    const state = must(specFor('state'));
    const swim = must(specFor('swimlane'));
    const seq = must(specFor('sequence'));
    expect(nodeIndexFromPath(flow, 'nodes.2')).toBe(2);
    expect(nodeIndexFromPath(flow, 'nodes.2.label')).toBeNull();
    expect(nodeIndexFromPath(flow, 'edges.0')).toBeNull();
    expect(nodeIndexFromPath(state, 'states.1')).toBe(1);
    expect(nodeIndexFromPath(state, 'nodes.1')).toBeNull();
    expect(nodeIndexFromPath(swim, 'steps.0')).toBe(0);
    expect(nodeIndexFromPath(seq, 'actors.1')).toBe(1);
    expect(nodeIndexFromPath(seq, 'messages.0')).toBeNull();
  });
});

describe('edgeOp', () => {
  for (const kind of KINDS) {
    it(`${kind}: appends a schema-valid edge (validateDocument stays clean)`, () => {
      const spec = must(specFor(kind));
      const f = fixture(kind);
      const sets = must(edgeOp(spec, f.data, 'b', 'a'));
      expect(sets).toHaveLength(1);
      expect(sets[0]?.path).toEqual([spec.edgesField, 1]);
      expect(errorsOf(f.apply(sets))).toEqual([]);
    });

    it(`${kind}: rejects a duplicate of an existing edge`, () => {
      const spec = must(specFor(kind));
      const f = fixture(kind);
      expect(edgeOp(spec, f.data, 'a', 'b')).toBeNull();
    });
  }

  it('rejects self-loops except on state machines', () => {
    for (const kind of KINDS.filter((k) => k !== 'state')) {
      const f = fixture(kind);
      expect(edgeOp(must(specFor(kind)), f.data, 'a', 'a'), kind).toBeNull();
    }
    const f = fixture('state');
    const sets = must(edgeOp(must(specFor('state')), f.data, 'a', 'a'));
    expect(errorsOf(f.apply(sets))).toEqual([]);
  });

  it('state: seeds the required transition event as an empty string', () => {
    const f = fixture('state');
    const sets = must(edgeOp(must(specFor('state')), f.data, 'b', 'a'));
    expect(sets[0]?.value).toEqual({ from: 'b', to: 'a', event: '' });
  });
});

describe('erd relations (name-keyed entities, cardinality picker)', () => {
  it('maps entity selections and carries the cardinality contract', () => {
    const spec = must(specFor('erd'));
    expect(spec.idField).toBe('name'); // entities have no `id`
    expect(spec.edgesField).toBe('relations');
    expect(spec.gridNodes).toBe(false); // dagre auto-layout, no empty-canvas node
    expect(spec.nodeKinds).toHaveLength(0);
    expect(spec.newNode).toBeUndefined();
    expect(spec.edgeChoiceField).toBe('card');
    expect(spec.edgeChoices?.map((c) => c.value)).toEqual(['1:1', '1:N', 'N:1', 'N:M']);
    expect(nodeIndexFromPath(spec, 'entities.1')).toBe(1);
    expect(nodeIndexFromPath(spec, 'entities.1.columns.0')).toBeNull();
    expect(nodeLabel(spec, erdFixture().data, 'Orders')).toBe('Orders');
  });

  it('appends a schema-valid relation with the chosen cardinality', () => {
    const spec = must(specFor('erd'));
    const f = erdFixture();
    const sets = must(edgeOp(spec, f.data, 'Users', 'Orders', { card: '1:N' }));
    expect(sets).toHaveLength(1);
    expect(sets[0]?.path).toEqual(['relations', 1]);
    expect(sets[0]?.value).toEqual({ from: 'Users', to: 'Orders', card: '1:N' });
    expect(errorsOf(f.apply(sets))).toEqual([]);
  });

  it('rejects a duplicate relation in the same direction', () => {
    const spec = must(specFor('erd'));
    const f = erdFixture();
    expect(edgeOp(spec, f.data, 'Orders', 'Users', { card: '1:1' })).toBeNull();
    // The reverse direction is a different relation — allowed.
    expect(edgeOp(spec, f.data, 'Users', 'Orders', { card: '1:N' })).not.toBeNull();
  });
});

describe('newNodeOps', () => {
  for (const kind of KINDS) {
    const spec = must(specFor(kind));
    for (const choice of spec.nodeKinds) {
      it(`${kind}/${choice.kind}: creates a schema-valid node + edge`, () => {
        const f = fixture(kind);
        const r = must(newNodeOps(spec, f.data, 'b', { col: 3, row: 1 }, choice.kind));
        expect(r.id).toBe('n3');
        expect(r.nodePath).toBe(`${spec.nodesField}.2`);
        expect(r.materialized).toBe(false);
        // Node append + edge append, nothing else (fully placed diagram).
        expect(r.sets).toHaveLength(2);
        expect(errorsOf(f.apply(r.sets))).toEqual([]);
      });
    }
  }

  it('rejects unknown kinds and unresolvable origins', () => {
    const f = fixture('flow');
    const spec = must(specFor('flow'));
    expect(newNodeOps(spec, f.data, 'b', { col: 3, row: 1 }, 'nope')).toBeNull();
    expect(newNodeOps(spec, f.data, 'ghost', { col: 3, row: 1 }, 'process')).toBeNull();
  });

  it('skips auto ids already in use', () => {
    const spec = must(specFor('flow'));
    expect(uniqueNodeId(spec, { nodes: [{ id: 'n1' }, { id: 'n3' }] })).toBe('n4');
    expect(uniqueNodeId(spec, { nodes: [{ id: 'a' }, { id: 'b' }] })).toBe('n3');
  });

  it('materializes effective placements when the diagram was auto-laid-out', () => {
    const spec = must(specFor('flow'));
    const source = [
      '# T',
      '',
      '```flow',
      'nodes:',
      '  - { id: a, label: A }',
      '  - { id: b, label: B }',
      'edges:',
      '  - { from: a, to: b }',
      '```',
      '',
    ].join('\n');
    const doc = parseDocument(source, 't');
    const idx = doc.segments.findIndex((s) => s.kind !== 'markdown');
    const seg = doc.segments[idx];
    if (seg === undefined || seg.kind === 'markdown') throw new Error('segment missing');
    const r = must(
      newNodeOps(spec, seg.data, 'b', { col: 2, row: 2 }, 'process', [
        { col: 1, row: 1 },
        { col: 2, row: 1 },
      ]),
    );
    expect(r.materialized).toBe(true);
    // 2 nodes × col+row, then the node append and the edge append.
    expect(r.sets).toHaveLength(6);
    expect(r.sets[0]).toEqual({ path: ['nodes', 0, 'col'], value: 1 });
    expect(errorsOf(setPathsInSegment(source, doc, idx, r.sets))).toEqual([]);
    // No materialization without placements — the drop still commits.
    const bare = must(newNodeOps(spec, seg.data, 'b', { col: 2, row: 2 }, 'process'));
    expect(bare.materialized).toBe(false);
    expect(bare.sets).toHaveLength(2);
  });

  it('labels resolve through the spec (fallback to the id)', () => {
    const f = fixture('flow');
    const spec = must(specFor('flow'));
    expect(nodeLabel(spec, f.data, 'a')).toBe('Start');
    expect(nodeLabel(spec, f.data, 'ghost')).toBe('ghost');
    const s = fixture('state');
    expect(nodeLabel(must(specFor('state')), s.data, 'b')).toBe('Live');
  });

  it('sequence: no empty-canvas creation (no newNode in the spec)', () => {
    const spec = must(specFor('sequence'));
    const f = seqFixture();
    expect(newNodeOps(spec, f.data, 'web', { col: 3, row: 1 }, 'node')).toBeNull();
  });
});

describe('grid node moves — spec-driven, through the real pipeline', () => {
  for (const kind of KINDS) {
    it(`${kind}: a drag/arrow move writes valid position fields`, () => {
      const spec = must(specFor(kind));
      const f = fixture(kind);
      // The fences place node 0 at (1,1); swimlane's second step sits in lane 1.
      const placements =
        kind === 'swimlane'
          ? [{ col: 1, row: 1 }, { col: 2, row: 2 }]
          : [{ col: 1, row: 1 }, { col: 2, row: 1 }];
      const r = must(
        gridMoveSets({
          placements,
          index: 0,
          target: { col: 3, row: 2 },
          quick: false,
          field: spec.nodesField,
          writeCell: spec.writeCell ?? defaultWriteCell,
        }),
      );
      // Position writes only, into the kind's own node list.
      for (const set of r.sets) expect(set.path[0], kind).toBe(spec.nodesField);
      expect(errorsOf(f.apply(r.sets)), kind).toEqual([]);
    });
  }

  it('swimlane: the writes are col + 0-based lane (never `row`)', () => {
    const spec = must(specFor('swimlane'));
    const r = must(
      gridMoveSets({
        placements: [{ col: 1, row: 1 }],
        index: 0,
        target: { col: 2, row: 2 },
        quick: false,
        field: spec.nodesField,
        writeCell: spec.writeCell ?? defaultWriteCell,
      }),
    );
    expect(r.sets).toEqual([
      { path: ['steps', 0, 'col'], value: 2 },
      { path: ['steps', 0, 'lane'], value: 1 },
    ]);
  });
});

describe('sequence messages (drag from an actor dot)', () => {
  const spec = must(specFor('sequence'));

  it('appends a schema-valid message and stays clean', () => {
    const f = seqFixture();
    const sets = must(edgeOp(spec, f.data, 'api', 'web'));
    expect(sets[0]?.path).toEqual(['messages', 1]);
    expect(sets[0]?.value).toEqual({ from: 'api', to: 'web', label: 'message' });
    expect(errorsOf(f.apply(sets))).toEqual([]);
    // The spec opens the micro-editor on the new message's label.
    expect(spec.editEdgeOnConnect).toBe(true);
    expect(spec.edgeTextField).toBe('label');
  });

  it('repeats are allowed — the same direction appends another message', () => {
    const f = seqFixture();
    const sets = must(edgeOp(spec, f.data, 'web', 'api')); // duplicate of messages.0
    expect(sets[0]?.path).toEqual(['messages', 1]);
    expect(errorsOf(f.apply(sets))).toEqual([]);
  });

  it('a self-drop becomes a note on that actor (from == to, kind: note)', () => {
    const f = seqFixture();
    const sets = must(edgeOp(spec, f.data, 'web', 'web'));
    expect(sets[0]?.value).toEqual({ from: 'web', to: 'web', kind: 'note', label: 'note' });
    expect(errorsOf(f.apply(sets))).toEqual([]);
  });
});

describe('edge text — the arrow label the micro-editor edits', () => {
  it('maps each kind to its edge text field, and paths to edge indices', () => {
    for (const k of ['flow', 'dfd', 'c4', 'block', 'graph', 'swimlane']) {
      expect(must(specFor(k)).edgeTextField, k).toBe('label');
    }
    expect(must(specFor('state')).edgeTextField).toBe('event');
    expect(must(specFor('sequence')).edgeTextField).toBe('label');
    const flow = must(specFor('flow'));
    expect(edgeIndexFromPath(flow, 'edges.2')).toBe(2);
    expect(edgeIndexFromPath(flow, 'edges.2.label')).toBeNull();
    expect(edgeIndexFromPath(flow, 'nodes.2')).toBeNull();
    expect(edgeIndexFromPath(must(specFor('state')), 'transitions.0')).toBe(0);
    expect(edgeIndexFromPath(must(specFor('swimlane')), 'links.1')).toBe(1);
    expect(edgeIndexFromPath(must(specFor('sequence')), 'messages.3')).toBe(3);
  });

  for (const kind of KINDS) {
    it(`${kind}: ADDING text to a bare edge stays schema-valid`, () => {
      const spec = must(specFor(kind));
      const f = fixture(kind);
      const edited = f.apply([{ path: [spec.edgesField, 0, spec.edgeTextField], value: 'Yes' }]);
      expect(errorsOf(edited), kind).toEqual([]);
    });
  }

  it('state: a guard can ride along with the edited event', () => {
    const f = fixture('state');
    const edited = f.apply([
      { path: ['transitions', 0, 'event'], value: 'approve' },
      { path: ['transitions', 0, 'guard'], value: '[valid]' },
    ]);
    expect(errorsOf(edited)).toEqual([]);
  });

  it('sequence: labeling an existing message stays valid', () => {
    const f = seqFixture();
    expect(errorsOf(f.apply([{ path: ['messages', 0, 'label'], value: 'fetch' }]))).toEqual([]);
  });
});
