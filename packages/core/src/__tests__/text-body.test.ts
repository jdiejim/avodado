/**
 * Bare-text bodies for text-first blocks (callout `body`, pullquote `text`):
 * the fence body is the text — no YAML, so colons/quotes/dashes never need
 * escaping. A body whose first non-blank line is a known `field:` (or `id:`)
 * still parses as YAML — that's the escape hatch back to fields.
 */

import { describe, expect, it } from 'vitest';
import { parseDocument } from '../parser.js';
import { validateDocument } from '../validate.js';
import { textBodyData, textBodyYaml } from '../blocks/normalize.js';

const fence = (kind: string, body: string): string => `\`\`\`${kind}\n${body}\n\`\`\`\n`;

describe('bare-text bodies', () => {
  it('a callout body that is just prose becomes { body } — colons and all', () => {
    const md = fence('callout', 'Heads up: the rate limit is 100 req/min. Plan: retry with backoff.');
    const doc = parseDocument(md, 't');
    expect(doc.segments[0]).toMatchObject({
      kind: 'callout',
      data: { body: 'Heads up: the rate limit is 100 req/min. Plan: retry with backoff.' },
    });
    expect(validateDocument(doc, 't.md')).toHaveLength(0);
  });

  it('multi-line prose (with blank lines) stays one body string', () => {
    const md = fence('callout', 'First paragraph.\n\nSecond: with a colon.');
    const doc = parseDocument(md, 't');
    const data = doc.segments[0]?.kind === 'callout' ? doc.segments[0].data : undefined;
    expect(data).toEqual({ body: 'First paragraph.\n\nSecond: with a colon.' });
  });

  it('a field-led body still parses as YAML (tone/title/body/id)', () => {
    const md = fence('callout', 'tone: tip\nbody: Explicit fields still work');
    const doc = parseDocument(md, 't');
    expect(doc.segments[0]).toMatchObject({ data: { tone: 'tip', body: 'Explicit fields still work' } });

    const withId = parseDocument(fence('callout', 'id: c1\nbody: hi'), 't');
    expect(withId.segments[0]).toMatchObject({ id: 'c1' });
  });

  it('pullquote takes its quote as bare text', () => {
    const md = fence('pullquote', 'Simplicity is the ultimate sophistication.');
    const doc = parseDocument(md, 't');
    expect(doc.segments[0]).toMatchObject({
      data: { text: 'Simplicity is the ultimate sophistication.' },
    });
    expect(validateDocument(doc, 't.md')).toHaveLength(0);
  });

  it('an empty body still reports W_EMPTY_BLOCK (no sugar)', () => {
    const doc = parseDocument(fence('callout', ''), 't');
    expect(validateDocument(doc, 't.md').some((d) => d.code === 'W_EMPTY_BLOCK')).toBe(true);
  });

  it('non-text-first kinds are untouched', () => {
    expect(textBodyData('table', 'random text')).toBeUndefined();
    expect(textBodyData('sequence', 'a -> b: hi')).toBeUndefined();
  });

  it('textBodyYaml canonicalizes to YAML that parses back to the same data', () => {
    const raw = 'Heads up: the limit is 100.\n\nSecond line.';
    const yaml = textBodyYaml('callout', raw);
    expect(yaml).toBeDefined();
    const reparsed = parseDocument(fence('callout', (yaml ?? '').trimEnd()), 't');
    expect(reparsed.segments[0]).toMatchObject({ data: { body: raw } });
    // Field-led / non-text bodies do not canonicalize.
    expect(textBodyYaml('callout', 'tone: tip')).toBeUndefined();
    expect(textBodyYaml('table', 'text')).toBeUndefined();
  });
});
