import { describe, expect, it } from 'vitest';
import { parse } from 'node-html-parser';
import { parseDocument } from '@avodado/core';
import { renderDocument } from '../document.js';
import { renderDocumentParts } from '../parts.js';
import { houseCss } from '../css.js';
import { ordersApi, roadmap } from './fixtures.js';

describe('renderDocument', () => {
  it('renders the roadmap fixture as a standalone HTML document', () => {
    const doc = parseDocument(roadmap(), 'avodado-roadmap');
    const html = renderDocument(doc);
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain(`<title>Avodado</title>`);
    expect(html).toContain('<style>');
    expect(html).toContain(houseCss);
    expect(html).not.toContain('class="err"');

    const root = parse(html);
    expect(root.querySelector('.docskin')).toBeTruthy();
    expect(root.querySelector('.cover-title')?.text).toBe('Avodado');
    // every typed block in the fixture renders to its expected container
    expect(root.querySelector('.callout')).toBeTruthy();
    expect(root.querySelector('.tl')).toBeTruthy();
    expect(root.querySelector('.kanban')).toBeTruthy();
    expect(root.querySelector('table.trk')).toBeTruthy();
    expect(root.querySelector('table.pres-table')).toBeTruthy();
  });

  it('renders the orders-api fixture with sequence + erd + userstory', () => {
    const doc = parseDocument(ordersApi(), 'orders-api');
    const html = renderDocument(doc);
    expect(html).not.toContain('parse error:');
    const root = parse(html);
    expect(root.querySelector('.cover-title')?.text).toContain('Order placement');
    // sequence + erd diagrams present (matched by their CSS signatures)
    expect(root.querySelector('.lane-head')).toBeTruthy();
    expect(root.querySelector('.er-head-text')).toBeTruthy();
    // userstory rendered with statement
    expect(root.querySelector('.story-stmt')?.text).toContain('shopper');
    // sequence's step list rendered (sample-style)
    expect(root.querySelector('.seq-steps')).toBeTruthy();
    expect(root.querySelector('.diagram-foot')).toBeTruthy();
    // POST endpoint tag with method class
    expect(root.querySelector('.diagram-tag.post')?.text).toBe('POST');
  });

  it('applies a theme via :root CSS variable overrides', () => {
    const doc = parseDocument(roadmap(), 'avodado-roadmap');
    const html = renderDocument(doc, { theme: 'teal' });
    // Theme vars are emitted as a :root style block so they reach the whole page.
    expect(html).toContain(':root{');
    expect(html).toContain('--navy:#0f766e');
  });

  it('merges custom themeVars after the named theme', () => {
    const doc = parseDocument(roadmap(), 'avodado-roadmap');
    const html = renderDocument(doc, { theme: 'dark', themeVars: { '--navy': '#abcdef' } });
    expect(html).toContain('--white:#161b26'); // from dark theme
    expect(html).toContain('--navy:#abcdef'); // override wins (emitted last)
  });

  it('falls back to "Untitled" when there is no meta block', () => {
    const doc = parseDocument('Just prose.\n', 'no-meta');
    const html = renderDocument(doc);
    expect(html).toContain('<title>Untitled</title>');
  });

  it('emits a block anchor + data-block-id when a block has a user id', () => {
    const doc = parseDocument('```callout\nid: my-note\ntone: tip\nbody: Hello\n```\n', 'anchors');
    const parts = renderDocumentParts(doc);
    // The <section> keeps its positional id; the user id lands on a nested anchor.
    expect(parts.body).toContain(
      '<section id="section-01" class="section-block" data-block-id="my-note">',
    );
    expect(parts.body).toContain(
      '<span class="block-anchor" id="my-note" aria-hidden="true"></span>',
    );
    expect(parts.sections[0]?.blockId).toBe('my-note');
  });

  it('emits no block anchor for a block without a user id', () => {
    const doc = parseDocument('```callout\ntone: tip\nbody: Hello\n```\n', 'anchors');
    const parts = renderDocumentParts(doc);
    expect(parts.body).toContain('<section id="section-01" class="section-block">');
    expect(parts.body).not.toContain('block-anchor');
    expect(parts.sections[0]?.blockId).toBeUndefined();
  });

  it('emits an err div for a block with a parse error', () => {
    const doc = parseDocument('```callout\nkind: [oops\n```\n', 'broken');
    const html = renderDocument(doc);
    expect(html).toContain('class="err"');
    expect(html).toContain('callout block — parse error:');
  });

  it('is deterministic — repeated renders produce identical output', () => {
    const doc = parseDocument(ordersApi(), 'orders-api');
    expect(renderDocument(doc)).toBe(renderDocument(doc));
  });
});
