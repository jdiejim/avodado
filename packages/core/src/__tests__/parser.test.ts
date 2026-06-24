import { describe, expect, it } from 'vitest';
import { parseDocument } from '../parser.js';
import { ordersApi, roadmap } from './fixtures.js';

describe('parseDocument', () => {
  it('parses the avodado-roadmap fixture without crashing', () => {
    const doc = parseDocument(roadmap(), 'avodado-roadmap');
    expect(doc.slug).toBe('avodado-roadmap');
    expect(doc.meta).toMatchObject({ title: 'Avodado', tag: 'ROADMAP · v0.1' });
    const typedKinds = doc.segments.filter((s) => s.kind !== 'markdown').map((s) => s.kind);
    expect(typedKinds).toEqual(['meta', 'callout', 'timeline', 'kanban', 'tracker', 'table', 'callout']);
  });

  it('parses the orders-api fixture and extracts the userstory id', () => {
    const doc = parseDocument(ordersApi(), 'orders-api');
    expect(doc.meta?.title).toContain('Order placement');
    const userstory = doc.segments.find((s) => s.kind === 'userstory');
    expect(userstory).toBeDefined();
    if (userstory && userstory.kind === 'userstory') {
      expect(userstory.id).toBe('US-142');
    }
  });

  it('records parseError on a malformed block body instead of throwing', () => {
    const md = '```callout\nkind: [oops\n```\n';
    const doc = parseDocument(md, 'broken');
    const seg = doc.segments[0];
    expect(seg?.kind).toBe('callout');
    if (seg && seg.kind === 'callout') {
      expect(seg.parseError).toBeDefined();
      expect(seg.data).toBeUndefined();
    }
  });

  it('captures the opening fence line number for each typed segment', () => {
    const md = '## Intro\n\nProse.\n\n```callout\nkind: note\n```\n';
    const doc = parseDocument(md, 'lines');
    const callout = doc.segments.find((s) => s.kind === 'callout');
    expect(callout?.line).toBe(5);
  });

  it('only treats the first typed block as meta if it is a meta block', () => {
    const md = '```callout\nkind: note\n```\n```meta\ntitle: Late\n```\n';
    const doc = parseDocument(md, 'late-meta');
    expect(doc.meta).toBeUndefined();
  });
});
