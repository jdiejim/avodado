/**
 * The diff gate for terse lists.
 *
 * The `.md` file is the review surface, so an edit must change only what the
 * user changed. A list written in terse sugar (`- App -> Auth: POST /token`)
 * used to survive only until something wrote the WHOLE array back: `setIn`
 * reserialised every item from plain data, so deleting one message rewrote
 * every other one as three lines of fields.
 *
 * For every block field with a terse grammar this runs the four list edits a
 * UI emits — delete, reorder, edit one item, insert — and asserts, on top of
 * "the data is right" and "validation is clean", the assertion that actually
 * keeps diffs small: every item the operation did not touch comes out
 * BYTE-IDENTICAL to the line that went in.
 */

import { describe, expect, it } from 'vitest';
import {
  contractTerseItems,
  deleteYamlPath,
  parseDocument,
  setYamlPath,
  validateDocument,
  type BlockType,
} from '../index.js';

/** One terse list field, with the four edits described against it. */
interface Fixture {
  readonly kind: BlockType;
  /** The list's path (indices included for a nested list). */
  readonly path: ReadonlyArray<string | number>;
  /** Body lines BEFORE the list's items (ending with the list's key line). */
  readonly head: readonly string[];
  /** The items exactly as written, without the `- ` bullet. */
  readonly terse: readonly string[];
  /** Indentation of the item bullets. */
  readonly indent?: string;
  /** Body lines AFTER the list. */
  readonly tail?: readonly string[];
  /** The field an "edit one item" op changes on item 0, and its new value. */
  readonly editField: string;
  readonly editValue: string;
  /** A canonical item to insert at the end. */
  readonly insert: Record<string, unknown>;
}

