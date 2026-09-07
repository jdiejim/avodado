/**
 * Guards for the schema-hardening pass. Every case here was reproduced against
 * the shipped build before the fix and reported ZERO diagnostics:
 *
 * - C-1 a non-finite number (`.inf`) reached a renderer and looped forever;
 * - C-2 a finite but absurd number produced a 100 MB page;
 * - W-2 `col: 0` painted a node outside the `viewBox`, invisibly;
 * - W-7 the erd column shorthand corrupted a multi-word `default=`;
 * - B-1 an in-block reference to a missing entity / node was dropped silently.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseDocument } from '../parser.js';
import { validateDocument } from '../validate.js';
import { lintDensity } from '../density.js';
import { canonicalTerseItem, contractTerseValue } from '../blocks/normalize.js';

/** Every diagnostic for a one-block document. */
function check(body: string): ReturnType<typeof validateDocument> {
  return validateDocument(parseDocument(body, 'doc'), 'doc.md');
}

/** Just the messages, for readable assertions. */
function messages(body: string): string[] {
  return check(body).map((d) => d.message);
}

/** The parsed data of the document's first typed block. */
function dataOf(body: string): Record<string, unknown> {
  const seg = parseDocument(body, 'doc').segments[0];
  if (seg === undefined || seg.kind === 'markdown') throw new Error('no typed block');
  return seg.data as Record<string, unknown>;
}

/** A one-block document from a fenced body. */
const fence = (kind: string, body: string): string => `\`\`\`${kind}\n${body}\n\`\`\`\n`;

/* ── C-1: non-finite numbers ────────────────────────────────────────────── */

describe('C-1 — a non-finite number is a schema error, not an infinite loop', () => {
  const cases: ReadonlyArray<readonly [string, string, string]> = [
    ['packet', 'width: .inf\nfields:\n  - { label: A, bits: 4 }', 'width'],
    ['wireframe', 'screens:\n  - elements:\n      - { type: list, rows: .inf }', 'rows'],
    ['spans', 'spans:\n  - { id: a, service: s, name: n, start: 0, duration: .inf }', 'duration'],
    ['treemap', 'items:\n  - { label: A, value: .inf }\n  - { label: B, value: 1 }', 'value'],
    ['c4', 'nodes:\n  - { id: a, col: .inf, row: 1, kind: system, name: A }', 'col'],
    ['gantt', 'tasks:\n  - { label: A, start: .inf, span: 2 }', 'start'],
    ['typescale', 'items:\n  - { name: A, size: 14, weight: .inf }', 'weight'],
  ];

  for (const [kind, body, field] of cases) {
    it(`${kind}.${field}: .inf is E_SCHEMA`, () => {
      const diags = check(fence(kind, body));
      expect(diags.length).toBeGreaterThan(0);
      const d = diags[0];
      expect(d?.code).toBe('E_SCHEMA');
      expect(d?.level).toBe('error');
      expect(d?.message).toContain(field);
      expect(d?.message).toContain('finite');
    });
  }

  it('-.inf is rejected the same way', () => {
    expect(messages(fence('treemap', 'items:\n  - { label: A, value: -.inf }'))[0]).toContain(
      'finite',
    );
  });

  it('reports the cause once, not its three consequences', () => {
    // `.inf` also fails `.int()` and `.max()`; only the finite issue is kept.
    const diags = check(fence('packet', 'width: .inf\nfields:\n  - { label: A, bits: 4 }'));
    expect(diags).toHaveLength(1);
  });

  it('a finite number in the same field still passes', () => {
    expect(check(fence('packet', 'width: 32\nfields:\n  - { label: A, bits: 4 }'))).toEqual([]);
  });

  it('no schema uses a bare z.number() — the shared builders own finiteness', () => {
    const src = readFileSync(
      fileURLToPath(new URL('../blocks/schemas.ts', import.meta.url)),
      'utf8',
    );
    // Comment lines are prose about the rule, not uses of it.
    const code = src
      .split('\n')
      .filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l))
      .join('\n');
    // The one permitted use is the `num` definition itself.
    expect(code.match(/z\.number\(\)/g) ?? []).toHaveLength(1);
    expect(code).toContain('const num = z.number().finite(NOT_FINITE_MESSAGE);');
  });
});

/* ── C-2: finite but unbounded output ───────────────────────────────────── */

