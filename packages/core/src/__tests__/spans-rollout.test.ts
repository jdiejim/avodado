/**
 * `spans` (distributed-trace waterfall) and `rollout` (progressive-delivery
 * strip): the schemas accept their catalog examples and reject unknown
 * fields; the terse item forms expand at parse time.
 */

import { describe, expect, it } from 'vitest';
import { parseDocument } from '../parser.js';
import { validateDocument } from '../validate.js';
import { lintDensity } from '../density.js';
import { BLOCK_TEMPLATES } from '../blocks/catalog.js';
import type { Diagnostic } from '../diagnostics.js';

function diagsFor(md: string): Diagnostic[] {
  const doc = parseDocument(md, 'test');
  return validateDocument(doc, 'test.md').filter((d) => d.level === 'error');
}

function dataOf(md: string): unknown {
  const doc = parseDocument(md, 'test');
  for (const seg of doc.segments) if (seg.kind !== 'markdown') return seg.data;
  return undefined;
}

describe('spans — validation', () => {
  it('accepts the catalog example', () => {
    expect(diagsFor(BLOCK_TEMPLATES.spans)).toEqual([]);
  });

  it('accepts every field of the object form', () => {
    expect(
      diagsFor(
        '```spans\nunit: s\nspans:\n  - { id: a, name: root, service: api, start: 0, duration: 2 }\n  - { id: b, name: child, service: db, start: 0.5, duration: 1, parent: a, kind: db, error: true, attrs: { rows: 12, table: orders }, note: slow }\n```',
      ),
    ).toEqual([]);
  });

  it('rejects an unknown field (schemas are strict)', () => {
    const d = diagsFor('```spans\nspans:\n  - { id: a, name: root, service: api, start: 0, duration: 2, latency: 3 }\n```');
    expect(d).toHaveLength(1);
    expect(d[0]?.code).toBe('E_SCHEMA');
  });

  it('rejects a bad unit, a negative start, and an unknown kind', () => {
    expect(diagsFor('```spans\nunit: ns\nspans:\n  - { id: a, name: r, service: api, start: 0, duration: 1 }\n```')[0]?.code).toBe('E_SCHEMA');
    expect(diagsFor('```spans\nspans:\n  - { id: a, name: r, service: api, start: -1, duration: 1 }\n```')[0]?.code).toBe('E_SCHEMA');
    expect(diagsFor('```spans\nspans:\n  - { id: a, name: r, service: api, start: 0, duration: 1, kind: lambda }\n```')[0]?.code).toBe('E_SCHEMA');
  });

  it('rejects a parent that names no span, a self-parent, and a duplicate id', () => {
    const orphan = diagsFor('```spans\nspans:\n  - { id: a, name: r, service: api, start: 0, duration: 1, parent: zz }\n```');
    expect(orphan).toHaveLength(1);
    expect(orphan[0]?.message).toContain('"zz"');
    const self = diagsFor('```spans\nspans:\n  - { id: a, name: r, service: api, start: 0, duration: 1, parent: a }\n```');
    expect(self[0]?.message).toContain('itself');
    const dup = diagsFor(
      '```spans\nspans:\n  - { id: a, name: r, service: api, start: 0, duration: 1 }\n  - { id: a, name: s, service: db, start: 0, duration: 1 }\n```',
    );
    expect(dup[0]?.message).toContain('duplicate span id');
  });

  it('expands the terse `service/id: name · start · duration [· parent]` form', () => {
    const data = dataOf(
      '```spans\nspans:\n  - api/get: GET /orders · 0 · 120\n  - db/q1: SELECT orders · 30 · 40 · get\n  - "cache/c1: GET order:42 · 62 · 3.5 · get"\n```',
    ) as { spans: unknown[] };
    expect(data.spans).toEqual([
      { id: 'get', service: 'api', name: 'GET /orders', start: 0, duration: 120 },
      { id: 'q1', service: 'db', name: 'SELECT orders', start: 30, duration: 40, parent: 'get' },
      { id: 'c1', service: 'cache', name: 'GET order:42', start: 62, duration: 3.5, parent: 'get' },
    ]);
    expect(diagsFor('```spans\nspans:\n  - api/get: GET /orders · 0 · 120\n  - db/q1: SELECT orders · 30 · 40 · get\n```')).toEqual([]);
  });

  it('leaves a terse span it cannot read as a schema error (non-numeric start)', () => {
    const d = diagsFor('```spans\nspans:\n  - api/get: GET /orders · fast · 120\n```');
    expect(d[0]?.code).toBe('E_SCHEMA');
  });

  it('warns past 40 spans (density budget)', () => {
    const many = Array.from({ length: 41 }, (_, i) => `  - { id: s${i}, name: n${i}, service: api, start: ${i}, duration: 1 }`).join('\n');
    const doc = parseDocument(`\`\`\`spans\nspans:\n${many}\n\`\`\``, 'test');
    const w = lintDensity(doc, 'test.md');
    expect(w).toHaveLength(1);
    expect(w[0]?.code).toBe('W_DENSE_BLOCK');
    expect(w[0]?.message).toContain('41 spans');
  });
});