const FIXTURES: readonly Fixture[] = [
  {
    kind: 'sequence',
    path: ['messages'],
    head: [
      'actors:',
      '  - { id: App, name: App }',
      '  - { id: Auth, name: Auth }',
      'messages:',
    ],
    terse: ['App -> Auth: POST /token', 'Auth --> App: 200 ok', 'App -> Auth: retry', 'alt: cached', 'end'],
    editField: 'label',
    editValue: 'POST /token v2',
    insert: { from: 'App', to: 'Auth', label: 'refresh' },
  },
  {
    kind: 'erd',
    path: ['relations'],
    head: [
      'entities:',
      '  - name: users',
      '    columns: [id uuid pk]',
      '  - name: orders',
      '    columns: [id uuid pk]',
      '  - name: items',
      '    columns: [id uuid pk]',
      'relations:',
    ],
    terse: ['users ||--o{ orders: places', 'orders ||--o{ items: has', 'users ||..o| items: saved'],
    editField: 'label',
    editValue: 'owns',
    insert: { from: 'items', to: 'orders', card: 'N:1' },
  },
  {
    kind: 'erd',
    path: ['entities', 0, 'columns'],
    head: ['entities:', '  - name: users', '    columns:'],
    indent: '      ',
    terse: ['id uuid pk', 'email text unique !null', 'org_id uuid -> orgs.id', 'status enum(open,closed)'],
    editField: 'type',
    editValue: 'citext',
    insert: { name: 'created_at', type: 'timestamptz' },
  },
  {
    kind: 'flow',
    path: ['nodes'],
    head: ['nodes:'],
    terse: ['start: Start', 'check: Is valid?', 'ship: Ship it', 'Done'],
    tail: ['edges:', '  - start -> check'],
    editField: 'label',
    editValue: 'Begin',
    insert: { id: 'stop', label: 'Stop' },
  },
  {
    kind: 'flow',
    path: ['edges'],
    head: ['nodes: [a, b, c, d]', 'edges:'],
    terse: ['a -> b', 'b -> c: ok', 'c -x-> d: fail', 'a --> d: skip'],
    editField: 'label',
    editValue: 'fine',
    insert: { from: 'd', to: 'a' },
  },
  {
    kind: 'graph',
    path: ['nodes'],
    head: ['nodes:'],
    terse: ['a: Module A', 'b: Module B', 'c: Module C'],
    tail: ['edges:', '  - a -> b'],
    editField: 'label',
    editValue: 'Module Alpha',
    insert: { id: 'd', label: 'Module D' },
  },
  {
    kind: 'graph',
    path: ['edges'],
    head: ['nodes: [a, b, c]', 'edges:'],
    terse: ['a -> b', 'b -> c: uses', 'a -> c: reads'],
    editField: 'label',
    editValue: 'calls',
    insert: { from: 'c', to: 'a' },
  },
  {
    kind: 'block',
    path: ['nodes'],
    head: ['nodes:'],
    terse: ['gw: Gateway', 'api: API', 'pg: Postgres'],
    // The edge must not name the item these tests delete (index 1) — a `block`
    // edge naming a missing node is now `E_SCHEMA`.
    tail: ['edges:', '  - gw -> pg'],
    editField: 'name',
    editValue: 'Edge gateway',
    insert: { id: 'q', name: 'Events' },
  },
  {
    kind: 'block',
    path: ['edges'],
    head: ['nodes: [gw, api, pg]', 'edges:'],
    terse: ['gw -> api', 'api -> pg: writes', 'api --> gw: replies'],
    editField: 'label',
    editValue: 'reads',
    insert: { from: 'pg', to: 'gw' },
  },
  {
    kind: 'state',
    path: ['states'],
    head: ['states:'],
    terse: ['draft: DRAFT', 'live: LIVE', 'archived: ARCHIVED'],
    tail: ['transitions:', '  - draft -> live: publish'],
    editField: 'name',
    editValue: 'NEW',
    insert: { id: 'gone', name: 'GONE' },
  },
  {
    kind: 'state',
    path: ['transitions'],
    head: ['states: [draft, live, archived]', 'transitions:'],
    terse: ['draft -> live: publish', 'live -> archived: archive', 'archived -> draft: restore'],
    editField: 'event',
    editValue: 'release',
    insert: { from: 'live', to: 'draft', event: 'revert' },
  },
  {
    kind: 'dfd',
    path: ['nodes'],
    head: ['nodes:'],
    terse: ['ext: Client', 'proc: Process', 'store: Orders'],
    tail: ['edges:', '  - ext -> proc'],
    editField: 'name',
    editValue: 'Browser',
    insert: { id: 'log', name: 'Audit log' },
  },
  {
    kind: 'dfd',
    path: ['edges'],
    head: ['nodes: [ext, proc, store]', 'edges:'],
    terse: ['ext -> proc: request', 'proc -> store: write', 'store -> proc: read'],
    editField: 'label',
    editValue: 'submit',
    insert: { from: 'proc', to: 'ext' },
  },
  {
    kind: 'swimlane',
    path: ['lanes'],
    head: ['lanes:'],
    terse: ['Customer', 'Sales', 'Ops'],
    tail: ['steps:', '  - { id: req, col: 1, lane: 0, label: Submit }'],
    editField: 'label',
    editValue: 'Buyer',
    insert: { label: 'Finance' },
  },
  {
    kind: 'swimlane',
    path: ['links'],
    head: [
      'lanes: [Customer, Sales, Ops]',
      'steps:',
      '  - { id: req, col: 1, lane: 0, label: Submit }',
      '  - { id: qual, col: 2, lane: 1, label: Qualify }',
      '  - { id: done, col: 3, lane: 2, label: Fulfil }',
      'links:',
    ],
    terse: ['req -> qual', 'qual -> done: ok', 'done -> req: loop'],
    editField: 'label',
    editValue: 'approved',
    insert: { from: 'req', to: 'done' },
  },
  {
    kind: 'c4',
    path: ['edges'],
    head: [
      'level: context',
      'nodes:',
      '  - { id: user, kind: person, name: Shopper }',
      '  - { id: app, kind: system, name: ShopCo }',
      '  - { id: pay, kind: external, name: Payment GW }',
      'edges:',
    ],
    terse: ['user -> app: places order', 'app -> pay: authorises', 'pay --> app: webhook'],
    editField: 'label',
    editValue: 'submits order',
    insert: { from: 'user', to: 'pay' },
  },
  {
    kind: 'cluster',
    path: ['edges'],
    head: [
      'clusters:',
      '  - { id: api, label: api namespace }',
      'services:',
      '  - { id: web, cluster: api, label: web }',
      '  - { id: orders, cluster: api, label: orders }',
      '  - { id: pg, cluster: api, label: postgres }',
      'edges:',
    ],
    terse: ['web -> orders', 'orders -> pg: writes', 'web --> pg: reads'],
    editField: 'label',
    editValue: 'queries',
    insert: { from: 'pg', to: 'web' },
  },
  {
    kind: 'stats',
    path: ['stats'],
    head: ['title: This quarter', 'stats:'],
    terse: ['Active users · 12.4k · +18%', 'Uptime · 99.95%', 'p95 latency · 142ms · -22ms'],
    editField: 'value',
    editValue: '13.1k',
    insert: { label: 'Errors', value: '0.4%' },
  },
  {
    kind: 'team',
    path: ['members'],
    head: ['title: Who owns what', 'members:'],
    terse: [
      'Ana Ruiz · Tech lead · Rendering pipeline',
      'Sam Okafor · Backend',
      'Lena Fischer · Design · Themes',
    ],
    editField: 'role',
    editValue: 'Principal',
    insert: { name: 'Jo Park', role: 'QA' },
  },
  {
    kind: 'agenda',
    path: ['items'],
    head: ['items:'],
    terse: ['09:00 · 30m · Intros', '09:30 · 45m · Status — each team for 5 min', '10:15 · Wrap-up'],
    editField: 'title',
    editValue: 'Welcome',
    insert: { time: '11:00', title: 'Close' },
  },
  {
    kind: 'okr',
    path: ['items', 0, 'krs'],
    head: ['items:', '  - objective: Make onboarding effortless', '    krs:'],
    indent: '      ',
    terse: [
      '"[on-track] Time-to-first-doc under 5 minutes · 70"',
      'Activation rate from 45% to 60% · 40',
      '"[done] Ship the tour · 100"',
    ],
    editField: 'kr',
    editValue: 'Time-to-first-doc under 3 minutes',
    insert: { kr: 'Docs NPS above 40', progress: 0.1 },
  },
  {
    kind: 'timeline',
    path: ['items'],
    head: ['items:'],
    terse: [
      '"[current] now · Phase 1 · What is happening now"',
      '"[next] next · Phase 2 · What is next"',
      '"[future] later · Phase 3"',
    ],
    editField: 'label',
    editValue: 'Phase one',
    insert: { date: 'Q4', label: 'Phase 4' },
  },
  {
    kind: 'eventcontract',
    path: ['schema'],
    head: ['name: order.placed', 'channel: orders', 'schema:'],
    terse: [
      'order_id uuid required — The order this event is about',
      'customer_id uuid required — The buyer',
      'coupon string — Discount code applied, if any',
    ],
    editField: 'type',
    editValue: 'string',
    insert: { name: 'total', type: 'money', required: true },
  },
  {
    kind: 'eventcontract',
    path: ['headers'],
    head: ['name: order.placed', 'channel: orders', 'headers:'],
    terse: [
      'trace_id string required — W3C trace id',
      'schema_version string — The payload version',
      'idempotency_key uuid required',
    ],
    editField: 'desc',
    editValue: 'W3C traceparent',
    insert: { name: 'source', type: 'string' },
  },
  {
    kind: 'eventcontract',
    path: ['errors'],
    head: ['name: order.placed', 'channel: orders', 'errors:'],
    terse: [
      'DuplicateOrder — the same order_id was already processed',
      'UnknownCustomer — the buyer no longer exists',
      'PayloadTooLarge',
    ],
    editField: 'when',
    editValue: 'the order_id repeats',
    insert: { name: 'Timeout' },
  },
  {
    kind: 'saga',
    path: ['steps'],
    head: ['title: Place order', 'steps:'],
    terse: [
      'reserve: Reserve stock · inventory · release stock',
      'charge: Charge card · payments · authorise · refund card',
      'notify: Send confirmation · notifications',
    ],
    editField: 'name',
    editValue: 'Hold stock',
    insert: { id: 'ship', name: 'Book shipment', service: 'shipping' },
  },
  {
    kind: 'spans',
    path: ['spans'],
    head: ['title: GET /orders/{id}', 'unit: ms', 'spans:'],
    terse: [
      'api/get: GET /orders · 0 · 120',
      'api/auth: verify token · 4 · 10',
      'db/q1: SELECT orders · 18 · 40',
    ],
    editField: 'name',
    editValue: 'GET /orders/{id}',
    insert: { id: 'q2', service: 'db', name: 'SELECT items', start: 60, duration: 20 },
  },
  {
    kind: 'rollout',
    path: ['stages'],
    head: ['title: Checkout v2', 'strategy: canary', 'stages:'],
    terse: [
      '"[done] 1% · Smoke · 15m — no 5xx"',
      '"[current] 10% · Canary · 30m"',
      '"[next] 100% · Full"',
    ],
    editField: 'name',
    editValue: 'Smoke test',
    insert: { name: 'Soak', traffic: 25 },
  },
  {
    kind: 'glossary',
    path: ['terms'],
    head: ['terms:'],
    terse: [
      'Idempotency — Doing a thing twice has the same effect as doing it once.',
      'SLO — The service-level objective the team commits to.',
      'DLQ — Where messages go when every retry failed.',
    ],
    editField: 'def',
    editValue: 'Repeating a call changes nothing.',
    insert: { term: 'Backpressure', def: 'The signal a consumer sends when it is behind.' },
  },
  {
    kind: 'faq',
    path: ['items'],
    head: ['title: Common questions', 'items:'],
    terse: [
      'Where does the content live? — In the .md files on disk.',
      'Do diagrams need a drawing tool? — No, the renderer draws them.',
      'How do I validate a doc? — Run avo check.',
    ],
    editField: 'a',
    editValue: 'In the Markdown files.',
    insert: { q: 'Can I export a PDF?', a: 'Yes, with avo build.' },
  },
  {
    kind: 'takeaways',
    path: ['items'],
    head: ['title: Takeaways', 'items:'],
    terse: [
      'The capture call was the bottleneck — it was 71% of the 2.4s p95.',
      'Moving it to a queue cut p95 by 75%',
      'Conversion recovered within two weeks',
    ],
    editField: 'detail',
    editValue: 'it was most of the checkout p95.',
    insert: { text: 'The queue paid for itself' },
  },
  {
    kind: 'list',
    path: ['items'],
    head: ['title: What you get', 'items:'],
    terse: [
      'Typed blocks — 90 strict schemas, validated by avo check.',
      'One source of truth — diagrams live in the .md file.',
      'Many outputs',
    ],
    editField: 'text',
    editValue: '90 schemas the CLI checks.',
    insert: { lead: 'No drawing' },
  },
  {
    kind: 'steps',
    path: ['items'],
    head: ['title: Deploy a hotfix', 'items:'],
    terse: [
      'Branch from main — hotfixes always branch from the latest main.',
      'Ship the fix — commit and push; CI runs the full suite.',
      'Tag and deploy',
    ],
    editField: 'body',
    editValue: 'always branch from main.',
    insert: { title: 'Announce it' },
  },
  {
    kind: 'kanban',
    path: ['columns', 0, 'cards'],
    head: ['columns:', '  - label: Now', '    cards:'],
    indent: '      ',
    terse: ['Current task · api', 'Second task', 'Third task · ui'],
    tail: ['  - label: Next', '    cards: [Upcoming task]'],
    editField: 'title',
    editValue: 'Renamed task',
    insert: { title: 'Fourth task' },
  },
];

