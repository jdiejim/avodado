import { describe, expect, it } from 'vitest';
import { parseDocument } from '@avodado/core';
import { toSlides } from '../deck.js';
import { toSlides as toSlidesFromIndex } from '../index.js';

const SPLIT_DOC = [
  '```meta',
  'title: Split test',
  '```',
  '',
  '## The message {split}',
  '',
  'Revenue is up and to the right.',
  '',
  '```stats',
  'stats:',
  '  - { value: "$120k", label: MRR, delta: "+12%", trend: up }',
  '```',
].join('\n');

describe('toSlides', () => {
  it('a {split} heading yields the consulting layout — message left, exhibit right', () => {
    const html = toSlides(parseDocument(SPLIT_DOC, 'split-test'));
    expect(html).toContain('sl-split');
    expect(html).toContain('sl-msg'); // prose column
    expect(html).toContain('sl-exhibit'); // block column
  });

  it('ships the fit() text-only scale-cap branch in the deck script', () => {
    const html = toSlides(parseDocument(SPLIT_DOC, 'split-test'));
    // Text-only slides barely scale up; slides with a visual get ~1.5x.
    expect(html).toContain('var cap=visual?1.5:1.08');
  });

  it('a tabular exhibit takes the stage width instead of being scaled up into it', () => {
    const html = toSlides(parseDocument(SPLIT_DOC, 'split-test'));
    // The inner shrink-wraps by default so fit() can enlarge a lone block; a
    // table would then resolve width:100% against its own intrinsic width.
    expect(html).toContain('.docskin.slide .slide-inner:has(table)');
    // …and the size comes from type, not from transform.
    expect(html).toMatch(/\.pres-table[^{]*\{font-size:18px;\}/);
  });

  it('stacked cards go across the stage, and hero text keeps its shrink-wrap', () => {
    const html = toSlides(parseDocument(SPLIT_DOC, 'split-test'));
    // Card lists become auto-fit rows — as many as fit, then wrap.
    expect(html).toMatch(/\.slo-list\{grid-template-columns:repeat\(auto-fit,minmax\(\d+px,1fr\)\)/);
    expect(html).toContain('.docskin.slide :is(.slo-list,.okr-list,.st-list,.env-steps,.tr-list){display:grid');
    // …and those blocks stop shrink-wrapping so the row has the stage.
    expect(html).toMatch(/\.slide-inner:has\(:is\([^)]*\.slo[,)]/s);
    // A pull quote and a big number are hero text: width was never the problem,
    // so they keep the shrink-wrap that lets fit() enlarge them.
    expect(html).not.toMatch(/\.slide-inner:has\(:is\([^)]*\.bn[,)]/s);
    expect(html).toContain('.docskin.slide .pull-text{font-size:22px');
    // The multicol pass keeps the text lists; the card lists are grids now.
    expect(html).not.toContain(".slide .slo-list,'");
  });

  it('carries the slide legibility floor for the library’s small labels', () => {
    const html = toSlides(parseDocument(SPLIT_DOC, 'split-test'));
    // A sample from each of the three groups (eyebrows, chips, notes).
    for (const cls of ['.stat-label', '.rk-sev', '.slo-caption', '.edge-step']) {
      expect(html, `floor should cover ${cls}`).toContain(cls);
    }
    expect((html.match(/\{font-size:12\.5px;\}/g) ?? []).length).toBeGreaterThanOrEqual(3);
    // SVG diagram labels are excluded on purpose — their wrap widths are baked
    // into the viewBox, so they move per diagram, not in a sweep.
    expect(html).not.toContain('.fc-label{font-size');
  });

  it('aliased fences keep their historical SECTION labels in the deck', () => {
    const aliasDoc = [
      '```meta',
      'title: Alias deck',
      '```',
      '',
      '```waterfall',
      'unit: ms',
      'items:',
      '  - { label: DNS, value: 35 }',
      '```',
      '',
      '```infra',
      'nodes:',
      '  - { id: api, col: 1, row: 1, name: API }',
      '```',
    ].join('\n');
    const html = toSlides(parseDocument(aliasDoc, 'alias-deck'));
    // Slide headers read `NN · <label>` — the labels the old types carried.
    expect(html).toContain('· Budget');
    expect(html).toContain('· Deployment');
    // The blocks themselves rendered through the canonical renderers.
    expect(html).toContain('Budget waterfall');
    expect(html).toContain('>INFRA</span>');
  });

  it('steps through data-reveal builds before advancing, and {nobuild} opts a slide out', () => {
    const doc = [
      '```meta',
      'title: Build deck',
      '```',
      '',
      '## Runbook {nobuild}',
      '',
      '```steps',
      'items:',
      '  - { title: One }',
      '  - { title: Two }',
      '```',
      '',
      '## Timeline {top}',
      '',
      '```timeline',
      'items:',
      '  - { label: a }',
      '  - { label: b }',
      '```',
    ].join('\n');
    const html = toSlides(parseDocument(doc, 'build-deck'));
    // The marker is stripped from the title and stamped on the slide.
    expect(html).toContain('<div class="docskin slide" data-nobuild="">');
    expect(html).toContain('<div class="slide-hd-l">Runbook</div>');
    expect(html).not.toContain('Runbook {nobuild}');
    // The other slide keeps its own marker's effect and has no opt-out.
    expect(html).toContain('slide-content sl-top');
    expect((html.match(/data-nobuild=""/g) ?? []).length).toBe(1);
    // The reveal attributes are in the markup; the controller reads them.
    expect(html).toContain('data-reveal="1"');
    expect(html).toContain("querySelectorAll('[data-reveal]')");
    expect(html).toContain("hasAttribute('data-nobuild')");
    // Builds are announced; the hash carries the slide index only.
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("'Step '+(bat+1)+' of '+bsteps.length");
    expect(html).toContain("history.replaceState(null,'','#'+(i+1))");
    // Backspace / ← walk back; → only advances past the last step.
    expect(html).toContain("e.key==='Backspace'");
    expect(html).toContain("if(bat<bsteps.length-1){bat+=1;paintBuild(true);}");
    // Nothing is hidden without JS; print shows everything; motion respects the preference.
    expect(html).toContain('.docskin.slide .rv-hide{visibility:hidden;opacity:0;}');
    expect(html).toContain('.docskin.slide .rv-hide{visibility:visible!important;opacity:1!important;}');
    expect(html).toContain('@media (prefers-reduced-motion: reduce){.docskin.slide [data-reveal]{transition:none;}}');
    // The current step maps to the accent through tokens, never a hex value.
    expect(html).toContain('.is-current *):is(line,path,polyline){stroke:var(--accent)!important;}');
  });

  it('is exported from the package index and yields a standalone document', () => {
    const html = toSlidesFromIndex(parseDocument(SPLIT_DOC, 'split-test'));
    expect(html).toBe(toSlides(parseDocument(SPLIT_DOC, 'split-test')));
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('class="deck-nav"'); // navigation chrome present
  });
});
