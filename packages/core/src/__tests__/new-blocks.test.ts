/**
 * Validation tests for the 28 blocks added across v1 phases 2-5.
 *
 * For each block: a happy-path doc validates clean, and a representative
 * schema violation produces an `E_SCHEMA` diagnostic with the right line.
 */

import { describe, expect, it } from 'vitest';
import { parseDocument } from '../parser.js';
import { validateDocument } from '../validate.js';
import { normalizeStatusColor } from '../blocks/schemas.js';

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

  it('tree (variant: issue) validates parent/child issue tree', () => {
    expect(
      diagsFor(
        '```tree\nvariant: issue\nnodes:\n  - { id: root, label: Why }\n  - { id: a, parent: root, label: Cause A }\n  - { id: b, parent: root, label: Cause B, note: detail }\n```',
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

  it('block (preset: infra) validates with systemLabel + layers', () => {
    expect(
      diagsFor(
        '```block\npreset: infra\nsystemLabel: prod\nlayers:\n  - { label: Net }\nnodes:\n  - { id: cf, layer: 0, kind: cdn, name: CF }\n```',
      ),
    ).toEqual([]);
  });

  it('block (preset: event) validates pub/sub fan-out', () => {
    expect(
      diagsFor(
        '```block\npreset: event\nnodes:\n  - { id: p, col: 1, row: 1, kind: producer, name: producer }\n  - { id: t, col: 2, row: 1, kind: topic, name: events }\nedges:\n  - { from: p, to: t }\n```',
      ),
    ).toEqual([]);
  });

  it('block (preset: ddd) validates context map with dashed edges', () => {
    expect(
      diagsFor(
        '```block\npreset: ddd\nnodes:\n  - { id: a, col: 1, row: 1, kind: context, name: A }\n  - { id: b, col: 2, row: 1, kind: context, name: B }\nedges:\n  - { from: a, to: b, kind: dashed }\n```',
      ),
    ).toEqual([]);
  });

  it('block (preset: network) validates firewall + gateway nodes', () => {
    expect(
      diagsFor(
        '```block\npreset: network\nnodes:\n  - { id: gw, col: 1, row: 1, kind: gateway, name: Edge }\n  - { id: fw, col: 2, row: 1, kind: firewall, name: FW }\nedges:\n  - { from: gw, to: fw }\n```',
      ),
    ).toEqual([]);
  });

  it('block rejects an unknown preset', () => {
    const d = diagsFor(
      '```block\npreset: cloud\nnodes:\n  - { id: a, col: 1, row: 1, name: A }\n```',
    );
    expect(d[0]?.code).toBe('E_SCHEMA');
    expect(d[0]?.message).toContain('preset');
  });

  it('felogic validates with interface stereotype + implements edges', () => {
    expect(
      diagsFor(
        '```felogic\nnodes:\n  - { id: i, col: 1, row: 1, kind: interface, name: I }\n  - { id: a, col: 2, row: 1, kind: strategy, name: A }\nedges:\n  - { from: a, to: i, kind: implements }\n```',
      ),
    ).toEqual([]);
  });

  it('felogic (variant: be) validates controller → service → repo chain', () => {
    expect(
      diagsFor(
        '```felogic\nvariant: be\nnodes:\n  - { id: c, col: 1, row: 1, kind: controller, name: Ctrl }\n  - { id: s, col: 2, row: 1, kind: service, name: Svc }\n  - { id: r, col: 3, row: 1, kind: repository, name: Repo }\nedges:\n  - { from: c, to: s, kind: uses }\n  - { from: s, to: r, kind: uses }\n```',
      ),
    ).toEqual([]);
  });

  it('felogic rejects an unknown edge kind', () => {
    const d = diagsFor(
      '```felogic\nnodes:\n  - { id: a, col: 1, row: 1, name: A }\n  - { id: b, col: 2, row: 1, name: B }\nedges:\n  - { from: a, to: b, kind: bogus }\n```',
    );
    expect(d[0]?.code).toBe('E_SCHEMA');
  });

  it('flow (variant: dag) validates with flow-shape nodes', () => {
    expect(
      diagsFor(
        '```flow\nvariant: dag\nnodes:\n  - { id: a, col: 1, row: 1, kind: start, label: Source }\n  - { id: b, col: 2, row: 1, kind: end, label: Sink }\nedges:\n  - { from: a, to: b }\n```',
      ),
    ).toEqual([]);
  });
});

describe('Phase 21 blocks — validation', () => {
  it('statustable validates with the built-in default vocabulary', () => {
    expect(
      diagsFor(
        '```statustable\nrows:\n  - { cells: [Ship it, Rolling out], status: in progress }\n  - { cells: [Write docs, Draft done], status: Done }\n```',
      ),
    ).toEqual([]);
  });

  it('statustable validates a custom vocabulary with subtasks', () => {
    expect(
      diagsFor(
        '```statustable\ncolumns: [Task, Update]\nstatuses:\n  - { label: in review, color: purple }\n  - { label: waiting on vendor, color: gray }\nrows:\n  - cells: [Vendor SSO, Contract signed]\n    status: waiting on vendor\n    subtasks:\n      - { cells: [Metadata exchange, Sent Tuesday], status: in review }\n      - { cells: [Provisioning, Waiting on creds], status: blocked }\n```',
      ),
    ).toEqual([]);
  });

  it('statustable rejects an unknown row status and lists the available labels', () => {
    const d = diagsFor(
      '```statustable\nstatuses:\n  - { label: in review, color: purple }\nrows:\n  - { cells: [Task one], status: shipped }\n```',
    );
    expect(d[0]?.code).toBe('E_SCHEMA');
    expect(d[0]?.message).toContain('unknown status "shipped"');
    expect(d[0]?.message).toContain('in review');
    expect(d[0]?.message).toContain('in progress');
    expect(d[0]?.message).toContain('done');
  });

  it('statustable rejects an unknown SUBTASK status at its exact path', () => {
    const d = diagsFor(
      '```statustable\nrows:\n  - cells: [Parent task]\n    status: in progress\n    subtasks:\n      - { cells: [Child task], status: done }\n      - { cells: [Other child], status: bogus }\n```',
    );
    expect(d).toHaveLength(1);
    expect(d[0]?.code).toBe('E_SCHEMA');
    expect(d[0]?.message).toContain('unknown status "bogus"');
    // The diagnostic points at the offending subtask, not the parent row.
    expect(d[0]?.message).toContain('rows.0.subtasks.1.status');
  });

  it('statustable rejects an unknown color and an empty rows list', () => {
    const bad = diagsFor(
      '```statustable\nstatuses:\n  - { label: ok, color: chartreuse }\nrows:\n  - { cells: [x], status: ok }\n```',
    );
    expect(bad[0]?.code).toBe('E_SCHEMA');
    expect(bad[0]?.message).toContain('color');
    const empty = diagsFor('```statustable\nrows: []\n```');
    expect(empty[0]?.code).toBe('E_SCHEMA');
  });

  it('statustable accepts SEMANTIC color aliases alongside accents', () => {
    expect(
      diagsFor(
        '```statustable\nstatuses:\n  - { label: shipped, color: success }\n  - { label: stuck, color: error }\n  - { label: slipping, color: warn }\n  - { label: parked, color: neutral }\n  - { label: fyi, color: info }\n  - { label: in review, color: purple }\nrows:\n  - { cells: [Task one, All good], status: shipped }\n```',
      ),
    ).toEqual([]);
  });

  it('normalizeStatusColor maps aliases to accents and passes accents through', () => {
    expect(normalizeStatusColor('success')).toBe('green');
    expect(normalizeStatusColor('error')).toBe('red');
    expect(normalizeStatusColor('warn')).toBe('amber');
    expect(normalizeStatusColor('neutral')).toBe('gray');
    expect(normalizeStatusColor('info')).toBe('blue');
    expect(normalizeStatusColor('purple')).toBe('purple');
    expect(normalizeStatusColor('gray')).toBe('gray');
  });
});

describe('Phase 28 — fishbone validation', () => {
  it('accepts an effect with bones and items', () => {
    expect(
      diagsFor(
        '```fishbone\ntitle: Why checkout latency rose\neffect: p95 checkout over 2s\ncauses:\n  - { label: Code, items: [Sync capture call, N+1 cart query] }\n  - { label: Traffic }\n```',
      ),
    ).toEqual([]);
  });

  it('rejects an unknown field (schemas are strict)', () => {
    const d = diagsFor(
      '```fishbone\neffect: Slow builds\ncauses:\n  - { label: CI }\nspine: long\n```',
    );
    expect(d).toHaveLength(1);
    expect(d[0]?.code).toBe('E_SCHEMA');
  });

  it('rejects an empty causes list and a missing effect', () => {
    const empty = diagsFor('```fishbone\neffect: Slow builds\ncauses: []\n```');
    expect(empty[0]?.code).toBe('E_SCHEMA');
    const headless = diagsFor('```fishbone\ncauses:\n  - { label: CI }\n```');
    expect(headless[0]?.code).toBe('E_SCHEMA');
  });
});

describe('Phase 29 — storymap validation', () => {
  it('accepts a backbone with slices, string cards, and object cards', () => {
    expect(
      diagsFor(
        '```storymap\ntitle: Checkout story map\nbackbone:\n  - { label: Browse, note: Find the product }\n  - { label: Pay }\nslices:\n  - { label: MVP, cells: [[Search box], [{ title: Card payment, tag: risky }]] }\n  - { label: Later, cells: [["Filters", "Saved carts"], []] }\n```',
      ),
    ).toEqual([]);
  });

  it('rejects an unknown field (schemas are strict)', () => {
    const d = diagsFor(
      '```storymap\nbackbone:\n  - { label: Browse }\nslices:\n  - { label: MVP, cells: [[A]] }\nreleases: 3\n```',
    );
    expect(d).toHaveLength(1);
    expect(d[0]?.code).toBe('E_SCHEMA');
  });

  it('rejects a slice whose cells do not match the backbone length', () => {
    const d = diagsFor(
      '```storymap\nbackbone:\n  - { label: Browse }\n  - { label: Pay }\nslices:\n  - { label: MVP, cells: [[A]] }\n```',
    );
    expect(d).toHaveLength(1);
    expect(d[0]?.code).toBe('E_SCHEMA');
    expect(d[0]?.message).toContain('1 cells but the backbone has 2 steps');
  });

  it('rejects an empty backbone and empty slices', () => {
    const spine = diagsFor('```storymap\nbackbone: []\nslices:\n  - { label: MVP, cells: [] }\n```');
    expect(spine[0]?.code).toBe('E_SCHEMA');
    const rows = diagsFor('```storymap\nbackbone:\n  - { label: Browse }\nslices: []\n```');
    expect(rows[0]?.code).toBe('E_SCHEMA');
  });
});

describe('Phase 29 — slopegraph validation', () => {
  it('accepts two headers, a unit, and items with accents and negatives', () => {
    expect(
      diagsFor(
        '```slopegraph\ntitle: Support volume by channel\nleft: "2023"\nright: "2025"\nunit: "%"\nitems:\n  - { label: Email, from: 48, to: 22 }\n  - { label: Chat, from: -5, to: 45, accent: teal }\n  - { label: Phone, from: 33, to: 33 }\n```',
      ),
    ).toEqual([]);
  });

  it('rejects an unknown field (schemas are strict)', () => {
    const d = diagsFor(
      '```slopegraph\nleft: "A"\nright: "B"\nitems:\n  - { label: X, from: 1, to: 2, delta: 1 }\n  - { label: Y, from: 1, to: 2 }\n```',
    );
    expect(d).toHaveLength(1);
    expect(d[0]?.code).toBe('E_SCHEMA');
  });

  it('rejects fewer than two items and a non-numeric value', () => {
    const single = diagsFor(
      '```slopegraph\nleft: "A"\nright: "B"\nitems:\n  - { label: X, from: 1, to: 2 }\n```',
    );
    expect(single[0]?.code).toBe('E_SCHEMA');
    const text = diagsFor(
      '```slopegraph\nleft: "A"\nright: "B"\nitems:\n  - { label: X, from: high, to: 2 }\n  - { label: Y, from: 1, to: 2 }\n```',
    );
    expect(text[0]?.code).toBe('E_SCHEMA');
  });
});

describe('chart scatter points + guides — validation', () => {
  it('accepts numeric points with size, label, and accent', () => {
    expect(
      diagsFor(
        '```chart\nkind: scatter\nxLabel: Effort\nyLabel: Impact\npoints:\n  - { x: 2, y: 8, size: 12, label: Quick win, accent: teal }\n  - { x: -1.5, y: 3 }\nguides: { x: 5, y: 5, quadrants: [Fill-ins, Do first, Avoid, Plan] }\n```',
      ),
    ).toEqual([]);
  });

  it('rejects an unknown point field (schemas are strict)', () => {
    const d = diagsFor('```chart\nkind: scatter\npoints:\n  - { x: 1, y: 2, radius: 4 }\n```');
    expect(d).toHaveLength(1);
    expect(d[0]?.code).toBe('E_SCHEMA');
  });

  it('rejects a non-numeric coordinate and an unknown guides field', () => {
    const bad = diagsFor('```chart\nkind: scatter\npoints:\n  - { x: wide, y: 2 }\n```');
    expect(bad[0]?.code).toBe('E_SCHEMA');
    const guide = diagsFor('```chart\nkind: scatter\npoints:\n  - { x: 1, y: 2 }\nguides: { z: 3 }\n```');
    expect(guide[0]?.code).toBe('E_SCHEMA');
  });

  it('rejects quadrants that are not exactly four labels', () => {
    const d = diagsFor(
      '```chart\nkind: scatter\npoints:\n  - { x: 1, y: 2 }\nguides: { quadrants: [A, B, C] }\n```',
    );
    expect(d[0]?.code).toBe('E_SCHEMA');
  });
});

describe('tree variant: org — validation', () => {
  it('accepts variant org with node roles', () => {
    expect(
      diagsFor(
        '```tree\nvariant: org\nnodes:\n  - { id: ceo, label: Dana Reyes, role: CEO }\n  - { id: eng, parent: ceo, label: Sam Ortiz, role: VP Engineering }\n```',
      ),
    ).toEqual([]);
  });

  it('rejects an unknown variant and an unknown node field', () => {
    const variant = diagsFor('```tree\nvariant: pyramid\nnodes:\n  - { id: a, label: A }\n```');
    expect(variant[0]?.code).toBe('E_SCHEMA');
    const field = diagsFor(
      '```tree\nvariant: org\nnodes:\n  - { id: a, label: A, title: CEO }\n```',
    );
    expect(field[0]?.code).toBe('E_SCHEMA');
  });
});
