/**
 * Edge-case coverage for the parser + resolver hardening pass.
 */

import { describe, expect, it } from 'vitest';
import { parseDocument } from '../parser.js';
import { resolveRefs } from '../resolve.js';

describe('parseDocument — meta detection', () => {
  it('extracts meta only when it is the first typed block', () => {
    const doc = parseDocument('```meta\ntitle: Hi\n```\n', 'd');
    expect(doc.meta).toEqual({ title: 'Hi' });
  });

  it('ignores a meta block that is not first', () => {
    const md = '```callout\nbody: x\n```\n\n```meta\ntitle: Late\n```\n';
    expect(parseDocument(md, 'd').meta).toBeUndefined();
  });

  it('treats prose before meta as not disqualifying (meta is first *typed* block)', () => {
    const md = 'Intro paragraph.\n\n```meta\ntitle: Hi\n```\n';
    expect(parseDocument(md, 'd').meta).toEqual({ title: 'Hi' });
  });

  it('does not crash when a block body parses to an array', () => {
    // `- a` makes the YAML body a sequence (array), not a mapping.
    const md = '```meta\n- a\n- b\n```\n';
    const doc = parseDocument(md, 'd');
    expect(doc.meta).toBeUndefined();
    expect(doc.segments[0]?.kind).toBe('meta');
  });

  it('does not extract an id when the body is an array', () => {
    const md = '```tracker\n- a\n- b\n```\n';
    const seg = parseDocument(md, 'd').segments[0];
    expect(seg?.kind).toBe('tracker');
    if (seg && seg.kind !== 'markdown') expect(seg.id).toBeUndefined();
  });

  it('handles many blocks without quadratic meta re-scanning (smoke)', () => {
    const blocks = Array.from(
      { length: 300 },
      (_, i) => `\`\`\`callout\nbody: item ${i}\n\`\`\``,
    ).join('\n\n');
    const doc = parseDocument(`\`\`\`meta\ntitle: T\n\`\`\`\n\n${blocks}\n`, 'big');
    expect(doc.meta).toEqual({ title: 'T' });
    expect(doc.segments.filter((s) => s.kind !== 'markdown')).toHaveLength(301);
  });
});

describe('resolveRefs — ref slug characters', () => {
  it('accepts dotted + nested doc slugs and dotted ids', () => {
    const a = parseDocument('```sequence\nid: seq.v2\nactors: []\nmessages: []\n```\n', 'api/v2.0');
    const b = parseDocument(
      '```userstory\nrole: u\nwant: w\nsoThat: t\nlinks:\n  - { ref: "api/v2.0#seq.v2", label: x }\n```\n',
      'b',
    );
    const { diagnostics } = resolveRefs([
      { doc: a, file: 'a.md' },
      { doc: b, file: 'b.md' },
    ]);
    expect(diagnostics).toEqual([]);
  });

  it('still flags a genuinely malformed ref', () => {
    const doc = parseDocument(
      '```userstory\nrole: u\nwant: w\nsoThat: t\nlinks:\n  - { ref: "no hash here", label: x }\n```\n',
      'd',
    );
    const { diagnostics } = resolveRefs([{ doc, file: 'd.md' }]);
    expect(diagnostics[0]?.code).toBe('E_BAD_REF_FORMAT');
  });
});
