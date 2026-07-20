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
