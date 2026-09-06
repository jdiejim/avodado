/**
 * The Mermaid input dialect: a ```mermaid fence whose first line is one of
 * five diagram keywords parses into the matching typed block. Each grammar's
 * fixture converts to the expected data, validates with zero diagnostics,
 * and edits back to a canonical YAML fence. Anything else Mermaid stays prose.
 */

import { describe, expect, it } from 'vitest';
import { parseDocument } from '../parser.js';
import { validateDocument } from '../validate.js';
import { splitMarkdown, detectSuspectFences } from '../splitter.js';
import { editableBodyYaml, replaceBlockBody, setYamlPath } from '../edit.js';
import { MERMAID_KEYWORDS, convertMermaid, detectMermaidKind } from '../mermaid/index.js';
import type { TypedSegment } from '../types.js';

const fence = (body: string): string => '```mermaid\n' + body + '\n```\n';

function typed(md: string): TypedSegment {
  const doc = parseDocument(md, 'm');
  for (const seg of doc.segments) {
    if (seg.kind !== 'markdown') return seg;
  }
  throw new Error('expected a typed segment');
}

const SEQUENCE = `sequenceDiagram
    autonumber
    title Checkout
    actor U as Shopper
    participant Web
    participant API as Orders API
    U->>Web: Click "Pay"
    Web->>+API: POST /orders
    activate API
    API-)Bus: OrderPlaced
    alt card declined
        API--xWeb: 402 declined
    else ok
        API-->>-Web: 201 created
    end
    deactivate API
    %% a comment
    Note over Web,API: Idempotency key in header
    Note right of U: Sees confirmation
    Web-->U: Receipt`;

const FLOW = `flowchart TD
    %% checkout
    S([Start]) --> A[Load cart]
    A --> B{Cart empty?}
    B -->|yes| E([Done])
    B -- no --> C[/Collect payment/]
    C -.-> D[(Orders DB)]
    C --x F["Payment failed"]
    D & F --> E
    subgraph Fulfilment
      direction LR
      G((Ship))
    end
    E ==> G
    style A fill:#f9f
    classDef big font-size:20px
    class A big
    click A "https://example.com"
    linkStyle 0 stroke:red`;

const ERD = `erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ "ORDER LINE" : contains
    PRODUCT }o..o{ "ORDER LINE" : "appears in"
    ORDER }|--|| INVOICE : ""
    CUSTOMER {
        uuid id PK
        string email UK "unique"
        string name
    }
    ORDER {
        uuid id PK
        uuid customer_id FK
        int total
    }`;

const STATE = `stateDiagram-v2
    direction LR
    [*] --> Draft
    Draft --> Review : submit
    Review --> Draft : reject
    Review --> Approved : approve
    state "Published live" as Live
    Approved --> Live: publish
    Live --> [*]
    state Approved {
        [*] --> Queued
        Queued --> Sent : dispatch
    }
    note right of Draft : Editable by the author
    note left of Review
        Two reviewers required
    end note
    Draft : Being written
    --`;

const PIE = `pie showData
    title Traffic by source
    "Search" : 52
    "Direct" : 30.5
    "Referral" : 17.5`;