/** The item lines of a fixture, exactly as they appear in the source. */
function itemLines(fx: Fixture): string[] {
  const indent = fx.indent ?? '  ';
  return fx.terse.map((t) => `${indent}- ${t}`);
}

function bodyOf(fx: Fixture): string {
  return [...fx.head, ...itemLines(fx), ...(fx.tail ?? [])].join('\n');
}

function valueAt(data: unknown, path: ReadonlyArray<string | number>): unknown {
  let cur = data;
  for (const seg of path) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string | number, unknown>)[seg];
  }
  return cur;
}

/** Parses one fenced block and returns its raw body plus canonical data. */
function parseBlock(kind: BlockType, body: string): { raw: string; data: unknown; errors: string[] } {
  const source = '```' + kind + '\n' + body + '\n```\n';
  const doc = parseDocument(source, 't');
  const seg = doc.segments.find((s) => s.kind === kind);
  if (seg === undefined || seg.kind === 'markdown') throw new Error(`no ${kind} segment`);
  const errors = validateDocument(doc, 't.md')
    .filter((d) => d.level === 'error')
    .map((d) => `${d.code}: ${d.message} — ${String(d.value ?? '')}`);
  return { raw: seg.raw, data: seg.data, errors };
}

/** The subset of `lines` that are original item lines, in output order. */
function survivors(out: string, original: readonly string[]): string[] {
  return out.split('\n').filter((l) => original.includes(l));
}

