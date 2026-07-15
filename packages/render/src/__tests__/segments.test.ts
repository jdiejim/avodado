import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseDocument, type Document } from '@avodado/core';
import { renderDocumentParts, renderDocumentSegments } from '../parts.js';
import { ordersApi, roadmap } from './fixtures.js';

const CLI_TEMPLATES = resolve(import.meta.dirname, '../../../cli/templates');

function cliTemplate(name: string): string {
  return readFileSync(resolve(CLI_TEMPLATES, name), 'utf8');
}

/** Every fixture doc we can get our hands on, parsed. */
function fixtureDocs(): Array<{ name: string; doc: Document }> {
  return [
    { name: 'avodado-roadmap', doc: parseDocument(roadmap(), 'avodado-roadmap') },
    { name: 'orders-api', doc: parseDocument(ordersApi(), 'orders-api') },
    { name: 'demo', doc: parseDocument(cliTemplate('demo.md'), 'demo') },
    {
      name: 'getting-started',
      doc: parseDocument(cliTemplate('docs/getting-started.md'), 'getting-started'),
    },
    { name: 'tutorial', doc: parseDocument(cliTemplate('docs/tutorial.md'), 'tutorial') },
  ];
}

describe('renderDocumentSegments', () => {
  it('recomposes byte-identically to renderDocumentParts for every fixture', () => {
    for (const { name, doc } of fixtureDocs()) {
      for (const opts of [{}, { theme: 'teal' as const }]) {
        const parts = renderDocumentParts(doc, opts);
        const seg = renderDocumentSegments(doc, opts);
        const recomposed = seg.defs + seg.cover + seg.segments.map((s) => s.html).join('');
        expect(recomposed, name).toBe(parts.body);
        expect(seg.css, name).toBe(parts.css);
        expect(seg.themeVars, name).toBe(parts.themeVars);
        expect(seg.title, name).toBe(parts.title);
        expect(seg.sections, name).toEqual(parts.sections);
      }
    }
  });

  it('emits exactly one entry per doc segment, index-aligned', () => {
    for (const { name, doc } of fixtureDocs()) {
      const seg = renderDocumentSegments(doc);
      expect(seg.segments.length, name).toBe(doc.segments.length);
      // Entries carrying a section id line up 1:1, in order, with `sections`.
      const withSections = seg.segments.filter((s) => s.sectionId !== undefined);
      expect(withSections.map((s) => s.sectionId), name).toEqual(seg.sections.map((s) => s.id));
      expect(withSections.map((s) => s.sectionNum), name).toEqual(seg.sections.map((s) => s.num));
    }
  });

  it('handles meta, prose, parse errors, and empty blocks in one document', () => {
    const md = [
      '```meta',
      'title: Segment fixture',
      '```',
      '',
      'Intro prose.',
      '',
      '```callout',
      'tone: [broken',
      '```',
      '',
      '```callout',
      '```',
      '',
      '```callout',
      'tone: note',
      'title: Fine',
      '```',
      '',
      '```table',
      'columns: [A]',
      'rows:',
      '  - [x]',
      '```',
      '',
    ].join('\n');
    const doc = parseDocument(md, 'seg-fixture');
    expect(doc.segments.map((s) => s.kind)).toEqual([
      'meta',
      'markdown',
      'callout',
      'callout',
      'callout',
      'table',
    ]);

    const result = renderDocumentSegments(doc);
    expect(result.segments).toHaveLength(6);
    expect(result.title).toBe('Segment fixture');
    expect(result.cover).toContain('Segment fixture');

    const [meta, prose, broken, empty, fine, table] = result.segments;
    expect(meta?.html).toBe('');
    expect(meta?.sectionId).toBeUndefined();
    expect(prose?.html).toContain('Intro prose.');
    expect(prose?.sectionId).toBeUndefined();
    expect(broken?.html).toContain('class="err"');
    expect(broken?.sectionId).toBeUndefined();
    expect(empty?.html).toBe('');
    expect(empty?.sectionId).toBeUndefined();
    expect(fine?.html).toContain('Fine');
    expect(fine?.sectionId).toBe('section-01');
    expect(fine?.sectionNum).toBe(1);
    expect(table?.sectionId).toBe('section-02');
    expect(table?.sectionNum).toBe(2);
    expect(result.sections.map((s) => s.id)).toEqual(['section-01', 'section-02']);

    // The single-code-path invariant holds here too.
    const recomposed =
      result.defs + result.cover + result.segments.map((s) => s.html).join('');
    expect(recomposed).toBe(renderDocumentParts(doc).body);
  });
});

describe('section-head data paths (v7)', () => {
  it('tags every block’s top-level title and lede in the section head', () => {
    const doc = parseDocument(
      '```meta\ntitle: T\n```\n\n```flow\ntitle: My flow\nlede: The intro line.\nnodes:\n  - { id: a, label: A }\n```\n',
      'x',
    );
    const seg = renderDocumentSegments(doc, {});
    const html = seg.segments.map((s) => s.html).join('');
    expect(html).toContain('<h2 class="section-title" data-bp="title">My flow</h2>');
    expect(html).toContain('<p class="section-lede" data-bp="lede">The intro line.</p>');
  });

  it('renders a bare section head (no title/lede) as just the eyebrow — no empty h2, no rule band', () => {
    // divider OWNS its title, so the section head has neither title nor lede.
    const doc = parseDocument(
      '```meta\ntitle: T\n```\n\n```divider\nkicker: PART 2\ntitle: What we change\n```\n',
      'x',
    );
    const seg = renderDocumentSegments(doc, {});
    const html = seg.segments.map((s) => s.html).join('');
    expect(html).toContain('<div class="section-head bare">');
    expect(html).not.toContain('<h2 class="section-title" data-bp="title"></h2>');
    // section id + index still work
    expect(seg.sections.map((s) => s.id)).toEqual(['section-01']);
  });
});
