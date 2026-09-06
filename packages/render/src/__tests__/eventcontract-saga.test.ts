/**
 * `eventcontract` + `saga` renderers (phase 30, G): the expected structure
 * comes out (strip columns, chips, table rows, step cards, compensation
 * cards, arrows, legend items) and the one accent lands on the documented
 * item — the partition-key row, and the step that fails.
 */

import { describe, expect, it } from 'vitest';
import { parse } from 'node-html-parser';
import { renderEventcontract } from '../blocks/eventcontract.js';
import { renderSaga } from '../blocks/saga.js';

/** The status chips of every step card, in step order (the service eyebrow and COMPENSATE tab excluded). */
function statusChips(html: string): string[][] {
  return parse(html)
    .querySelectorAll('g[data-bl="steps"] > g')
    .map((g) =>
      g
        .querySelectorAll('text.t-eyebrow')
        .map((t) => t.text)
        .filter((t) => /^(FAILED|SKIPPED|COMPENSATED)$/.test(t)),
    );
}

describe('eventcontract', () => {
  const PLACED = {
    name: 'order.placed',
    version: 'v2',
    channel: 'orders',
    summary: 'A customer completed checkout.',
    producers: ['checkout'],
    consumers: ['billing', 'fulfilment', 'analytics'],
    delivery: 'at-least-once' as const,
    ordering: 'per-key' as const,
    key: 'order_id',
    retention: '7d',
    schema: [
      { name: 'order_id', type: 'uuid', required: true, desc: 'The order' },
      { name: 'total', type: 'money', required: true },
      { name: 'coupon', type: 'string', desc: 'Discount code', example: 'SPRING' },
    ],
    headers: [{ name: 'trace_id', type: 'string', required: true }],
    example: '{ "order_id": "ord_123" }',
    errors: [{ name: 'DuplicateOrder', when: 'already processed' }],
    note: 'Consumers must be idempotent on order_id.',
  };

  it('puts the eyebrow, name, and channel chip in the head', () => {
    const root = parse(renderEventcontract(PLACED));
    expect(root.querySelector('.evc-eyebrow')?.text.replace(/\s+/g, ' ')).toBe('EVENT·v2');
    expect(root.querySelector('.evc-name')?.text).toBe('order.placed');
    expect(root.querySelector('.evc-channel')?.text).toContain('orders');
  });

  it('draws the producers → consumers strip with one chip per party and a count', () => {
    const root = parse(renderEventcontract(PLACED));
    const cols = root.querySelectorAll('.evc-party');
    expect(cols).toHaveLength(2);
    expect(cols[0]?.querySelector('.evc-party-label')?.text).toBe('Producers (1)');
    expect(cols[0]?.querySelectorAll('.evc-chip').map((c) => c.text)).toEqual(['checkout']);
    expect(cols[1]?.querySelectorAll('.evc-chip').map((c) => c.text)).toEqual(['billing', 'fulfilment', 'analytics']);
  });

  it('renders delivery, ordering, key, and retention as word chips', () => {
    const root = parse(renderEventcontract(PLACED));
    const facts = root
      .querySelectorAll('.evc-fact')
      .map((f) => [f.querySelector('.evc-fact-k')?.text, f.querySelector('.evc-fact-v')?.text]);
    expect(facts).toEqual([
      ['delivery', 'at-least-once'],
      ['ordering', 'per-key'],
      ['key', 'order_id'],
      ['retention', '7d'],
    ]);
  });

  it('marks the key row # (the one accent) and optional rows ?', () => {
    const root = parse(renderEventcontract(PLACED));
    const rows = root.querySelectorAll('tbody[data-bl="schema"] tr');
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.querySelector('.evc-mark')?.text)).toEqual(['#', '', '?']);
    expect(rows[0]?.getAttribute('class')).toBe('evc-key');
    expect(root.querySelectorAll('.evc-key')).toHaveLength(1);
    expect(root.querySelector('.evc-keyline')?.text).toContain('partition key');
    expect(root.querySelector('.evc-eg')?.text).toBe('e.g. SPRING');
  });

  it('renders headers, the highlighted example, errors, and the note', () => {
    const html = renderEventcontract(PLACED);
    const root = parse(html);
    expect(root.querySelectorAll('tbody[data-bl="headers"] tr')).toHaveLength(1);
    // `<pre>` is a raw-text element for the parser — assert on the markup.
    expect(html).toContain('<pre class="ep-ex" data-bp="example">{ <span class="j-key">"order_id"</span>:');
    const err = root.querySelector('tbody[data-bl="errors"] tr');
    expect(err?.querySelectorAll('td').map((t) => t.text)).toEqual(['DuplicateOrder', 'already processed']);
    expect(root.querySelector('.evc-note')?.text).toContain('idempotent');
  });

  it('omits every section it has no data for', () => {
    const root = parse(renderEventcontract({ name: 'ping' }));
    expect(root.querySelector('.evc-name')?.text).toBe('ping');
    expect(root.querySelectorAll('.evc-strip, .evc-facts, .evc-table, .ep-ex, .evc-note, .evc-channel')).toHaveLength(0);
    expect(root.querySelector('.evc-eyebrow')?.text.trim()).toBe('EVENT');
  });

  it('tags data paths for editors', () => {
    const html = renderEventcontract(PLACED);
    for (const p of ['name', 'version', 'channel', 'summary', 'key', 'example', 'note', 'schema.0.name', 'errors.0.when']) {
      expect(html).toContain(`data-bp="${p}"`);
    }
    expect(html).toContain('data-bl="producers"');
    expect(html).toContain('data-bl="consumers"');
  });

  it('escapes HTML in every text field', () => {
    const html = renderEventcontract({ name: '<b>x</b>', schema: [{ name: 'a<b', type: 't&', desc: '<i>' }] });
    expect(html).not.toContain('<b>x</b>');
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(html).toContain('t&amp;');
  });
});

