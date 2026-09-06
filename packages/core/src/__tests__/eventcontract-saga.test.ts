/**
 * `eventcontract` + `saga` (phase 30, G): the catalog examples validate
 * clean, unknown fields are rejected, the terse item forms expand to the
 * canonical objects, and the saga's `failAt` must name a step.
 */

import { describe, expect, it } from 'vitest';
import { parseDocument } from '../parser.js';
import { validateDocument } from '../validate.js';
import { BLOCK_TEMPLATES } from '../blocks/catalog.js';
import { lintDensity } from '../density.js';

function diagsFor(md: string): ReturnType<typeof validateDocument> {
  return validateDocument(parseDocument(md.trim() + '\n', 'tmp'), 'tmp.md');
}

function dataOf(md: string): Record<string, unknown> {
  const seg = parseDocument(md.trim() + '\n', 't').segments[0];
  if (seg === undefined || seg.kind === 'markdown') throw new Error('expected a block');
  return seg.data as Record<string, unknown>;
}

describe('eventcontract — validation', () => {
  it('accepts the catalog example', () => {
    expect(diagsFor(BLOCK_TEMPLATES.eventcontract)).toEqual([]);
  });

  it('accepts the minimal form (name only)', () => {
    expect(diagsFor('```eventcontract\nname: order.placed\n```')).toEqual([]);
  });

  it('rejects an unknown field (schemas are strict)', () => {
    const d = diagsFor('```eventcontract\nname: order.placed\ntopic: orders\n```');
    expect(d).toHaveLength(1);
    expect(d[0]?.code).toBe('E_SCHEMA');
  });

  it('rejects a delivery or ordering outside the enum', () => {
    expect(diagsFor('```eventcontract\nname: e\ndelivery: maybe\n```')[0]?.code).toBe('E_SCHEMA');
    expect(diagsFor('```eventcontract\nname: e\nordering: sometimes\n```')[0]?.code).toBe('E_SCHEMA');
  });

  it('rejects a payload field without a type', () => {
    expect(diagsFor('```eventcontract\nname: e\nschema:\n  - { name: id }\n```')[0]?.code).toBe('E_SCHEMA');
  });
});

describe('eventcontract — terse fields', () => {
  it('expands `name type required — desc` (quoted and unquoted)', () => {
    const d = dataOf(
      '```eventcontract\nname: e\nschema:\n  - "order_id uuid required — The order"\n  - total money — Grand total\n  - coupon string\n  - items Item[] required\n```',
    );
    expect(d['schema']).toEqual([
      { name: 'order_id', type: 'uuid', required: true, desc: 'The order' },
      { name: 'total', type: 'money', desc: 'Grand total' },
      { name: 'coupon', type: 'string' },
      { name: 'items', type: 'Item[]', required: true },
    ]);
  });

  it('keeps a multi-token type and the colons in a description', () => {
    const d = dataOf('```eventcontract\nname: e\nheaders:\n  - "at string (ISO 8601) — format: date-time"\n```');
    expect(d['headers']).toEqual([{ name: 'at', type: 'string (ISO 8601)', desc: 'format: date-time' }]);
  });

  it('rescues the single-pair map YAML makes of `name: type`', () => {
    const d = dataOf('```eventcontract\nname: e\nschema:\n  - order_id: uuid required — The order\n```');
    expect(d['schema']).toEqual([{ name: 'order_id', type: 'uuid', required: true, desc: 'The order' }]);
  });

  it('expands `Name — when` errors and leaves object forms alone', () => {
    const d = dataOf(
      '```eventcontract\nname: e\nerrors:\n  - DuplicateOrder — already processed\n  - { name: Poison, when: bad payload }\n```',
    );
    expect(d['errors']).toEqual([
      { name: 'DuplicateOrder', when: 'already processed' },
      { name: 'Poison', when: 'bad payload' },
    ]);
  });

  it('leaves a field with no type as a string, which the schema then reports', () => {
    const md = '```eventcontract\nname: e\nschema:\n  - "order_id"\n```';
    expect(dataOf(md)['schema']).toEqual(['order_id']);
    expect(diagsFor(md)[0]?.code).toBe('E_SCHEMA');
  });
});

