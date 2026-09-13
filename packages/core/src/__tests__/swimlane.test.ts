import { describe, expect, it } from 'vitest';
import { parseDocument } from '../parser.js';
import { validateDocument } from '../validate.js';
import { contractTerseItems, normalizeBlockData } from '../blocks/normalize.js';
import { resolveSwimlaneLane, swimlaneColumns, swimlanePlacements } from '../blocks/swimlaneLayout.js';
import { BLOCK_TEMPLATES } from '../blocks/catalog.js';

const fence = (body: string): string => '```swimlane\n' + body + '\n```\n';
const check = (body: string) => validateDocument(parseDocument(fence(body), 't'), 't.md');
const errors = (body: string) => check(body).filter((d) => d.level === 'error');
const dataOf = (body: string): Record<string, unknown> => {
  const seg = parseDocument(fence(body), 't').segments.find((s) => s.kind === 'swimlane');
  if (seg === undefined) throw new Error('no swimlane segment');
  return seg.data as Record<string, unknown>;
};

const LANES = [{ label: 'Customer' }, { id: 'eng', label: 'Engineering' }, { label: ' Ops ' }];

describe('swimlane: lanes by label', () => {
  it('resolves a label case-insensitively and trimmed, an id, or an index', () => {
    expect(resolveSwimlaneLane('Customer', LANES)).toBe(0);
    expect(resolveSwimlaneLane('  customer ', LANES)).toBe(0);
    expect(resolveSwimlaneLane('ENGINEERING', LANES)).toBe(1);
    expect(resolveSwimlaneLane('eng', LANES)).toBe(1);
    expect(resolveSwimlaneLane('ops', LANES)).toBe(2);
    expect(resolveSwimlaneLane(2, LANES)).toBe(2);
    expect(resolveSwimlaneLane('Sales', LANES)).toBeUndefined();
    expect(resolveSwimlaneLane(3, LANES)).toBeUndefined();
    expect(resolveSwimlaneLane(-1, LANES)).toBeUndefined();
  });

  it('a step whose lane is a label validates clean', () => {
    expect(
      errors('lanes: [Customer, Sales]\nsteps:\n  - { id: a, lane: customer, label: Ask }\n  - { id: b, lane: Sales, label: Answer }\nlinks:\n  - a -> b'),
    ).toEqual([]);
  });

  it('an unknown lane label is E_SWIMLANE_LANE and the hint lists the lanes', () => {
    const diags = errors('lanes: [Customer, Sales]\nsteps:\n  - { id: a, lane: Ops, label: Ask }');
    expect(diags).toHaveLength(1);
    const d = diags[0];
    expect(d?.code).toBe('E_SWIMLANE_LANE');
    expect(d?.message).toContain('Ops');
    expect(d?.message).toContain('step a');
    expect(d?.hint).toContain('Customer, Sales');
    expect(d?.line).toBeGreaterThan(1); // positioned on the offending `lane:`
  });

  it('an index past the last lane is the same error', () => {
    const diags = errors('lanes: [Customer, Sales]\nsteps:\n  - { id: a, lane: 2, label: Ask }');
    expect(diags.map((d) => d.code)).toEqual(['E_SWIMLANE_LANE']);
    expect(diags[0]?.message).toContain('2 lanes (0–1)');
  });

  it('a lane with no lanes declared says so', () => {
    const diags = errors('steps:\n  - { id: a, lane: Sales, label: Ask }');
    expect(diags.map((d) => d.code)).toEqual(['E_SWIMLANE_LANE']);
    expect(diags[0]?.hint).toContain('lanes:');
  });
});

describe('swimlane: columns derived from links', () => {
  const steps = (ids: string[]) => ids.map((id) => ({ id, lane: 0 }));

  it('keeps explicit columns when every step has one', () => {
    expect(
      swimlaneColumns(
        [
          { id: 'a', col: 3, lane: 0 },
          { id: 'b', col: 1, lane: 0 },
        ],
        [{ from: 'a', to: 'b' }],
      ),
    ).toEqual([3, 1]);
  });

  it('ranks a chain left to right', () => {
    expect(
      swimlaneColumns(steps(['a', 'b', 'c']), [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
      ]),
    ).toEqual([1, 2, 3]);
  });

  it('uses the longest path when a step has several predecessors', () => {
    // a → b → d and a → d: d sits after b, not beside it.
    expect(
      swimlaneColumns(steps(['a', 'b', 'd']), [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'd' },
        { from: 'a', to: 'd' },
      ]),
    ).toEqual([1, 2, 3]);
  });

  it('places an unlinked step after the last linked one, in author order', () => {
    expect(
      swimlaneColumns(steps(['x', 'a', 'b', 'y']), [{ from: 'a', to: 'b' }]),
    ).toEqual([3, 1, 2, 4]);
  });

  it('honours an explicit col as a floor, and survives a cycle', () => {
    expect(
      swimlaneColumns(
        [
          { id: 'a', lane: 0 },
          { id: 'b', col: 4, lane: 0 },
          { id: 'c', lane: 0 },
        ],
        [
          { from: 'a', to: 'b' },
          { from: 'b', to: 'c' },
          { from: 'c', to: 'a' },
        ],
      ),
    ).toEqual([1, 4, 5]);
  });

  it('two derived steps never share a cell — the later one moves right', () => {
    const { placements, derived } = swimlanePlacements({
      lanes: [{ label: 'Sales' }],
      steps: [
        { id: 'q', lane: 'Sales' },
        { id: 'yes', lane: 'Sales' },
        { id: 'no', lane: 'Sales' },
      ],
      links: [
        { from: 'q', to: 'yes' },
        { from: 'q', to: 'no' },
      ],
    });
    expect(derived).toBe(true);
    expect(placements).toEqual([
      { col: 1, lane: 0 },
      { col: 2, lane: 0 },
      { col: 3, lane: 0 },
    ]);
  });

  it('a body with no col at all validates clean', () => {
    expect(
      errors('lanes: [A, B]\nsteps:\n  - { id: a, lane: A, label: One }\n  - { id: b, lane: B, label: Two }\nlinks:\n  - a -> b'),
    ).toEqual([]);
  });
});

