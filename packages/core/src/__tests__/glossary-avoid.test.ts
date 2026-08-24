import { describe, expect, it } from 'vitest';
import { glossarySchema } from '../blocks/schemas.js';
import { normalizeBlockData } from '../blocks/normalize.js';
import { parseDocument } from '../parser.js';
import { validateDocument } from '../validate.js';

describe('glossary `avoid` field', () => {
  it('accepts an optional avoid string list per term', () => {
    const r = glossarySchema.safeParse({
      terms: [{ term: 'SLO', def: 'The objective.', avoid: ['uptime target'] }],
    });
    expect(r.success).toBe(true);
  });

  it('stays optional — terms without avoid still validate', () => {
    const r = glossarySchema.safeParse({ terms: [{ term: 'SLO', def: 'The objective.' }] });
    expect(r.success).toBe(true);
  });

  it('rejects a non-array avoid', () => {
    const r = glossarySchema.safeParse({
      terms: [{ term: 'SLO', def: 'The objective.', avoid: 'uptime target' }],
    });
    expect(r.success).toBe(false);
  });

  it('validates end to end in a document', () => {
    const md = `\`\`\`glossary
terms:
  - term: SLO
    def: The service-level objective.
    avoid: [uptime target, service promise]
\`\`\`
`;
    const diags = validateDocument(parseDocument(md, 'g'), 'g.md');
    expect(diags).toEqual([]);
  });

  it('terse-grammar rescue leaves an `avoid` key alone (it is a known field)', () => {
    // YAML turns an unquoted `- avoid: uptime target` into a single-pair map.
    // `avoid` is a known term field now, so the rescue must NOT expand it
    // into `{ term: 'avoid', def: 'uptime target' }`.
    const out = normalizeBlockData('glossary', {
      terms: [{ avoid: 'uptime target' }],
    }) as { terms: unknown[] };
    expect(out.terms[0]).toEqual({ avoid: 'uptime target' });
  });

  it('terse em-dash items still expand next to object terms with avoid', () => {
    const out = normalizeBlockData('glossary', {
      terms: [
        'SLO — the objective.',
        { term: 'Saga', def: 'A split transaction.', avoid: ['workflow'] },
      ],
    }) as { terms: unknown[] };
    expect(out.terms[0]).toEqual({ term: 'SLO', def: 'the objective.' });
    expect(out.terms[1]).toEqual({ term: 'Saga', def: 'A split transaction.', avoid: ['workflow'] });
  });
});