describe('C-2 — a field that multiplies output size carries a ceiling', () => {
  it('packet.width: 1000000 is E_SCHEMA (it drew a 108 MB page)', () => {
    const diags = check(fence('packet', 'width: 1000000\nfields:\n  - { label: A, bits: 4 }'));
    expect(diags).toHaveLength(1);
    expect(diags[0]?.code).toBe('E_SCHEMA');
    expect(diags[0]?.message).toContain('at most 128');
  });

  it('wireframe rows: 100000 is E_SCHEMA (it drew a 45 MB page)', () => {
    const diags = check(
      fence('wireframe', 'screens:\n  - elements:\n      - { type: list, rows: 100000 }'),
    );
    expect(diags).toHaveLength(1);
    expect(diags[0]?.message).toContain('at most 40');
  });

  it('packet.bits: a field bigger than the format is E_SCHEMA', () => {
    expect(messages(fence('packet', 'fields:\n  - { label: A, bits: 100000 }'))[0]).toContain(
      'at most 4096',
    );
  });

  it('sankey col: 1000000 is E_SCHEMA (the renderer allocates one array per column)', () => {
    const diags = check(
      fence('sankey', 'nodes:\n  - { id: a, col: 1000000 }\nlinks:\n  - { from: a, to: a, value: 1 }'),
    );
    expect(diags.some((d) => d.message.includes('grid coordinates stop at'))).toBe(true);
  });

  it('a value that is only unwise gets a density warning, not an error', () => {
    // 96 bits per row is drawable but unreadable; the schema stops at 128.
    const doc = parseDocument(fence('packet', 'width: 96\nfields:\n  - { label: A, bits: 4 }'), 'doc');
    expect(validateDocument(doc, 'doc.md')).toEqual([]);
    const dense = lintDensity(doc, 'doc.md');
    expect(dense).toHaveLength(1);
    expect(dense[0]?.code).toBe('W_DENSE_BLOCK');
    expect(dense[0]?.level).toBe('warn');
    expect(dense[0]?.message).toContain('96 bits per row');
    expect(dense[0]?.message).toContain('64');
  });

  it('64 bits per row is clean; a wireframe of 13 rows warns and 12 does not', () => {
    const packet = parseDocument(fence('packet', 'width: 64\nfields:\n  - { label: A, bits: 4 }'), 'doc');
    expect(lintDensity(packet, 'doc.md')).toEqual([]);
    const wf = (n: number): string =>
      fence('wireframe', `screens:\n  - elements:\n      - { type: list, rows: ${n} }`);
    expect(lintDensity(parseDocument(wf(12), 'doc'), 'doc.md')).toEqual([]);
    const warned = lintDensity(parseDocument(wf(13), 'doc'), 'doc.md');
    expect(warned).toHaveLength(1);
    expect(warned[0]?.message).toContain('13 rows in one element');
  });
});

/* ── W-2: 1-based grid coordinates ──────────────────────────────────────── */

describe('W-2 — col / row / cols / rows are whole numbers from 1', () => {
  // Every grid-layout block the hunt reproduced `col: 0` on.
  const grid: ReadonlyArray<readonly [string, (v: string) => string]> = [
    ['c4', (v) => `nodes:\n  - { id: a, col: ${v}, row: 1, kind: system, name: A }`],
    ['block', (v) => `nodes:\n  - { id: a, col: ${v}, row: 1, name: A }`],
    ['dfd', (v) => `nodes:\n  - { id: a, col: ${v}, row: 1, name: A }`],
    ['graph', (v) => `nodes:\n  - { id: a, col: ${v}, row: 1, label: A }`],
    ['felogic', (v) => `nodes:\n  - { id: a, col: ${v}, row: 1, name: A }`],
    ['swimlane', (v) => `lanes:\n  - { label: L }\nsteps:\n  - { id: a, col: ${v}, lane: 0, label: A }`],
    ['state', (v) => `states:\n  - { id: a, col: ${v}, row: 1, name: A }`],
    ['flow', (v) => `nodes:\n  - { id: a, col: ${v}, row: 1, label: A }`],
    ['uml', (v) => `classes:\n  - { id: a, col: ${v}, row: 1, name: A }`],
  ];

  for (const [kind, body] of grid) {
    it(`${kind}: col 0 is an error, col 1 is clean`, () => {
      const zero = check(fence(kind, body('0')));
      expect(zero).toHaveLength(1);
      expect(zero[0]?.code).toBe('E_SCHEMA');
      expect(zero[0]?.message).toContain('1-based');
      expect(check(fence(kind, body('1')))).toEqual([]);
    });

    it(`${kind}: a negative or fractional col is an error`, () => {
      expect(messages(fence(kind, body('-3')))[0]).toContain('1-based');
      expect(messages(fence(kind, body('2.5')))[0]).toContain('whole number');
    });
  }

  it('a group cell range is 1-based too, and its span is at least one cell', () => {
    const body = (col: string, cols: string): string =>
      `groups:\n  - { col: ${col}, row: 1, cols: ${cols}, label: G }\nnodes:\n  - { id: a, col: 1, row: 1, name: A }`;
    expect(messages(fence('block', body('0', '1')))[0]).toContain('1-based');
    expect(messages(fence('block', body('1', '0')))[0]).toContain('at least 1 cell');
    expect(check(fence('block', body('1', '2')))).toEqual([]);
  });

  it('`lane` and `layer` stay 0-based — they index a declared list', () => {
    expect(
      check(fence('swimlane', 'lanes:\n  - { label: L }\nsteps:\n  - { id: a, col: 1, lane: 0, label: A }')),
    ).toEqual([]);
    expect(
      check(fence('block', 'layers:\n  - { label: L }\nnodes:\n  - { id: a, layer: 0, name: A }')),
    ).toEqual([]);
    expect(
      messages(fence('swimlane', 'lanes:\n  - { label: L }\nsteps:\n  - { id: a, col: 1, lane: -1, label: A }'))[0],
    ).toContain('0-based');
  });
});