describe('swimlane: terse forms', () => {
  it('expands `id: Label · Lane` and `id: Label · Lane · kind`', () => {
    const data = dataOf('lanes: [Sales]\nsteps:\n  - req: Submit request · Sales\n  - done: Receive · Sales · end');
    expect(data['steps']).toEqual([
      { id: 'req', label: 'Submit request', lane: 'Sales' },
      { id: 'done', label: 'Receive', lane: 'Sales', kind: 'end' },
    ]);
  });

  it('leaves a line without a lane as a string, so the schema names the missing field', () => {
    const data = normalizeBlockData('swimlane', { steps: ['req: Submit request'] }) as Record<string, unknown>;
    expect(data['steps']).toEqual(['req: Submit request']);
  });

  it('contracts a label-lane step back to its terse line, and leaves a numeric lane alone', () => {
    const items = contractTerseItems('swimlane', 'steps', [
      { id: 'req', label: 'Submit request', lane: 'Sales' },
      { id: 'done', label: 'Receive', lane: 'Sales', kind: 'end' },
      { id: 'num', label: 'Indexed', lane: 1 },
      { id: 'pinned', label: 'Pinned', lane: 'Sales', col: 2 },
    ]);
    expect(items).toEqual([
      'req: Submit request · Sales',
      'done: Receive · Sales · end',
      { id: 'num', label: 'Indexed', lane: 1 },
      { id: 'pinned', label: 'Pinned', lane: 'Sales', col: 2 },
    ]);
  });

  it('links read the arrow grammar: `-->` is dashed, `-x->` is error', () => {
    const data = dataOf('lanes: [A]\nsteps:\n  - a: One · A\n  - b: Two · A\nlinks:\n  - a -> b: next\n  - a --> b: notify\n  - a -x-> b: fail');
    expect(data['links']).toEqual([
      { from: 'a', to: 'b', label: 'next' },
      { from: 'a', to: 'b', label: 'notify', kind: 'dashed' },
      { from: 'a', to: 'b', label: 'fail', kind: 'error' },
    ]);
    expect(contractTerseItems('swimlane', 'links', data['links'] as unknown[])).toEqual([
      'a -> b: next',
      'a --> b: notify',
      'a -x-> b: fail',
    ]);
  });
});

describe('swimlane: phases, notes, accent', () => {
  it('phases validate with `from` and an optional `to`; a step takes note and accent', () => {
    expect(
      errors(
        'lanes: [A]\nphases:\n  - { label: Intake, from: 1, to: 2 }\n  - { label: Ship, from: 3 }\nsteps:\n  - { id: a, lane: A, label: One, note: SLA 2d, accent: true }',
      ),
    ).toEqual([]);
  });

  it('a phase needs `from`, and it is 1-based', () => {
    expect(errors('lanes: [A]\nphases:\n  - { label: Intake }').map((d) => d.code)).toEqual(['E_SCHEMA']);
    expect(errors('lanes: [A]\nphases:\n  - { label: Intake, from: 0 }').map((d) => d.code)).toEqual(['E_SCHEMA']);
  });

  it('the catalog template validates clean and derives its columns', () => {
    const doc = parseDocument(BLOCK_TEMPLATES.swimlane, 't');
    expect(validateDocument(doc, 't.md').filter((d) => d.level === 'error')).toEqual([]);
    const seg = doc.segments.find((s) => s.kind === 'swimlane');
    if (seg === undefined) throw new Error('no swimlane segment');
    const { placements, derived } = swimlanePlacements(seg.data as Parameters<typeof swimlanePlacements>[0]);
    expect(derived).toBe(true);
    expect(placements.map((p) => p.col)).toEqual([1, 2, 3, 4]);
    expect(placements.map((p) => p.lane)).toEqual([0, 1, 2, 0]);
  });
});
