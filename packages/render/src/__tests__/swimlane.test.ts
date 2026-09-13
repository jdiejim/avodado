/**
 * `swimlane`: lanes by label, columns derived from the links, phase bands,
 * link kinds, the author-marked accent, and the catalog template.
 */

import { describe, expect, it } from 'vitest';
import { parse } from 'node-html-parser';
import { BLOCK_TEMPLATES, parseDocument } from '@avodado/core';
import { renderSwimlane } from '../blocks/swimlane.js';
import { renderDocument } from '../document.js';

/** The `x` of a step card, by its data path. */
function stepX(html: string, path: string): number {
  const root = parse(html);
  const g = root.querySelector(`[data-bp="${path}"]`);
  const rect = g?.querySelector('rect');
  return Number(rect?.getAttribute('x'));
}

const LANES = [{ label: 'Customer' }, { label: 'Sales' }, { label: 'Ops' }];

describe('swimlane render', () => {
  it('derived columns place linked steps left to right, by lane label', () => {
    const html = renderSwimlane({
      lanes: LANES,
      steps: [
        { id: 'a', lane: 'Customer', label: 'Ask' },
        { id: 'b', lane: 'sales', label: 'Quote' },
        { id: 'c', lane: 'Ops', label: 'Ship' },
      ],
      links: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
      ],
    });
    expect(stepX(html, 'steps.0')).toBeLessThan(stepX(html, 'steps.1'));
    expect(stepX(html, 'steps.1')).toBeLessThan(stepX(html, 'steps.2'));
    expect(html).toContain('data-col="1" data-row="1"');
    expect(html).toContain('data-col="2" data-row="2"');
    expect(html).toContain('data-col="3" data-row="3"');
    expect(html).toContain('data-grid-auto="1"'); // Studio pins the layout on first drag
  });

  it('explicit col + numeric lane renders exactly as before (no auto flag)', () => {
    const html = renderSwimlane({
      lanes: LANES,
      steps: [
        { id: 'a', col: 2, lane: 0, label: 'Ask' },
        { id: 'b', col: 1, lane: 1, label: 'Quote' },
      ],
      links: [{ from: 'a', to: 'b' }],
    });
    expect(html).not.toContain('data-grid-auto');
    expect(html).toContain('data-col="2" data-row="1"');
    expect(html).toContain('data-col="1" data-row="2"');
    expect(stepX(html, 'steps.1')).toBeLessThan(stepX(html, 'steps.0'));
  });

  it('phases draw a header band per phase spanning its columns, with separators', () => {
    const html = renderSwimlane({
      lanes: LANES,
      phases: [
        { label: 'Intake', from: 1, to: 2 },
        { label: 'Delivery', from: 3 },
      ],
      steps: [
        { id: 'a', lane: 'Customer', label: 'Ask' },
        { id: 'b', lane: 'Sales', label: 'Quote' },
        { id: 'c', lane: 'Ops', label: 'Ship' },
      ],
      links: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
      ],
    });
    const root = parse(html);
    expect(root.querySelector('[data-bl="phases"]')).not.toBeNull();
    const p0 = root.querySelector('[data-bp="phases.0"] rect');
    const p1 = root.querySelector('[data-bp="phases.1"] rect');
    expect(p0).not.toBeNull();
    expect(p1).not.toBeNull();
    const x0 = Number(p0?.getAttribute('x'));
    const w0 = Number(p0?.getAttribute('width'));
    const x1 = Number(p1?.getAttribute('x'));
    expect(x0 + w0).toBeCloseTo(x1); // bands tile the columns edge to edge
    expect(w0).toBeGreaterThan(Number(p1?.getAttribute('width'))); // two columns vs one (an open `to` runs to the last column)
    expect(html).toContain('>INTAKE</text>');
    expect(html).toContain('>DELIVERY</text>');
    // One separator between the two bands, running from the header down through the lanes.
    const seps = root.querySelectorAll('[data-bl="phases"] line');
    expect(seps).toHaveLength(2); // the right edge of Intake and the left edge of Delivery coincide
    const lanesBottom = Number(root.querySelector('[data-bp="lanes.2"] rect')?.getAttribute('y')) + Number(root.querySelector('[data-bp="lanes.2"] rect')?.getAttribute('height'));
    expect(Number(seps[0]?.getAttribute('y2'))).toBe(lanesBottom);
  });

  it('dashed and error links take the skin’s dash and negative stroke', () => {
    const html = renderSwimlane({
      lanes: LANES,
      steps: [
        { id: 'a', lane: 'Customer', label: 'Ask' },
        { id: 'b', lane: 'Sales', label: 'Quote' },
        { id: 'c', lane: 'Ops', label: 'Ship' },
      ],
      links: [
        { from: 'a', to: 'b', kind: 'dashed', label: 'notify' },
        { from: 'b', to: 'c', kind: 'error', label: 'fail' },
      ],
    });
    const root = parse(html);
    const dashed = root.querySelector('path[data-bp="links.0"]');
    const error = root.querySelector('path[data-bp="links.1"]');
    expect(dashed?.getAttribute('stroke-dasharray')).toBe('5 4');
    expect(dashed?.getAttribute('marker-end')).toBe('url(#skOpen)');
    expect(error?.getAttribute('stroke')).toBe('var(--negative)');
    expect(error?.getAttribute('marker-end')).toBe('url(#skErr)');
    expect(html).toContain('message'); // legend names the dashed encoding
    expect(html).toContain('error path');
  });

  it('the accented step takes the accent outline and tint; a note is a mono sub-line', () => {
    const html = renderSwimlane({
      lanes: LANES,
      steps: [
        { id: 'a', lane: 'Customer', label: 'Ask' },
        { id: 'b', lane: 'Sales', label: 'Quote', accent: true, note: 'SLA 2 days' },
      ],
      links: [{ from: 'a', to: 'b' }],
    });
    const root = parse(html);
    const focal = root.querySelector('[data-bp="steps.1"] rect');
    const plain = root.querySelector('[data-bp="steps.0"] rect');
    expect(focal?.getAttribute('stroke')).toBe('var(--accent)');
    expect(focal?.getAttribute('fill')).toBe('var(--accent-tint)');
    expect(plain?.getAttribute('stroke')).toBe('var(--ink)');
    const note = root.querySelector('[data-bp="steps.1"] text.t-sub');
    expect(note?.text).toBe('SLA 2 days');
    expect(root.querySelector('[data-bp="steps.0"] text.t-sub')).toBeNull();
  });

  it('an unknown lane still draws the step (lane 0) — validation names the mistake', () => {
    const html = renderSwimlane({
      lanes: LANES,
      steps: [{ id: 'a', lane: 'Nowhere', label: 'Ask' }],
    });
    expect(html).toContain('data-col="1" data-row="1"');
  });

  it('the catalog template renders with no NaN and no hex', () => {
    const doc = parseDocument(BLOCK_TEMPLATES.swimlane, 'swimlane');
    expect(renderDocument(doc)).not.toContain('NaN');
    const seg = doc.segments.find((s) => s.kind === 'swimlane');
    if (seg === undefined) throw new Error('no swimlane segment');
    const html = renderSwimlane(seg.data as Parameters<typeof renderSwimlane>[0]);
    expect(html).not.toContain('NaN');
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/); // the block, not the page's token table
    expect(html).toContain('data-bl="phases"');
    expect(html).toContain('data-grid-auto="1"');
    expect(html).toContain('stroke-dasharray="5 4"');
    expect(html).toContain('var(--accent-tint)');
  });
});