describe('sequenceDiagram → sequence', () => {
  it('converts participants, every arrow, notes, alt/else/end frames and +/- activation', () => {
    const seg = typed(fence(SEQUENCE));
    expect(seg.kind).toBe('sequence');
    expect(seg.sourceType).toBe('mermaid');
    expect(seg.parseError).toBeUndefined();
    expect(seg.data).toEqual({
      title: 'Checkout',
      actors: [
        { id: 'U', name: 'Shopper' },
        { id: 'Web', name: 'Web' },
        { id: 'API', name: 'Orders API' },
        { id: 'Bus', name: 'Bus' },
      ],
      messages: [
        { from: 'U', to: 'Web', label: 'Click "Pay"' },
        { from: 'Web', to: 'API', label: 'POST /orders', activate: true },
        { from: 'API', to: 'Bus', label: 'OrderPlaced', kind: 'async' },
        { frame: 'alt', label: 'card declined' },
        { from: 'API', to: 'Web', label: '402 declined', kind: 'error' },
        { else: 'ok' },
        { from: 'API', to: 'Web', label: '201 created', kind: 'response', deactivate: true },
        { end: true },
        { from: 'Web', to: 'API', label: 'Idempotency key in header', kind: 'note' },
        { from: 'U', to: 'U', label: 'Sees confirmation', kind: 'note' },
        { from: 'Web', to: 'U', label: 'Receipt', kind: 'response' },
      ],
    });
  });

  it('validates with zero diagnostics', () => {
    expect(validateDocument(parseDocument(fence(SEQUENCE), 'm'), 'm.md')).toEqual([]);
  });

  it('keeps every fragment kind, maps and/option to else, and drops rect/box with their own end', () => {
    const seg = typed(
      fence(
        'sequenceDiagram\n  par fan out\n    A->>B: one\n  and second\n    A->>C: two\n  end\n' +
          '  rect rgb(200,200,200)\n    critical open\n      A->>B: try\n    option timeout\n      A-xB: fail\n    end\n    loop every 5s\n      A->>A: tick\n    end\n  end\n' +
          '  opt cached\n    B-->>A: hit\n  end\n  break stop\n    A->>B: halt\n  end',
      ),
    );
    expect(seg.parseError).toBeUndefined();
    expect((seg.data as { messages: unknown[] }).messages).toEqual([
      { frame: 'par', label: 'fan out' },
      { from: 'A', to: 'B', label: 'one' },
      { else: 'second' },
      { from: 'A', to: 'C', label: 'two' },
      { end: true },
      { frame: 'critical', label: 'open' },
      { from: 'A', to: 'B', label: 'try' },
      { else: 'timeout' },
      { from: 'A', to: 'B', label: 'fail', kind: 'error' },
      { end: true },
      { frame: 'loop', label: 'every 5s' },
      { from: 'A', to: 'A', label: 'tick' },
      { end: true },
      { frame: 'opt', label: 'cached' },
      { from: 'B', to: 'A', label: 'hit', kind: 'response' },
      { end: true },
      { frame: 'break', label: 'stop' },
      { from: 'A', to: 'B', label: 'halt' },
      { end: true },
    ]);
    // Every frame closed, so the frame lint has nothing to say.
    expect(validateDocument(parseDocument(fence('sequenceDiagram\n  alt x\n    A->>B: y\n  end'), 'm'), 'm.md')).toEqual([]);
  });
});

describe('flowchart / graph → flow', () => {
  it('converts shapes, edge forms, chains, fans; drops subgraph and style lines', () => {
    const seg = typed(fence(FLOW));
    expect(seg.kind).toBe('flow');
    expect(seg.parseError).toBeUndefined();
    expect(seg.data).toEqual({
      dir: 'TB',
      nodes: [
        { id: 'S', label: 'Start', kind: 'start' },
        { id: 'A', label: 'Load cart' },
        { id: 'B', label: 'Cart empty?', kind: 'decision' },
        { id: 'E', label: 'Done' },
        { id: 'C', label: 'Collect payment' },
        { id: 'D', label: 'Orders DB' },
        { id: 'F', label: 'Payment failed' },
        { id: 'G', label: 'Ship', kind: 'end' },
      ],
      edges: [
        { from: 'S', to: 'A' },
        { from: 'A', to: 'B' },
        { from: 'B', to: 'E', label: 'yes' },
        { from: 'B', to: 'C', label: 'no' },
        { from: 'C', to: 'D', kind: 'dashed' },
        { from: 'C', to: 'F', kind: 'error' },
        { from: 'D', to: 'E' },
        { from: 'F', to: 'E' },
        { from: 'E', to: 'G' },
      ],
    });
  });

  it('maps every direction and accepts `graph`, chains and `;` separators', () => {
    const lr = typed(fence('graph LR\n  a --> b --> c; c --> a'));
    expect(lr.data).toMatchObject({ dir: 'LR', edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'a' }] });
    expect(typed(fence('flowchart RL\n  a --> b')).data).toMatchObject({ dir: 'LR' });
    expect(typed(fence('flowchart BT\n  a --> b')).data).toMatchObject({ dir: 'LR' });
    expect(typed(fence('flowchart\n  a --> b')).data).toMatchObject({ dir: 'TB' });
  });

  it('validates with zero diagnostics', () => {
    expect(validateDocument(parseDocument(fence(FLOW), 'm'), 'm.md')).toEqual([]);
  });
});

