/**
 * Validation tests for the 28 blocks added across v1 phases 2-5.
 *
 * For each block: a happy-path doc validates clean, and a representative
 * schema violation produces an `E_SCHEMA` diagnostic with the right line.
 */

import { describe, expect, it } from 'vitest';
import { parseDocument } from '../parser.js';
import { validateDocument } from '../validate.js';

function wrap(blockMd: string): string {
  return blockMd.trim() + '\n';
}

function diagsFor(md: string): ReturnType<typeof validateDocument> {
  const doc = parseDocument(wrap(md), 'tmp');
  return validateDocument(doc, 'tmp.md');
}

describe('Phase 2 blocks — validation', () => {
  it('prose validates with typed sub-blocks', () => {
    expect(
      diagsFor(
        '```prose\nblocks:\n  - { type: h, text: Hello }\n  - { type: p, text: A paragraph. }\n  - { type: ul, items: [a, b] }\n```',
      ),
    ).toEqual([]);
  });

  it('glossary validates a list of terms', () => {
    expect(
      diagsFor('```glossary\nterms:\n  - { term: SLO, def: Service-level objective. }\n```'),
    ).toEqual([]);
  });

  it('proscons validates pros + cons + custom labels', () => {
    expect(
      diagsFor(
        '```proscons\nprosLabel: Sync\nconsLabel: Async\npros: [Easy]\ncons: [Slower]\n```',
      ),
    ).toEqual([]);
  });

  it('cvt validates current + target panels', () => {
    expect(
      diagsFor(
        '```cvt\ncurrent: { label: Now, items: [a, b] }\ntarget: { label: Later, items: [c, d] }\n```',
      ),
    ).toEqual([]);
  });

  it('stats validates with delta + trend', () => {
    expect(
      diagsFor(
        '```stats\nstats:\n  - { value: 100, label: count, delta: "+5", trend: up }\n```',
      ),
    ).toEqual([]);
  });

  it('stats rejects invalid trend', () => {
    const d = diagsFor('```stats\nstats:\n  - { value: 100, label: x, trend: sideways }\n```');
    expect(d[0]?.code).toBe('E_SCHEMA');
    expect(d[0]?.message).toContain('trend');
  });

  it('code validates blocks list', () => {
    expect(
      diagsFor('```code\nblocks:\n  - { title: x.ts, lang: TS, code: "const x = 1;" }\n```'),
    ).toEqual([]);
  });

  it('agenda validates rows with optional fields', () => {
    expect(
      diagsFor(
        '```agenda\nitems:\n  - { time: "09:00", duration: 30m, title: Standup, owner: Host }\n```',
      ),
    ).toEqual([]);
  });

  it('tree validates parent/child nodes', () => {
    expect(
      diagsFor(
        '```tree\nnodes:\n  - { id: src, label: src }\n  - { id: lib, parent: src, label: lib, note: utils }\n```',
      ),
    ).toEqual([]);
  });

  it('pyramid validates levels', () => {
    expect(
      diagsFor('```pyramid\nlevels:\n  - { label: Vision }\n  - { label: Tactics, desc: Q1 }\n```'),
    ).toEqual([]);
  });

  it('funnel validates stages', () => {
    expect(
      diagsFor('```funnel\nstages:\n  - { label: Top, value: 1000 }\n  - { label: Bot, value: 50 }\n```'),
    ).toEqual([]);
  });
});

