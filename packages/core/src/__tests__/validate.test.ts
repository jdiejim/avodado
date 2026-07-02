import { describe, expect, it } from 'vitest';
import { parseDocument } from '../parser.js';
import { validateDocument } from '../validate.js';
import { ordersApi, roadmap } from './fixtures.js';

describe('validateDocument', () => {
  it('reports zero diagnostics for the avodado-roadmap fixture', () => {
    const doc = parseDocument(roadmap(), 'avodado-roadmap');
    const diags = validateDocument(doc, 'resources/avodado-roadmap.md');
    expect(diags).toEqual([]);
  });

  it('reports zero diagnostics for the orders-api fixture', () => {
    const doc = parseDocument(ordersApi(), 'orders-api');
    const diags = validateDocument(doc, 'resources/orders-api.md');
    expect(diags).toEqual([]);
  });

  it('reports E_PARSE_YAML pointing at the offending body line (not the fence)', () => {
    const md = '\n\n```callout\nkind: [oops\n```\n';
    const doc = parseDocument(md, 'broken');
    const diags = validateDocument(doc, 'broken.md');
    expect(diags).toHaveLength(1);
    expect(diags[0]).toMatchObject({
      file: 'broken.md',
      level: 'error',
      code: 'E_PARSE_YAML',
      // fence is on line 3; the bad `kind: [oops` is the next line.
      line: 4,
    });
    expect(diags[0]?.hint).toBeDefined();
  });

  it('reports E_SCHEMA at the offending token with a did-you-mean suggestion', () => {
    const md = '```callout\ntone: oops\n```\n';
    const doc = parseDocument(md, 'bad-enum');
    const diags = validateDocument(doc, 'bad-enum.md');
    expect(diags.length).toBeGreaterThan(0);
    // the `tone: oops` value is on document line 2, with a real column.
    expect(diags[0]).toMatchObject({ code: 'E_SCHEMA', level: 'error', line: 2 });
    expect(diags[0]?.column).toBeGreaterThan(0);
    expect(diags[0]?.message).toContain('oops');
    expect(diags[0]?.hint).toContain('note');
  });

  it('suggests the nearest field for an unknown key', () => {
    // `bodyy` is a typo of `body`.
    const md = '```callout\ntone: note\nbodyy: hi\n```\n';
    const diags = validateDocument(parseDocument(md, 'typo'), 'typo.md');
    const schema = diags.find((d) => d.code === 'E_SCHEMA');
    expect(schema?.suggestions).toContain('body');
    expect(schema?.hint).toContain('body');
  });

  it('hints to quote a string field that received a number', () => {
    // `tag` wants a string; `123` parses as a number.
    const md = '```meta\ntitle: T\ntag: 123\n```\n';
    const diags = validateDocument(parseDocument(md, 'num'), 'num.md');
    const schema = diags.find((d) => d.code === 'E_SCHEMA');
    expect(schema?.hint).toContain('Quote');
  });

  it('warns W_SUSPECT_BLOCK for a typo\'d fence tag', () => {
    const md = '```sequnce\nactors: []\n```\n';
    const diags = validateDocument(parseDocument(md, 'sus'), 'sus.md');
    const sus = diags.find((d) => d.code === 'W_SUSPECT_BLOCK');
    expect(sus).toBeDefined();
    expect(sus?.suggestions).toContain('sequence');
    expect(sus?.line).toBe(1);
  });

  it('reports E_SCHEMA when a sequence message lacks required from/to', () => {
    const md = '```sequence\nmessages:\n  - { label: hi }\n```\n';
    const doc = parseDocument(md, 'bad-seq');
    const diags = validateDocument(doc, 'bad-seq.md');
    expect(diags.length).toBeGreaterThan(0);
    expect(diags.every((d) => d.code === 'E_SCHEMA')).toBe(true);
  });

  it('reports E_SCHEMA on unknown top-level fields (strict mode)', () => {
    const md = '```callout\ntone: note\nunknown: 1\n```\n';
    const doc = parseDocument(md, 'extra');
    const diags = validateDocument(doc, 'extra.md');
    expect(diags.some((d) => d.code === 'E_SCHEMA' && d.message.includes('unknown'))).toBe(true);
  });

  it('warns W_EMPTY_BLOCK on an empty body', () => {
    const md = '```callout\n```\n';
    const doc = parseDocument(md, 'empty');
    const diags = validateDocument(doc, 'empty.md');
    expect(diags).toHaveLength(1);
    expect(diags[0]).toMatchObject({ code: 'W_EMPTY_BLOCK', level: 'warn' });
  });
});