describe('erDiagram → erd', () => {
  it('converts crow-foot relations, entity blocks with PK/FK, quoted names', () => {
    const seg = typed(fence(ERD));
    expect(seg.kind).toBe('erd');
    expect(seg.parseError).toBeUndefined();
    expect(seg.data).toEqual({
      entities: [
        {
          name: 'CUSTOMER',
          columns: [
            { name: 'id', type: 'uuid', pk: true },
            { name: 'email', type: 'string', unique: true, note: 'unique' },
            { name: 'name', type: 'string' },
          ],
        },
        {
          name: 'ORDER',
          columns: [
            { name: 'id', type: 'uuid', pk: true },
            { name: 'customer_id', type: 'uuid', fk: true },
            { name: 'total', type: 'int' },
          ],
        },
        { name: 'ORDER LINE' },
        { name: 'PRODUCT' },
        { name: 'INVOICE' },
      ],
      relations: [
        { from: 'CUSTOMER', to: 'ORDER', label: 'places', card: '1:N' },
        { from: 'ORDER', to: 'ORDER LINE', label: 'contains', card: '1:N' },
        { from: 'PRODUCT', to: 'ORDER LINE', label: 'appears in', card: 'N:M', identifying: false },
        { from: 'ORDER', to: 'INVOICE', card: 'N:1' },
      ],
    });
  });

  it('validates with zero diagnostics', () => {
    expect(validateDocument(parseDocument(fence(ERD), 'm'), 'm.md')).toEqual([]);
  });
});

describe('stateDiagram → state', () => {
  it('turns [*] into start/terminal pseudo-states, flattens composites, names states, skips notes', () => {
    const seg = typed(fence(STATE));
    expect(seg.kind).toBe('state');
    expect(seg.parseError).toBeUndefined();
    expect(seg.data).toEqual({
      dir: 'LR',
      states: [
        { id: '_start', kind: 'start' },
        { id: 'Draft', name: 'Being written' },
        { id: 'Review', name: 'Review' },
        { id: 'Approved', name: 'Approved' },
        { id: 'Live', name: 'Published live' },
        { id: '_end', kind: 'terminal' },
        { id: '_start_Approved', kind: 'start' },
        { id: 'Queued', name: 'Queued' },
        { id: 'Sent', name: 'Sent' },
      ],
      transitions: [
        { from: '_start', to: 'Draft', event: '' },
        { from: 'Draft', to: 'Review', event: 'submit' },
        { from: 'Review', to: 'Draft', event: 'reject' },
        { from: 'Review', to: 'Approved', event: 'approve' },
        { from: 'Approved', to: 'Live', event: 'publish' },
        { from: 'Live', to: '_end', event: '' },
        { from: '_start_Approved', to: 'Queued', event: '' },
        { from: 'Queued', to: 'Sent', event: 'dispatch' },
      ],
    });
  });

  it('keeps the event on a [*] transition and reuses one pseudo-state per level', () => {
    const seg = typed(fence('stateDiagram-v2\n  [*] --> a : boot\n  [*] --> b\n  a --> [*]\n  b --> [*] : halt'));
    expect(seg.data).toEqual({
      states: [
        { id: '_start', kind: 'start' },
        { id: 'a', name: 'a' },
        { id: 'b', name: 'b' },
        { id: '_end', kind: 'terminal' },
      ],
      transitions: [
        { from: '_start', to: 'a', event: 'boot' },
        { from: '_start', to: 'b', event: '' },
        { from: 'a', to: '_end', event: '' },
        { from: 'b', to: '_end', event: 'halt' },
      ],
    });
  });

  it('accepts `stateDiagram` and an event-less transition (empty event)', () => {
    const seg = typed(fence('stateDiagram\n  a --> b'));
    expect(seg.data).toEqual({
      states: [
        { id: 'a', name: 'a' },
        { id: 'b', name: 'b' },
      ],
      transitions: [{ from: 'a', to: 'b', event: '' }],
    });
  });

  it('validates with zero diagnostics', () => {
    expect(validateDocument(parseDocument(fence(STATE), 'm'), 'm.md')).toEqual([]);
  });
});

