/**
 * String-item sugar for list-shaped blocks — terse items split on ` — ` (em
 * dash) into lead + rest, mirroring the callout bare-text philosophy:
 *
 *   glossary  `Term — def` / `Term: def`   faq   `Question? — Answer`
 *   takeaways `Text — detail?`             list  `Lead — text?`
 *   steps     `Title — body?`              kanban cards `Title · tag?`
 *
 * Unquoted `Key: value` items arrive as single-pair maps (the YAML wrinkle) —
 * rescued when the key is not a real item field. Object forms pass untouched.
 */

import { describe, expect, it } from 'vitest';
import { parseDocument } from '../parser.js';
import { validateDocument } from '../validate.js';

function block(kind: string, body: string) {
  const doc = parseDocument(`\`\`\`${kind}\n${body}\n\`\`\`\n`, 't');
  const seg = doc.segments[0];
  if (seg === undefined || seg.kind === 'markdown') throw new Error('expected block');
  return { data: seg.data as Record<string, unknown>, diags: validateDocument(doc, 't.md') };
}

describe('string-item sugar', () => {
  it('glossary: `Term — def` and unquoted `Term: def` both expand', () => {
    const { data, diags } = block('glossary', 'terms:\n  - SLO — the target.\n  - Idempotent: replay-safe.');
    expect(diags).toHaveLength(0);
    expect(data['terms']).toEqual([
      { term: 'SLO', def: 'the target.' },
      { term: 'Idempotent', def: 'replay-safe.' },
    ]);
  });

  it('faq: `Question? — Answer` expands; colons inside survive', () => {
    const { data, diags } = block('faq', 'items:\n  - Why is it fast? — The cache: it is warm.');
    expect(diags).toHaveLength(0);
    expect(data['items']).toEqual([{ q: 'Why is it fast?', a: 'The cache: it is warm.' }]);
  });

  it('takeaways: bare text and `Text — detail` expand', () => {
    const { data, diags } = block('takeaways', 'items:\n  - Ship small — five beats one.\n  - Queues cut p95');
    expect(diags).toHaveLength(0);
    expect(data['items']).toEqual([
      { text: 'Ship small', detail: 'five beats one.' },
      { text: 'Queues cut p95' },
    ]);
  });

  it('list + steps: bare strings become the lead/title', () => {
    const l = block('list', 'items:\n  - First thing\n  - Second — with detail');
    expect(l.diags).toHaveLength(0);
    expect(l.data['items']).toEqual([{ lead: 'First thing' }, { lead: 'Second', text: 'with detail' }]);

    const s = block('steps', 'items:\n  - Install it — one command.\n  - Run it');
    expect(s.diags).toHaveLength(0);
    expect(s.data['items']).toEqual([{ title: 'Install it', body: 'one command.' }, { title: 'Run it' }]);
  });

  it('kanban: string cards `Title` / `Title · tag` expand inside columns', () => {
    const { data, diags } = block(
      'kanban',
      'columns:\n  - label: Now\n    cards:\n      - Core parser\n      - Validation · priority',
    );
    expect(diags).toHaveLength(0);
    const cols = data['columns'] as Array<{ cards: unknown[] }>;
    expect(cols[0]?.cards).toEqual([{ title: 'Core parser' }, { title: 'Validation', tag: 'priority' }]);
  });

  it('real object forms pass through untouched', () => {
    const { data, diags } = block('glossary', 'terms:\n  - { term: SLO, def: the target }');
    expect(diags).toHaveLength(0);
    expect(data['terms']).toEqual([{ term: 'SLO', def: 'the target' }]);
  });
});