describe('rollout — validation', () => {
  it('accepts the catalog example', () => {
    expect(diagsFor(BLOCK_TEMPLATES.rollout)).toEqual([]);
  });

  it('accepts every field of the object form', () => {
    expect(
      diagsFor(
        '```rollout\nstrategy: blue-green\nstages:\n  - { name: Green, traffic: 0, duration: 10m, gate: smoke passes, status: done, note: warm the pool }\n  - { name: Swap, traffic: 100, status: current }\nrollback: Point the LB back at blue.\n```',
      ),
    ).toEqual([]);
  });

  it('rejects an unknown field (schemas are strict)', () => {
    const d = diagsFor('```rollout\nstages:\n  - { name: Canary, traffic: 10, owner: sre }\n```');
    expect(d).toHaveLength(1);
    expect(d[0]?.code).toBe('E_SCHEMA');
  });

  it('rejects traffic outside 0–100, an unknown status, and an unknown strategy', () => {
    expect(diagsFor('```rollout\nstages:\n  - { name: A, traffic: 120 }\n```')[0]?.code).toBe('E_SCHEMA');
    expect(diagsFor('```rollout\nstages:\n  - { name: A, status: paused }\n```')[0]?.code).toBe('E_SCHEMA');
    expect(diagsFor('```rollout\nstrategy: big-bang\nstages:\n  - { name: A }\n```')[0]?.code).toBe('E_SCHEMA');
  });

  it('expands the terse `[status] traffic% · name · duration — gate` form', () => {
    const data = dataOf(
      '```rollout\nstages:\n  - "[current] 10% · Canary · 30m — error rate < 0.5%"\n  - "[next] 50% · Half · 1h"\n  - 100% · Full\n  - Verify — all dashboards green\n  - "[blocked] Freeze"\n```',
    ) as { stages: unknown[] };
    expect(data.stages).toEqual([
      { name: 'Canary', traffic: 10, duration: '30m', gate: 'error rate < 0.5%', status: 'current' },
      { name: 'Half', traffic: 50, duration: '1h', status: 'next' },
      { name: 'Full', traffic: 100 },
      { name: 'Verify', gate: 'all dashboards green' },
      { name: 'Freeze', status: 'blocked' },
    ]);
    expect(diagsFor('```rollout\nstages:\n  - "[current] 10% · Canary · 30m — error rate < 0.5%"\n  - 100% · Full\n```')).toEqual([]);
  });

  it('coerces a bare numeric duration to its string form', () => {
    const data = dataOf('```rollout\nstages:\n  - { name: Canary, duration: 30 }\n```') as { stages: Array<{ duration?: unknown }> };
    expect(data.stages[0]?.duration).toBe('30');
  });
});
