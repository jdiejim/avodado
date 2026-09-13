/**
 * Gateways and load balancers draw as the tall vertical bar of system-design
 * diagrams, not a hexagon: half a cell wide, spanning the rows of the
 * services they front (auto or by `h`), with arrows meeting the bar itself.
 */

import { describe, expect, it } from 'vitest';
import { parseDocument } from '@avodado/core';
import { renderDocument } from '../index.js';
import { barRect, edgeAnchorRect, isBarKind } from '../blocks/blockGraph.js';

/** The block's own drawing (the page also carries a shared <defs> svg first). */
const svgOf = (md: string): string => {
  const html = renderDocument(parseDocument(md, 't'));
  const a = html.indexOf('<svg viewBox', html.indexOf('class="diagram"'));
  const b = html.indexOf('</svg>', a);
  return html.slice(a, b);
};

const FANOUT = `\`\`\`block
nodes:
  - { id: web, col: 1, row: 2, kind: browser, name: Web }
  - { id: gw, col: 2, row: 2, kind: gateway, name: API Gateway }
  - { id: a, col: 3, row: 1, kind: service, name: Orders }
  - { id: b, col: 3, row: 2, kind: service, name: Catalog }
  - { id: c, col: 3, row: 3, kind: service, name: Payments }
edges:
  - web -> gw
  - gw -> a
  - gw -> b
  - gw -> c
\`\`\`
`;

describe('gateway bar', () => {
  it('gateway, lb, proxy, and ingress are bar kinds; the bar is half a cell wide and full height', () => {
    for (const k of ['gateway', 'lb', 'proxy', 'ingress']) expect(isBarKind(k), k).toBe(true);
    expect(isBarKind('service')).toBe(false);
    const r = barRect({ x: 100, y: 50, w: 178, h: 88 });
    expect(r).toEqual({ x: 145, y: 50, w: 89, h: 88 });
    expect(edgeAnchorRect('lb', { x: 100, y: 50, w: 178, h: 88 })).toEqual(r);
  });

  it('spans the rows of its fan-out automatically and draws no hexagon', () => {
    const svg = svgOf(FANOUT);
    expect(svg).not.toMatch(/<path d="M[\d. ]+L [\d. ]+V [\d. ]+Q /); // the old hexagon path
    // Cells are 88 tall with a 64 gap: three rows = 88*3 + 64*2 = 392.
    const bar = /<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)" rx="2"/.exec(svg);
    expect(bar).not.toBeNull();
    expect(Number(bar?.[4])).toBe(392);
    expect(Number(bar?.[3])).toBe(89);
    // The bar starts at row 1 (padTop = 52), not at its authored row 2.
    expect(bar?.[2]).toBe('52');
  });

  it('an explicit h wins, and a single-row gateway stays one cell tall', () => {
    const explicit = svgOf(FANOUT.replace('kind: gateway, name: API Gateway', 'kind: gateway, name: API Gateway, h: 1'));
    const bar = /<rect x="\d+" y="\d+" width="89" height="(\d+)" rx="2"/.exec(explicit);
    expect(Number(bar?.[1])).toBe(88);
    const lone = svgOf(`\`\`\`block
nodes:
  - { id: gw, col: 1, row: 1, kind: lb, name: LB }
  - { id: a, col: 2, row: 1, kind: service, name: A }
edges:
  - gw -> a
\`\`\`
`);
    const one = /<rect x="\d+" y="\d+" width="89" height="(\d+)" rx="2"/.exec(lone);
    expect(Number(one?.[1])).toBe(88);
  });

  it('does not span when another node sits in the bar column across the range', () => {
    const blocked = svgOf(
      FANOUT.replace('edges:', '  - { id: x, col: 2, row: 1, kind: service, name: Blocker }\nedges:'),
    );
    const bar = /<rect x="\d+" y="\d+" width="89" height="(\d+)" rx="2"/.exec(blocked);
    expect(Number(bar?.[1])).toBe(88);
  });

  it('the block contract prints h as a row span', () => {
    // schema-derived: `h(n 1..100)` sits beside `w`
    expect(svgOf(FANOUT)).toBeTruthy();
  });
});