describe('Phase 3 blocks — validation', () => {
  it('flow validates nodes + edges', () => {
    expect(
      diagsFor(
        '```flow\nnodes:\n  - { id: a, col: 1, row: 1, kind: start, label: Start }\n  - { id: b, col: 2, row: 1, kind: end, label: End }\nedges:\n  - { from: a, to: b }\n```',
      ),
    ).toEqual([]);
  });

  it('flow rejects unknown node kind', () => {
    const d = diagsFor(
      '```flow\nnodes:\n  - { id: a, col: 1, row: 1, kind: weird, label: x }\n```',
    );
    expect(d[0]?.code).toBe('E_SCHEMA');
    expect(d[0]?.message).toContain('kind');
  });

  it('state validates states + transitions', () => {
    expect(
      diagsFor(
        '```state\nstates:\n  - { id: s, col: 1, row: 1, kind: active, name: Live }\n  - { id: e, col: 2, row: 1, kind: terminal }\ntransitions:\n  - { from: s, to: e, event: close }\n```',
      ),
    ).toEqual([]);
  });

  it('dfd validates process/store/external nodes', () => {
    expect(
      diagsFor(
        '```dfd\nnodes:\n  - { id: u, col: 1, row: 1, kind: external, name: User }\n  - { id: p, col: 2, row: 1, kind: process, name: Handle, num: 1 }\nedges:\n  - { from: u, to: p }\n```',
      ),
    ).toEqual([]);
  });

  it('journey validates stages + rows + emotion', () => {
    expect(
      diagsFor(
        '```journey\nstages: [{ label: A }, { label: B }]\nrows:\n  - { label: Touchpoint, cells: [Email, Web] }\nemotion: [0.5, 0.8]\n```',
      ),
    ).toEqual([]);
  });

  it('gantt validates tasks across periods', () => {
    expect(
      diagsFor(
        '```gantt\nperiods: [Q1, Q2]\ntasks:\n  - { label: Build, start: 0, span: 1, kind: done }\n  - { label: Ship, start: 1, span: 1, kind: milestone }\n```',
      ),
    ).toEqual([]);
  });

  it('graph validates node-link with group + direction', () => {
    expect(
      diagsFor(
        '```graph\nnodes:\n  - { id: a, col: 1, row: 1, label: A, group: 0 }\n  - { id: b, col: 2, row: 1, label: B, group: 1 }\nedges:\n  - { from: a, to: b, dir: undirected }\n```',
      ),
    ).toEqual([]);
  });

  it('quadrant validates axes + items', () => {
    expect(
      diagsFor(
        '```quadrant\nxAxis: { label: X, low: lo, high: hi }\nyAxis: { label: Y }\nitems:\n  - { x: 0.3, y: 0.7, label: Pt }\n```',
      ),
    ).toEqual([]);
  });

  it('swimlane validates lanes + steps + links', () => {
    expect(
      diagsFor(
        '```swimlane\nlanes: [{ label: A }, { label: B }]\nsteps:\n  - { id: s1, col: 1, lane: 0, kind: start, label: Start }\n  - { id: s2, col: 2, lane: 1, label: Do }\nlinks:\n  - { from: s1, to: s2 }\n```',
      ),
    ).toEqual([]);
  });
});

describe('Phase 4 blocks — validation', () => {
  it('c4 validates with required `kind` on each node', () => {
    expect(
      diagsFor(
        '```c4\nlevel: container\nnodes:\n  - { id: u, col: 1, row: 1, kind: person, name: User }\n  - { id: s, col: 2, row: 1, kind: system, name: App }\nedges:\n  - { from: u, to: s }\n```',
      ),
    ).toEqual([]);
  });

  it('c4 rejects an unknown kind', () => {
    const d = diagsFor(
      '```c4\nnodes:\n  - { id: u, col: 1, row: 1, kind: bogus, name: x }\n```',
    );
    expect(d[0]?.code).toBe('E_SCHEMA');
  });

  it('uml validates classes with attrs/methods/stereotype', () => {
    expect(
      diagsFor(
        '```uml\nclasses:\n  - { id: o, col: 1, row: 1, name: Order, attrs: ["id"], methods: ["place()"] }\n  - { id: s, col: 1, row: 2, name: Status, stereotype: enumeration, attrs: ["A"] }\nrels:\n  - { from: o, to: s, kind: association }\n```',
      ),
    ).toEqual([]);
  });

  it('uml rejects an unknown rel kind', () => {
    const d = diagsFor(
      '```uml\nclasses:\n  - { id: a, col: 1, row: 1, name: A }\n  - { id: b, col: 2, row: 1, name: B }\nrels:\n  - { from: a, to: b, kind: bogus }\n```',
    );
    expect(d.some((x) => x.code === 'E_SCHEMA' && x.message.includes('kind'))).toBe(true);
  });

  it('mece validates parent/child issue tree', () => {
    expect(
      diagsFor(
        '```mece\nnodes:\n  - { id: root, label: Why }\n  - { id: a, parent: root, label: Cause A }\n  - { id: b, parent: root, label: Cause B, note: detail }\n```',
      ),
    ).toEqual([]);
  });

  it('frontend validates component tree with optional kinds', () => {
    expect(
      diagsFor(
        '```frontend\nnodes:\n  - { id: app, kind: root, name: App }\n  - { id: layout, parent: app, kind: layout, name: Layout }\n  - { id: hook, parent: layout, kind: hook, name: useX, note: state }\n```',
      ),
    ).toEqual([]);
  });

  it('cluster validates namespaces + services + replicas + edges', () => {
    expect(
      diagsFor(
        '```cluster\nclusters:\n  - { id: api, label: api, kind: namespace }\nservices:\n  - { id: web, cluster: api, label: web, kind: service, tech: Next, replicas: 3 }\n  - { id: db, cluster: api, label: db, kind: store }\nedges:\n  - { from: web, to: db }\n```',
      ),
    ).toEqual([]);
  });
});