describe('saga — validation', () => {
  it('accepts the catalog example', () => {
    expect(diagsFor(BLOCK_TEMPLATES.saga)).toEqual([]);
  });

  it('accepts object steps with explicit statuses and no failAt', () => {
    expect(
      diagsFor(
        '```saga\nsteps:\n  - { id: a, name: A, service: s1, status: ok }\n  - { id: b, name: B, service: s2, action: do b, compensate: undo b, status: compensated }\n```',
      ),
    ).toEqual([]);
  });

  it('rejects an unknown field (schemas are strict)', () => {
    const d = diagsFor('```saga\nsteps:\n  - { id: a, name: A, service: s }\nrollback: always\n```');
    expect(d).toHaveLength(1);
    expect(d[0]?.code).toBe('E_SCHEMA');
  });

  it('rejects a failAt that is not a step id, naming the ids', () => {
    const d = diagsFor('```saga\nsteps:\n  - { id: a, name: A, service: s }\nfailAt: zz\n```');
    expect(d).toHaveLength(1);
    expect(d[0]?.code).toBe('E_SCHEMA');
    expect(d[0]?.message).toContain('failAt "zz" is not a step id');
    expect(d[0]?.message).toContain('a');
  });

  it('rejects duplicate step ids, an empty steps list, and a bad status', () => {
    expect(
      diagsFor('```saga\nsteps:\n  - { id: a, name: A, service: s }\n  - { id: a, name: B, service: s }\n```')[0]?.message,
    ).toContain('duplicate step id "a"');
    expect(diagsFor('```saga\nsteps: []\n```')[0]?.code).toBe('E_SCHEMA');
    expect(diagsFor('```saga\nsteps:\n  - { id: a, name: A, service: s, status: done }\n```')[0]?.code).toBe('E_SCHEMA');
  });
});

describe('saga — terse steps', () => {
  it('expands `id: Name · service · compensate` (the unquoted single-pair form)', () => {
    const d = dataOf(
      '```saga\nsteps:\n  - reserve: Reserve stock · inventory · release stock\n  - notify: Send confirmation · notifications\n```',
    );
    expect(d['steps']).toEqual([
      { id: 'reserve', name: 'Reserve stock', service: 'inventory', compensate: 'release stock' },
      { id: 'notify', name: 'Send confirmation', service: 'notifications' },
    ]);
  });

  it('reads four parts as name · service · action · compensate', () => {
    const d = dataOf('```saga\nsteps:\n  - "charge: Charge card · payments · capture · refund card"\n```');
    expect(d['steps']).toEqual([
      { id: 'charge', name: 'Charge card', service: 'payments', action: 'capture', compensate: 'refund card' },
    ]);
  });

  it('leaves a step with no service as a string, which the schema then reports', () => {
    const md = '```saga\nsteps:\n  - "reserve: Reserve stock"\n```';
    expect(dataOf(md)['steps']).toEqual(['reserve: Reserve stock']);
    expect(diagsFor(md)[0]?.code).toBe('E_SCHEMA');
  });
});

describe('saga — density', () => {
  it('warns past 12 steps', () => {
    const steps = (n: number): string =>
      Array.from({ length: n }, (_, i) => `  - s${i}: Step ${i} · svc`).join('\n');
    const lint = (n: number) => lintDensity(parseDocument(`\`\`\`saga\nsteps:\n${steps(n)}\n\`\`\`\n`, 'd'), 'd.md');
    expect(lint(12)).toEqual([]);
    const d = lint(13);
    expect(d).toHaveLength(1);
    expect(d[0]?.code).toBe('W_DENSE_BLOCK');
    expect(d[0]?.message).toContain('13 steps');
  });
});