describe('saga', () => {
  const ORDER = {
    title: 'Place order',
    mode: 'orchestration' as const,
    coordinator: 'Order service',
    steps: [
      { id: 'reserve', name: 'Reserve stock', service: 'inventory', compensate: 'release stock' },
      { id: 'charge', name: 'Charge card', service: 'payments', action: 'capture', compensate: 'refund card' },
      { id: 'ship', name: 'Book shipment', service: 'shipping', compensate: 'cancel shipment' },
      { id: 'notify', name: 'Send confirmation', service: 'notifications' },
    ],
    failAt: 'ship',
  };

  it('draws one card per step and a compensation card under each step that has one', () => {
    const root = parse(renderSaga(ORDER));
    const steps = root.querySelectorAll('g[data-bl="steps"] > g');
    expect(steps).toHaveLength(4);
    expect(root.querySelectorAll('g[data-bp$=".compensate"]')).toHaveLength(3);
    expect(steps[3]?.querySelector('g[data-bp$=".compensate"]')).toBeNull();
    expect(root.querySelector('title')?.text).toBe('Saga');
  });

  it('derives statuses from failAt: compensated before, FAILED at, skipped after', () => {
    expect(statusChips(renderSaga(ORDER))).toEqual([['COMPENSATED'], ['COMPENSATED'], ['FAILED'], ['SKIPPED']]);
  });

  it('spends the one accent on the failing step', () => {
    const root = parse(renderSaga(ORDER));
    const steps = root.querySelectorAll('g[data-bl="steps"] > g');
    const cardStroke = (i: number) => steps[i]?.querySelector('rect')?.getAttribute('stroke');
    expect(cardStroke(2)).toBe('var(--accent)');
    expect(steps[2]?.querySelector('rect')?.getAttribute('fill')).toBe('var(--accent-tint)');
    expect(cardStroke(0)).toBe('var(--ink)');
    expect(cardStroke(3)).toBe('var(--rule-solid)');
    expect(steps[3]?.querySelector('rect')?.getAttribute('fill')).toBe('var(--paper-2)');
    // Only the failing card's texts are accent-toned.
    const accentOwners = root.querySelectorAll('g[data-bl="steps"] > g').filter(
      (g) => g.querySelectorAll('.c-accent').length > 0,
    );
    expect(accentOwners).toHaveLength(1);
  });

  it('runs the compensating flow right to left from the failure, and dashes the arrows past it', () => {
    const html = renderSaga(ORDER);
    const root = parse(html);
    const flow = root.querySelectorAll('.sg-compflow path');
    // ship → charge's compensation, then charge → reserve's compensation.
    expect(flow).toHaveLength(2);
    for (const p of flow) {
      expect(p.getAttribute('stroke')).toBe('var(--negative)');
      expect(p.getAttribute('stroke-dasharray')).toBe('5 4');
      expect(p.getAttribute('marker-end')).toBe('url(#skErr)');
    }
    const forward = root.querySelectorAll('.sg-forward line');
    expect(forward).toHaveLength(3);
    expect(forward.slice(0, 2).every((l) => l.getAttribute('stroke-dasharray') === undefined)).toBe(true);
    expect(forward[2]?.getAttribute('stroke-dasharray')).toBe('5 4');
    expect(forward[2]?.getAttribute('marker-end')).toBe('url(#skOpen)');
  });

  it('adds the coordinator band and a fan-out arrow per step in orchestration mode only', () => {
    const orch = parse(renderSaga(ORDER));
    expect(orch.querySelector('g[data-bp="coordinator"] text.t-name')?.text).toBe('Order service');
    expect(orch.querySelectorAll('.sg-fanout line')).toHaveLength(4);
    const { mode: _m, coordinator: _c, ...choreo } = ORDER;
    const ch = parse(renderSaga(choreo));
    expect(ch.querySelector('g[data-bp="coordinator"]')).toBeNull();
    expect(ch.querySelectorAll('.sg-fanout line')).toHaveLength(0);
  });

  it('lists the encodings it used in the legend', () => {
    const root = parse(renderSaga(ORDER));
    const labels = root.querySelectorAll('.lg-label').map((l) => l.text);
    expect(labels).toEqual([
      'coordinates every step',
      'step',
      'compensation',
      'failure point',
      'undone',
      'skipped',
      'next',
      'not reached',
      'compensating flow',
    ]);
  });

  it('draws the happy path with zero accent and no compensating flow', () => {
    const { failAt: _f, ...happy } = ORDER;
    const html = renderSaga(happy);
    expect(html).not.toContain('var(--accent)');
    expect(html).not.toContain('sg-compflow');
    const root = parse(html);
    expect(root.querySelectorAll('.lg-label').map((l) => l.text)).toEqual([
      'coordinates every step',
      'step',
      'compensation',
      'next',
    ]);
  });

  it('lets an explicit status override the derivation', () => {
    const data = {
      steps: [
        { id: 'a', name: 'A', service: 's', status: 'ok' as const },
        { id: 'b', name: 'B', service: 's' },
      ],
      failAt: 'b',
    };
    expect(statusChips(renderSaga(data))).toEqual([[], ['FAILED']]);
  });

  it('wraps a long name instead of dropping it, and grows the cards to fit', () => {
    const short = renderSaga({ steps: [{ id: 'a', name: 'Reserve', service: 's' }] });
    const long = renderSaga({
      steps: [{ id: 'a', name: 'Provision the customer account and its billing profile', service: 's' }],
    });
    const wOf = (html: string) => Number(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/.exec(html)?.[1]);
    const hOf = (html: string) => Number(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/.exec(html)?.[2]);
    expect(hOf(long)).toBeGreaterThan(hOf(short));
    expect(wOf(long)).toBeGreaterThanOrEqual(wOf(short));
    const names = parse(long).querySelectorAll('text.t-name').map((t) => t.text);
    expect(names.join(' ')).toBe('Provision the customer account and its billing profile');
  });

  it('escapes HTML in names, services, and compensations', () => {
    const html = renderSaga({ steps: [{ id: 'a', name: '<b>A</b>', service: 's&t', compensate: '<undo>' }] });
    expect(html).not.toContain('<b>A</b>');
    expect(html).toContain('&lt;b&gt;A&lt;/b&gt;');
    expect(html).toContain('s&amp;t');
    expect(html).toContain('&lt;undo&gt;');
  });
});
