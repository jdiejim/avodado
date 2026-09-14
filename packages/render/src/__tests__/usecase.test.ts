import { describe, expect, it } from 'vitest';
import { parse } from 'node-html-parser';
import { BLOCK_TEMPLATES, parseDocument } from 'chiltepin-core';
import { renderUsecase } from '../blocks/usecase.js';
import { renderDocument } from '../document.js';

type Data = Parameters<typeof renderUsecase>[0];

const TICKETING: Data = {
  system: 'Ticketing',
  actors: [
    { id: 'cust', name: 'Customer' },
    { id: 'agent', name: 'Support agent' },
    { id: 'pay', name: 'Payment gateway', kind: 'system', side: 'right' },
  ],
  cases: [
    { id: 'buy', name: 'Buy ticket' },
    { id: 'pay1', name: 'Pay by card' },
    { id: 'refund', name: 'Request refund' },
    { id: 'approve', name: 'Approve refund' },
  ],
  links: [
    { from: 'cust', to: 'buy' },
    { from: 'cust', to: 'refund' },
    { from: 'agent', to: 'approve' },
    { from: 'pay', to: 'pay1' },
  ],
  relations: [
    { from: 'buy', to: 'pay1', kind: 'include' },
    { from: 'refund', to: 'approve', kind: 'extend' },
  ],
};

const NO_HEX = /#[0-9a-f]{3,6}\b/i;

describe('usecase', () => {
  it('renders the catalog template (terse links expanded)', () => {
    const html = renderDocument(parseDocument(BLOCK_TEMPLATES.usecase, 'uc'));
    expect(html).toContain('Ticketing');
    expect(parse(html).querySelectorAll('g[data-bl="links"] line')).toHaveLength(4);
    expect(html).not.toContain('NaN');
  });

  it('draws a stick figure per person actor, a dashed box per system actor, an ellipse per case', () => {
    const root = parse(renderUsecase(TICKETING));
    const actors = root.querySelectorAll('g[data-bl="actors"] > g[data-bp]');
    expect(actors).toHaveLength(3);
    // A person: a head circle plus the body/arms/legs path.
    expect(actors[0]?.querySelectorAll('circle')).toHaveLength(1);
    expect(actors[0]?.querySelectorAll('path')).toHaveLength(1);
    expect(actors[1]?.querySelectorAll('circle')).toHaveLength(1);
    // A system actor: a dashed rectangle and no head.
    expect(actors[2]?.querySelector('rect')?.getAttribute('stroke-dasharray')).toBe('4 3');
    expect(actors[2]?.querySelectorAll('circle')).toHaveLength(0);
    expect(root.querySelectorAll('g[data-bl="cases"] ellipse')).toHaveLength(4);
    expect(root.querySelectorAll('g[data-bl="cases"] > g[data-bp]').map((g) => g.querySelector('text')?.text)).toEqual([
      'Buy ticket',
      'Pay by card',
      'Request refund',
      'Approve refund',
    ]);
  });

  it('places left actors left of the boundary and right actors right of it', () => {
    const root = parse(renderUsecase(TICKETING));
    const bound = root.querySelector('[data-bp="system"] rect');
    const bx = Number(bound?.getAttribute('x'));
    const bw = Number(bound?.getAttribute('width'));
    const actorEls = root.querySelectorAll('g[data-bl="actors"] > g[data-bp]');
    const headX = (i: number): number => {
      const el = actorEls[i];
      const c = el?.querySelector('circle');
      if (c !== null && c !== undefined) return Number(c.getAttribute('cx'));
      return Number(el?.querySelector('rect')?.getAttribute('x')) + 22;
    };
    expect(headX(0)).toBeLessThan(bx);
    expect(headX(1)).toBeLessThan(bx);
    expect(headX(2)).toBeGreaterThan(bx + bw);
    // Two left actors never share a slot.
    const names = root.querySelectorAll('g[data-bl="actors"] > g[data-bp] text.t-name');
    const ys = names.map((t) => Number(t.getAttribute('y')));
    expect(Math.abs((ys[0] ?? 0) - (ys[1] ?? 0))).toBeGreaterThanOrEqual(60);
  });

  it('draws relations as dashed arrows carrying their stereotype, and generalize with a hollow triangle', () => {
    const html = renderUsecase(TICKETING);
    expect(html).not.toMatch(NO_HEX);
    const root = parse(html);
    const rels = root.querySelectorAll('g[data-bl="relations"] path');
    expect(rels).toHaveLength(2);
    for (const p of rels) {
      expect(p.getAttribute('stroke-dasharray')).toBe('5 4');
      expect(p.getAttribute('marker-end')).toBe('url(#skOpen)');
    }
    expect(html).toContain('«include»');
    expect(html).toContain('«extend»');
    const gen = renderUsecase({
      actors: [{ id: 'a', name: 'A' }],
      cases: [{ id: 'x', name: 'X' }, { id: 'y', name: 'Y' }],
      relations: [{ from: 'y', to: 'x', kind: 'generalize' }],
    });
    const g = parse(gen).querySelector('g[data-bl="relations"] path');
    expect(g?.getAttribute('marker-end')).toBe('url(#ucTri)');
    expect(g?.getAttribute('stroke-dasharray')).toBeUndefined();
    expect(gen).toContain('id="ucTri"');
  });

  it('splits more than six cases into two columns filled column-major', () => {
    const cases = Array.from({ length: 8 }, (_, i) => ({ id: `c${i}`, name: `Case ${i}` }));
    const root = parse(renderUsecase({ actors: [{ id: 'a', name: 'A' }], cases }));
    const xs = root.querySelectorAll('g[data-bl="cases"] ellipse').map((e) => Number(e.getAttribute('cx')));
    expect(new Set(xs).size).toBe(2);
    // The first four share the left column, the last four the right.
    expect(xs.slice(0, 4).every((x) => x === xs[0])).toBe(true);
    expect(xs.slice(4).every((x) => x === xs[4])).toBe(true);
    expect(xs[4]).toBeGreaterThan(xs[0] ?? 0);
  });

  it('lists the encodings in play in the legend', () => {
    const legend = parse(renderUsecase(TICKETING)).querySelectorAll('.diagram-legend .lg-label').map((l) => l.text);
    expect(legend).toEqual(['use case', 'external system', 'association', '«include»', '«extend»']);
  });
});