describe('terse lists survive whole-list writes', () => {
  for (const fx of FIXTURES) {
    const name = `${fx.kind}.${fx.path.filter((s) => typeof s === 'string').join('.')}`;

    /** The fixture, parsed: source lines, canonical items, and a checker. */
    const setup = (): {
      body: string;
      lines: string[];
      items: Array<Record<string, unknown>>;
      check: (out: string, expectItems: unknown[], keep: readonly string[]) => void;
    } => {
      const body = bodyOf(fx);
      const before = parseBlock(fx.kind, body);
      expect(before.errors, `${name} fixture must be valid`).toEqual([]);
      const items = valueAt(before.data, fx.path) as Array<Record<string, unknown>>;
      expect(Array.isArray(items), `${name} fixture list`).toBe(true);
      return {
        body,
        lines: itemLines(fx),
        items,
        check: (out, expectItems, keep) => {
          const after = parseBlock(fx.kind, out);
          // (a) the data is exactly what the operation asked for …
          expect(valueAt(after.data, fx.path), `${name} data`).toEqual(expectItems);
          // (b) … and the block still validates …
          expect(after.errors, `${name} diagnostics`).toEqual([]);
          // (c) … and every untouched item is byte-identical to its input line.
          expect(survivors(out, itemLines(fx)), `${name} untouched lines`).toEqual([...keep]);
        },
      };
    };

    it(`${name}: deleting an item leaves the others untouched`, () => {
      const { body, lines, items, check } = setup();
      const out = deleteYamlPath(body, [...fx.path, 1]);
      check(out, items.filter((_, i) => i !== 1), lines.filter((_, i) => i !== 1));
    });

    it(`${name}: reordering rewrites the list without reserialising it`, () => {
      const { body, lines, items, check } = setup();
      const next = [items[1], items[0], ...items.slice(2)];
      const out = setYamlPath(body, fx.path, next, fx.kind);
      check(out, next, [lines[1] as string, lines[0] as string, ...lines.slice(2)]);
    });

    it(`${name}: editing one item touches only that item`, () => {
      const { body, lines, items, check } = setup();
      const edited = { ...(items[0] as Record<string, unknown>), [fx.editField]: fx.editValue };
      const next = [edited, ...items.slice(1)];
      const out = setYamlPath(body, fx.path, next, fx.kind);
      check(out, next, lines.slice(1));
    });

    it(`${name}: inserting an item touches only the new one`, () => {
      const { body, lines, items, check } = setup();
      const next = [...items, fx.insert];
      const out = setYamlPath(body, fx.path, next, fx.kind);
      check(out, next, lines);
    });
  }
});