describe('diagram sugar — nodes, transitions, links, columns', () => {
  it('flow: bare node strings become id+label; a full sketch is names + arrows', () => {
    const { data, diags } = block('flow', 'nodes: [Receive, Check]\nedges:\n  - Receive -> Check: lookup');
    expect(diags).toHaveLength(0);
    expect(data['nodes']).toEqual([
      { id: 'Receive', label: 'Receive' },
      { id: 'Check', label: 'Check' },
    ]);
    expect(data['edges']).toEqual([{ from: 'Receive', to: 'Check', label: 'lookup' }]);
  });

  it('state: `id: Name` nodes + arrow transitions (label becomes the event)', () => {
    const { data, diags } = block('state', 'states:\n  - idle\n  - active: Active\ntransitions:\n  - idle -> active: submit');
    expect(diags).toHaveLength(0);
    expect(data['states']).toEqual([{ id: 'idle', name: 'idle' }, { id: 'active', name: 'Active' }]);
    expect(data['transitions']).toEqual([{ from: 'idle', to: 'active', event: 'submit' }]);
  });

  it('dfd + swimlane: arrows expand without a kind field; lanes are labels', () => {
    const dfd = block('dfd', 'nodes:\n  - a: Client\n  - b: Store\nedges:\n  - a --> b: writes');
    expect(dfd.diags).toHaveLength(0);
    expect(dfd.data['edges']).toEqual([{ from: 'a', to: 'b', label: 'writes' }]); // kind dropped

    const swim = block(
      'swimlane',
      'lanes: [Dev, Ops]\nsteps:\n  - { id: a, label: A, col: 1, lane: 0 }\n  - { id: b, label: B, col: 2, lane: 1 }\nlinks:\n  - a -> b: handoff',
    );
    expect(swim.diags).toHaveLength(0);
    expect(swim.data['lanes']).toEqual([{ label: 'Dev' }, { label: 'Ops' }]);
  });

  it('c4 + cluster edges keep their kind variants', () => {
    const c4 = block(
      'c4',
      'nodes:\n  - { id: a, kind: system, name: A, col: 1, row: 1 }\n  - { id: b, kind: system, name: B, col: 2, row: 1 }\nedges:\n  - a --> b: calls',
    );
    expect(c4.diags).toHaveLength(0);
    expect(c4.data['edges']).toEqual([{ from: 'a', to: 'b', label: 'calls', kind: 'dashed' }]);
  });

  it('erd columns: `id uuid pk` tokens and the `org_id: uuid fk` colon form', () => {
    const { data, diags } = block('erd', 'entities:\n  - name: users\n    columns:\n      - id uuid pk\n      - email text\n      - org_id: uuid fk');
    expect(diags).toHaveLength(0);
    const cols = (data['entities'] as Array<{ columns: unknown[] }>)[0]?.columns;
    expect(cols).toEqual([
      { name: 'id', type: 'uuid', pk: true },
      { name: 'email', type: 'text' },
      { name: 'org_id', type: 'uuid', fk: true },
    ]);
  });
});

describe('card sugar — stats, team, agenda, okr', () => {
  it('stats: `label · value · delta` infers the trend from the sign', () => {
    const { data, diags } = block('stats', 'stats:\n  - p95 · 120ms · -30%\n  - Conversion · 4.1% · +0.8%');
    expect(diags).toHaveLength(0);
    expect(data['stats']).toEqual([
      { label: 'p95', value: '120ms', delta: '-30%', trend: 'down' },
      { label: 'Conversion', value: '4.1%', delta: '+0.8%', trend: 'up' },
    ]);
  });

  it('team: `Name · role · focus`', () => {
    const { data, diags } = block('team', 'members:\n  - Ana · Backend · payments');
    expect(diags).toHaveLength(0);
    expect(data['members']).toEqual([{ name: 'Ana', role: 'Backend', focus: 'payments' }]);
  });

  it('agenda: time and duration detected by shape; ` — ` splits the desc', () => {
    const { data, diags } = block('agenda', 'items:\n  - 09:00 · 20m · Standup — round robin\n  - Wrap-up');
    expect(diags).toHaveLength(0);
    expect(data['items']).toEqual([
      { time: '09:00', duration: '20m', title: 'Standup', desc: 'round robin' },
      { title: 'Wrap-up' },
    ]);
  });

  it('okr key results: `[status] Text · progress`', () => {
    const { data, diags } = block('okr', 'items:\n  - objective: Grow\n    krs:\n      - "[on-track] Signups · 60%"');
    expect(diags).toHaveLength(0);
    expect((data['items'] as Array<{ krs: unknown[] }>)[0]?.krs).toEqual([
      { kr: 'Signups', progress: 60, status: 'on-track' },
    ]);
  });
});