describe('Phase 5 blocks — validation', () => {
  it('block validates grid layout with groups', () => {
    expect(
      diagsFor(
        '```block\ngroups:\n  - { col: 1, row: 1, cols: 2, rows: 1, label: G, color: "#0e54a1" }\nnodes:\n  - { id: a, col: 1, row: 1, kind: service, name: A }\n  - { id: b, col: 2, row: 1, kind: store, name: B }\nedges:\n  - { from: a, to: b }\n```',
      ),
    ).toEqual([]);
  });

  it('block (layered) validates with `layers` + node.layer', () => {
    expect(
      diagsFor(
        '```block\nlayers:\n  - { label: Edge }\n  - { label: Data }\nnodes:\n  - { id: a, layer: 0, kind: cdn, name: CDN }\n  - { id: b, layer: 1, kind: store, name: DB }\n```',
      ),
    ).toEqual([]);
  });

  it('infra validates with systemLabel + layers', () => {
    expect(
      diagsFor(
        '```infra\nsystemLabel: prod\nlayers:\n  - { label: Net }\nnodes:\n  - { id: cf, layer: 0, kind: cdn, name: CF }\n```',
      ),
    ).toEqual([]);
  });

  it('event validates pub/sub fan-out', () => {
    expect(
      diagsFor(
        '```event\nnodes:\n  - { id: p, col: 1, row: 1, kind: producer, name: producer }\n  - { id: t, col: 2, row: 1, kind: topic, name: events }\nedges:\n  - { from: p, to: t }\n```',
      ),
    ).toEqual([]);
  });

  it('ddd validates context map with dashed edges', () => {
    expect(
      diagsFor(
        '```ddd\nnodes:\n  - { id: a, col: 1, row: 1, kind: context, name: A }\n  - { id: b, col: 2, row: 1, kind: context, name: B }\nedges:\n  - { from: a, to: b, kind: dashed }\n```',
      ),
    ).toEqual([]);
  });

  it('network validates firewall + gateway nodes', () => {
    expect(
      diagsFor(
        '```network\nnodes:\n  - { id: gw, col: 1, row: 1, kind: gateway, name: Edge }\n  - { id: fw, col: 2, row: 1, kind: firewall, name: FW }\nedges:\n  - { from: gw, to: fw }\n```',
      ),
    ).toEqual([]);
  });

  it('felogic validates with interface stereotype + implements edges', () => {
    expect(
      diagsFor(
        '```felogic\nnodes:\n  - { id: i, col: 1, row: 1, kind: interface, name: I }\n  - { id: a, col: 2, row: 1, kind: strategy, name: A }\nedges:\n  - { from: a, to: i, kind: implements }\n```',
      ),
    ).toEqual([]);
  });

  it('belogic validates controller → service → repo chain', () => {
    expect(
      diagsFor(
        '```belogic\nnodes:\n  - { id: c, col: 1, row: 1, kind: controller, name: Ctrl }\n  - { id: s, col: 2, row: 1, kind: service, name: Svc }\n  - { id: r, col: 3, row: 1, kind: repository, name: Repo }\nedges:\n  - { from: c, to: s, kind: uses }\n  - { from: s, to: r, kind: uses }\n```',
      ),
    ).toEqual([]);
  });

  it('felogic rejects an unknown edge kind', () => {
    const d = diagsFor(
      '```felogic\nnodes:\n  - { id: a, col: 1, row: 1, name: A }\n  - { id: b, col: 2, row: 1, name: B }\nedges:\n  - { from: a, to: b, kind: bogus }\n```',
    );
    expect(d[0]?.code).toBe('E_SCHEMA');
  });

  it('dag validates with flow-shape nodes', () => {
    expect(
      diagsFor(
        '```dag\nnodes:\n  - { id: a, col: 1, row: 1, kind: start, label: Source }\n  - { id: b, col: 2, row: 1, kind: end, label: Sink }\nedges:\n  - { from: a, to: b }\n```',
      ),
    ).toEqual([]);
  });
});