describe('contraction is used only where it is exactly faithful', () => {
  it('contracts what the grammar can say and leaves the rest as objects', () => {
    const items = contractTerseItems('sequence', 'messages', [
      { from: 'App', to: 'Auth', label: 'POST /token' },
      { from: 'App', to: 'Auth', label: 'POST /token', summary: 'a field the arrow cannot say' },
      { from: 'App', to: 'Auth', kind: 'async' }, // no arrow spells `async`
      { from: 'App', to: 'Auth', label: 'ok', kind: 'response' },
      { frame: 'alt', label: 'cached' },
      { end: true },
    ]);
    expect(items[0]).toBe('App -> Auth: POST /token');
    expect(items[1]).toEqual({
      from: 'App',
      to: 'Auth',
      label: 'POST /token',
      summary: 'a field the arrow cannot say',
    });
    expect(items[2]).toEqual({ from: 'App', to: 'Auth', kind: 'async' });
    expect(items[3]).toBe('App --> Auth: ok');
    expect(items[4]).toBe('alt: cached');
    expect(items[5]).toBe('end');
  });

  it('refuses a contraction the grammar would read back differently', () => {
    // The id carries the separator the grammar splits on, so `a: b: Label`
    // would re-split as id `a`, label `b: Label` — not faithful.
    expect(contractTerseItems('flow', 'nodes', [{ id: 'a: b', label: 'Label' }])).toEqual([
      { id: 'a: b', label: 'Label' },
    ]);
    // A timeline `desc` with no `date` would read the label as the date.
    expect(contractTerseItems('timeline', 'items', [{ label: 'Ship', desc: 'soon' }])).toEqual([
      { label: 'Ship', desc: 'soon' },
    ]);
    // `trend` must be the one the delta's sign implies.
    expect(contractTerseItems('stats', 'stats', [{ label: 'Errors', value: '1', delta: '+2', trend: 'down' }])).toEqual(
      [{ label: 'Errors', value: '1', delta: '+2', trend: 'down' }],
    );
  });

  it('leaves an item the author wrote as a mapping alone when it is unchanged', () => {
    const body = ['messages:', '  - { from: App, to: Auth, label: audit }', '  - App -> Auth: ping'].join('\n');
    const { data } = parseBlock('sequence', body);
    const items = valueAt(data, ['messages']) as unknown[];
    const out = setYamlPath(body, ['messages'], items, 'sequence');
    expect(out).toBe(body);
  });

  it('keeps field form in a list the author wrote entirely in field form', () => {
    const body = [
      'terms:',
      '  - { term: SLO, def: The target the team commits to. }',
      '  - { term: DLQ, def: Where failed messages go. }',
    ].join('\n');
    const { data } = parseBlock('glossary', body);
    const items = valueAt(data, ['terms']) as Array<Record<string, unknown>>;
    const out = setYamlPath(body, ['terms'], [...items, { term: 'SLA', def: 'The contract.' }], 'glossary');
    expect(out).toContain('- { term: SLO, def: The target the team commits to. }');
    expect(out).toContain('term: SLA');
    expect(out).not.toContain('SLA — The contract.');
  });

  it('without a block kind the write still reserialises (the old behaviour)', () => {
    const body = ['messages:', '  - App -> Auth: ping', '  - Auth --> App: pong'].join('\n');
    const { data } = parseBlock('sequence', body);
    const items = valueAt(data, ['messages']) as unknown[];
    const out = setYamlPath(body, ['messages'], items.slice(0, 1));
    expect(out).toContain('from: App');
  });
});