describe('pie → chart', () => {
  it('converts the title and slices to a donut', () => {
    const seg = typed(fence(PIE));
    expect(seg.kind).toBe('chart');
    expect(seg.data).toEqual({
      kind: 'donut',
      title: 'Traffic by source',
      items: [
        { label: 'Search', value: 52 },
        { label: 'Direct', value: 30.5 },
        { label: 'Referral', value: 17.5 },
      ],
    });
  });

  it('reads a title on the header line', () => {
    expect(typed(fence('pie title Pets\n  "Dogs" : 3')).data).toEqual({
      kind: 'donut',
      title: 'Pets',
      items: [{ label: 'Dogs', value: 3 }],
    });
  });

  it('validates with zero diagnostics', () => {
    expect(validateDocument(parseDocument(fence(PIE), 'm'), 'm.md')).toEqual([]);
  });
});

describe('the fence and the splitter', () => {
  it('an unsupported Mermaid grammar stays prose and is never a suspect fence', () => {
    const md = 'Intro.\n\n' + fence('gantt\n  title A\n  section S\n  Task : 2026-01-01, 3d') + '\nOutro.\n';
    const raws = splitMarkdown(md);
    expect(raws.every((r) => r.kind === 'markdown')).toBe(true);
    expect(detectSuspectFences(md)).toEqual([]);
    const doc = parseDocument(md, 'm');
    expect(doc.segments.every((s) => s.kind === 'markdown')).toBe(true);
    expect(validateDocument(doc, 'm.md')).toEqual([]);
  });

  it('a supported fence is typed with sourceType mermaid; comments before the keyword are fine', () => {
    const raws = splitMarkdown(fence('%% note\n\nerDiagram\n  A ||--|| B : x'));
    expect(raws).toEqual([
      { kind: 'erd', sourceType: 'mermaid', raw: '%% note\n\nerDiagram\n  A ||--|| B : x', line: 1 },
    ]);
  });

  it('detectMermaidKind maps every keyword; other grammars are undefined', () => {
    expect(Object.keys(MERMAID_KEYWORDS).sort()).toEqual(
      ['erDiagram', 'flowchart', 'graph', 'pie', 'sequenceDiagram', 'stateDiagram', 'stateDiagram-v2'].sort(),
    );
    expect(detectMermaidKind('flowchart LR\n')).toBe('flow');
    expect(detectMermaidKind('stateDiagram-v2')).toBe('state');
    expect(detectMermaidKind('classDiagram\n  A <|-- B')).toBeUndefined();
    expect(detectMermaidKind('mindmap')).toBeUndefined();
    expect(detectMermaidKind('')).toBeUndefined();
  });

  it('never emits W_ALIAS_TYPE (or any warning) for a mermaid fence', () => {
    const md = '```meta\ntitle: T\n```\n\n' + fence(SEQUENCE) + '\n' + fence(FLOW);
    const diags = validateDocument(parseDocument(md, 'm'), 'm.md');
    expect(diags).toEqual([]);
  });
});