/* ── W-7: the erd column shorthand ──────────────────────────────────────── */

describe('W-7 — a multi-word or colon-bearing default survives the shorthand', () => {
  /** The columns of a one-entity erd written with terse column strings. */
  function columns(...lines: string[]): unknown {
    const body = `entities:\n  - name: A\n    columns:\n${lines.map((l) => `      - ${l}`).join('\n')}`;
    const entities = dataOf(fence('erd', body))['entities'] as Array<{ columns: unknown }>;
    return entities[0]?.columns;
  }

  it('captures a multi-word default whole and leaves the type alone', () => {
    expect(columns('created_at timestamptz default=CURRENT TIMESTAMP')).toEqual([
      { name: 'created_at', default: 'CURRENT TIMESTAMP', type: 'timestamptz' },
    ]);
  });

  it('keeps colons inside a default, a cast, and an enum', () => {
    expect(columns('amount numeric default=0::numeric')).toEqual([
      { name: 'amount', default: '0::numeric', type: 'numeric' },
    ]);
    expect(columns('t timestamptz default=12:00')).toEqual([
      { name: 't', default: '12:00', type: 'timestamptz' },
    ]);
    expect(columns('s enum(a:b,c)')).toEqual([{ name: 's', enum: ['a:b', 'c'], type: 'enum' }]);
  });

  it('reads a quoted default, quotes stripped', () => {
    expect(columns('s text default="hello world"')).toEqual([
      { name: 's', default: 'hello world', type: 'text' },
    ]);
  });

  it('a flag after an unquoted default ends it', () => {
    expect(columns('s text default=CURRENT TIMESTAMP !null pk')).toEqual([
      { name: 's', default: 'CURRENT TIMESTAMP', nullable: false, pk: true, type: 'text' },
    ]);
    expect(columns('u uuid default=gen_random_uuid() -> users.id')).toEqual([
      { name: 'u', default: 'gen_random_uuid()', fk: true, ref: 'users.id', type: 'uuid' },
    ]);
  });

  it('a parenthesised type keeps its inner spaces', () => {
    expect(columns('amount numeric(10, 2) !null')).toEqual([
      { name: 'amount', nullable: false, type: 'numeric(10, 2)' },
    ]);
  });

  it('the single-pair rescue still reconstructs `id: uuid pk`', () => {
    expect(columns('id: uuid pk')).toEqual([{ name: 'id', pk: true, type: 'uuid' }]);
  });

  it('contraction stays faithful: a multi-word default round-trips', () => {
    // The guard is `expand(contract(v))` deep-equality — the contraction has
    // to spell a multi-word default in a form the expander reads back whole,
    // or decline it and leave the item in object form.
    const path = ['entities', 0, 'columns'];
    const roundTrip = (v: Record<string, unknown>): string | undefined =>
      contractTerseValue('erd', path, v);

    expect(roundTrip({ name: 'created_at', type: 'timestamptz', default: 'CURRENT TIMESTAMP' })).toBe(
      'created_at timestamptz default="CURRENT TIMESTAMP"',
    );
    expect(roundTrip({ name: 'amount', type: 'numeric', default: '0::numeric' })).toBe(
      'amount numeric default=0::numeric',
    );
    expect(roundTrip({ name: 'id', type: 'uuid', pk: true })).toBe('id uuid pk');
    // No unambiguous spelling — the contraction declines rather than lie.
    expect(roundTrip({ name: 's', type: 'text', default: 'say "hi"' })).toBeUndefined();

    // Whatever it returns must expand back to exactly the input.
    for (const v of [
      { name: 'created_at', type: 'timestamptz', default: 'CURRENT TIMESTAMP' },
      { name: 't', type: 'timestamptz', default: '12:00' },
      { name: 'u', type: 'uuid', fk: true, ref: 'users.id', default: 'gen_random_uuid()' },
      { name: 's', enum: ['a', 'b'], type: 'enum', nullable: false },
    ]) {
      const terse = roundTrip(v);
      expect(terse, JSON.stringify(v)).toBeDefined();
      expect(canonicalTerseItem('erd', path, terse)).toEqual(v);
    }
  });

  it('the documented shapes are unchanged', () => {
    expect(columns('email text unique !null default=now()')).toEqual([
      { name: 'email', unique: true, nullable: false, default: 'now()', type: 'text' },
    ]);
    expect(columns('user_id uuid fk -> users.id')).toEqual([
      { name: 'user_id', fk: true, ref: 'users.id', type: 'uuid' },
    ]);
  });
});

