/**
 * Accessible names on diagram SVGs. A screen reader announces the diagram by
 * its `aria-label`; both it and the `<title>` are built from the block's own
 * data, so "Sequence diagram" alone must never survive.
 */

import { describe, expect, it } from 'vitest';
import { renderSequence } from '../blocks/sequence.js';
import { renderFlow } from '../blocks/flow.js';
import { renderErd } from '../blocks/erd.js';
import { renderSaga } from '../blocks/saga.js';
import { renderBlock } from '../blocks/blockGraph.js';
import { renderState } from '../blocks/state.js';
import { renderDfd } from '../blocks/dfd.js';
import { renderC4 } from '../blocks/c4.js';
import { renderSpans } from '../blocks/spans.js';
import { countPhrase, diagramName } from '../svg/svgTitle.js';

/** The first `<title>` of the first SVG in a rendered block. */
function title(html: string): string {
  return /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? '';
}

/** The first `aria-label` of the first SVG in a rendered block. */
function label(html: string): string {
  return /<svg[^>]*aria-label="([^"]*)"/.exec(html)?.[1] ?? '';
}

describe('diagramName', () => {
  it('joins the kind, the block title, and the counts', () => {
    expect(diagramName('Flowchart', 'Checkout', ['4 steps'])).toBe('Flowchart: Checkout, 4 steps');
    expect(diagramName('Flowchart', undefined, ['4 steps'])).toBe('Flowchart: 4 steps');
    expect(diagramName('Flowchart', '  ', [])).toBe('Flowchart');
  });

  it('counts singular and plural', () => {
    expect(countPhrase(1, 'message')).toBe('1 message');
    expect(countPhrase(3, 'message')).toBe('3 messages');
    expect(countPhrase(2, 'entity', 'entities')).toBe('2 entities');
  });
});

describe('the name a diagram announces', () => {
  it('sequence: the endpoint or title, the message count, the actor count', () => {
    const html = renderSequence({
      endpoint: { method: 'POST', path: '/orders' },
      actors: [
        { id: 'c', name: 'Client' },
        { id: 'a', name: 'API' },
        { id: 'd', name: 'DB' },
      ],
      messages: [
        { from: 'c', to: 'a', label: 'create' },
        { frame: 'alt', label: 'in stock' },
        { from: 'a', to: 'd', label: 'insert' },
        { end: true },
        { from: 'a', to: 'c', label: '201', kind: 'response' },
      ],
    });
    // Frame markers are not messages — the count is what the diagram draws.
    expect(title(html)).toBe('Sequence diagram: /orders, 3 messages between 3 actors');
    expect(label(html)).toBe(title(html));
  });

  it('flow: the title and the step count', () => {
    const html = renderFlow({
      title: 'Checkout',
      nodes: [
        { id: 'a', label: 'Start', kind: 'start' },
        { id: 'b', label: 'Pay' },
        { id: 'c', label: 'Done', kind: 'end' },
      ],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
      ],
    });
    expect(title(html)).toBe('Flowchart: Checkout, 3 steps');
    expect(label(html)).toBe(title(html));
  });

  it('erd: the entity count', () => {
    const html = renderErd({
      entities: [
        { name: 'Order', columns: [{ name: 'id', type: 'uuid', pk: true }] },
        { name: 'Line', columns: [{ name: 'id', type: 'uuid', pk: true }] },
      ],
      relations: [{ from: 'Order', to: 'Line', card: '1:N' }],
    });
    expect(title(html)).toBe('Entity relationship diagram: 2 entities');
    expect(label(html)).toBe(title(html));
  });

  it('every diagram carries role="img" and a name built from its data', () => {
    const cases: ReadonlyArray<[string, string]> = [
      [
        renderSaga({
          title: 'Place order',
          steps: [
            { id: 'r', name: 'Reserve', service: 'inventory', compensate: 'Release' },
            { id: 'c', name: 'Charge', service: 'payments' },
          ],
        }),
        'Saga: Place order, 2 steps, 1 compensation',
      ],
      [
        renderBlock({ title: 'Platform', nodes: [{ id: 'a', name: 'API' }, { id: 'b', name: 'DB', kind: 'db' }], edges: [{ from: 'a', to: 'b' }] }),
        'Block diagram: Platform, 2 nodes, 1 connection',
      ],
      [
        renderState({ title: 'Order', states: [{ id: 'a', name: 'New' }, { id: 'b', name: 'Paid' }], transitions: [{ from: 'a', to: 'b', event: 'pay' }] }),
        'State machine: Order, 2 states, 1 transition',
      ],
      [
        renderDfd({ title: 'Orders', nodes: [{ id: 'a', name: 'User', kind: 'external' }, { id: 'b', name: 'API' }], edges: [{ from: 'a', to: 'b' }] }),
        'Data-flow diagram: Orders, 2 nodes, 1 flow',
      ],
      [
        renderC4({ title: 'Context', nodes: [{ id: 'a', kind: 'person', name: 'User' }, { id: 'b', kind: 'system', name: 'Shop' }], edges: [{ from: 'a', to: 'b' }] }),
        'C4 diagram: Context, 2 elements, 1 relationship',
      ],
      [
        renderSpans({ title: 'GET /orders', spans: [{ id: 'a', name: 'http', service: 'edge', start: 0, duration: 10 }, { id: 'b', name: 'db', service: 'orders', start: 2, duration: 4 }] }),
        'Trace waterfall: GET /orders, 2 spans',
      ],
    ];
    for (const [html, expected] of cases) {
      expect(title(html), expected).toBe(expected);
      expect(label(html), expected).toBe(expected);
      expect(html, expected).toContain('role="img"');
    }
  });
});