describe('errors', () => {
  it('a line the subset cannot read is E_PARSE_MERMAID at that document line', () => {
    const md = '# Title\n\n' + fence('sequenceDiagram\n  A->>B: ok\n  this is not a message');
    const seg = typed(md);
    expect(seg.parseError).toContain('cannot read sequenceDiagram line');
    expect(seg.parseErrorLine).toBe(3);
    const diags = validateDocument(parseDocument(md, 'm'), 'm.md');
    expect(diags).toHaveLength(1);
    // fence on line 3; the bad line is body line 3 → document line 6.
    expect(diags[0]).toMatchObject({ code: 'E_PARSE_MERMAID', level: 'error', line: 6 });
    expect(diags[0]?.hint).toContain('reference/mermaid.md');
  });

  it('each converter reports the offending line', () => {
    expect(convertMermaid('flow', 'flowchart LR\n  a --> \n')).toMatchObject({ ok: false, line: 2 });
    expect(convertMermaid('flow', 'flowchart LR\n  a[unclosed --> b')).toMatchObject({ ok: false, line: 2 });
    expect(convertMermaid('erd', 'erDiagram\n  A ||--o{ B : x\n  nope')).toMatchObject({ ok: false, line: 3 });
    expect(convertMermaid('erd', 'erDiagram\n  A {\n    id\n  }')).toMatchObject({ ok: false, line: 3 });
    expect(convertMermaid('state', 'stateDiagram-v2\n  a --> b\n  ???')).toMatchObject({ ok: false, line: 3 });
    expect(convertMermaid('chart', 'pie\n  "A" : x')).toMatchObject({ ok: false, line: 2 });
    expect(convertMermaid('table', 'pie')).toMatchObject({ ok: false });
  });
});

describe('edit round-trip', () => {
  it('replaceBlockBody on a mermaid segment writes the canonical fence tag + YAML', () => {
    const src = '# Doc\n\n' + fence(SEQUENCE) + '\nAfter.\n';
    const doc = parseDocument(src, 'm');
    const seg = doc.segments[1];
    if (seg === undefined || seg.kind === 'markdown') throw new Error('expected block');
    const yaml = editableBodyYaml(seg);
    expect(yaml.startsWith('title: Checkout')).toBe(true);
    const next = replaceBlockBody(src, doc, 1, yaml);
    expect(next).not.toContain('```mermaid');
    expect(next).toContain('```sequence\n');
    expect(next).toContain('After.');
    const reparsed = parseDocument(next, 'm').segments[1];
    if (reparsed === undefined || reparsed.kind === 'markdown') throw new Error('expected block');
    expect(reparsed.sourceType).toBeUndefined();
    expect(reparsed.data).toEqual(seg.data);
    expect(validateDocument(parseDocument(next, 'm'), 'm.md')).toEqual([]);
  });

  it('a structured path edit lands on the canonical YAML (what the studio does)', () => {
    const src = fence(PIE);
    const doc = parseDocument(src, 'm');
    const seg = doc.segments[0];
    if (seg === undefined || seg.kind === 'markdown') throw new Error('expected block');
    const next = replaceBlockBody(src, doc, 0, setYamlPath(editableBodyYaml(seg), ['title'], 'Sources'));
    expect(next.startsWith('```chart\n')).toBe(true);
    const re = parseDocument(next, 'm').segments[0];
    expect(re !== undefined && re.kind !== 'markdown' ? re.data : undefined).toMatchObject({
      kind: 'donut',
      title: 'Sources',
    });
  });

  it('writing the same Mermaid text back leaves the source untouched', () => {
    const src = fence(FLOW);
    const doc = parseDocument(src, 'm');
    expect(replaceBlockBody(src, doc, 0, FLOW)).toBe(src);
  });

  it('editableBodyYaml returns the raw body for a plain YAML block', () => {
    const seg = typed('```callout\ntone: note\nbody: hi\n```\n');
    expect(editableBodyYaml(seg)).toBe('tone: note\nbody: hi');
  });
});