/* ── B-1: in-block references ───────────────────────────────────────────── */

describe('B-1 — an in-block reference to a missing thing is reported', () => {
  it('erd: a relation naming an entity that does not exist', () => {
    const diags = check(
      fence('erd', 'entities:\n  - name: A\n    columns: [id uuid pk]\nrelations:\n  - A ||--o{ Ghost: x'),
    );
    expect(diags).toHaveLength(1);
    expect(diags[0]?.code).toBe('E_SCHEMA');
    expect(diags[0]?.message).toContain('"Ghost" is not an entity name');
    expect(diags[0]?.message).toContain('use one of: A');
  });

  it('erd: a `schema.name` relation end resolves, the way the renderer resolves it', () => {
    expect(
      check(fence('erd', 'entities:\n  - { name: users, schema: auth }\n  - { name: orders }\nrelations:\n  - auth.users ||--o{ orders: has')),
    ).toEqual([]);
  });

  it('erd: two entities with the same name', () => {
    const diags = check(fence('erd', 'entities:\n  - name: A\n  - name: A'));
    expect(diags).toHaveLength(1);
    expect(diags[0]?.message).toContain('duplicate entity "A"');
  });

  it('block: an edge naming a node that does not exist', () => {
    const diags = check(fence('block', 'nodes:\n  - { id: a, col: 1, row: 1, name: A }\nedges:\n  - a -> ghost'));
    expect(diags).toHaveLength(1);
    expect(diags[0]?.code).toBe('E_SCHEMA');
    expect(diags[0]?.message).toContain('"ghost" is not a node id');
  });

  it('block: two nodes with the same id, and two groups with the same id', () => {
    expect(
      messages(fence('block', 'nodes:\n  - { id: a, col: 1, row: 1, name: A }\n  - { id: a, col: 2, row: 1, name: B }'))[0],
    ).toContain('duplicate node id "a"');
    expect(
      messages(
        fence(
          'block',
          'groups:\n  - { id: g, col: 1, row: 1, label: One }\n  - { id: g, col: 2, row: 1, label: Two }\nnodes:\n  - { id: a, col: 1, row: 1, name: A }',
        ),
      )[0],
    ).toContain('duplicate group id "g"');
  });

  it('block: a group naming a parent that does not exist stays a W_GROUP_NESTING warning', () => {
    const diags = check(
      fence('block', 'groups:\n  - { id: g2, parent: ghost, col: 1, row: 1, label: Inner }\nnodes:\n  - { id: a, col: 1, row: 1, name: A }'),
    );
    expect(diags).toHaveLength(1);
    expect(diags[0]?.code).toBe('W_GROUP_NESTING');
  });

  it('a block with no nodes declared does not report its edges', () => {
    // The check needs an id space to check against. With no nodes the block
    // draws nothing at all, which is `W_EMPTY_BLOCK` territory, not a bad ref.
    expect(check(fence('block', 'edges:\n  - a -> b'))).toEqual([]);
  });

  it('the "use one of" list stays one line for a large id space', () => {
    const nodes = Array.from({ length: 20 }, (_v, i) => `  - { id: n${i}, name: N${i} }`).join('\n');
    const msg = messages(fence('block', `nodes:\n${nodes}\nedges:\n  - n0 -> ghost`))[0] ?? '';
    expect(msg).toContain('(20 in all)');
    expect(msg.split(',').length).toBeLessThan(12);
  });
});
