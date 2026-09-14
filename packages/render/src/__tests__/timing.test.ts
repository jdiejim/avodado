import { describe, expect, it } from 'vitest';
import { parse } from 'node-html-parser';
import { BLOCK_TEMPLATES, parseDocument } from 'chiltepin-core';
import { renderTiming } from '../blocks/timing.js';
import type { BlockDataMap } from 'chiltepin-core';

type Data = BlockDataMap['timing'];

function catalog(): Data {
  const doc = parseDocument(BLOCK_TEMPLATES.timing, 'timing');
  const seg = doc.segments.find((s) => s.kind === 'timing');
  if (seg === undefined || seg.kind !== 'timing' || seg.data === null || seg.data === undefined) throw new Error('no template');
  return seg.data as Data;
}

describe('timing', () => {
  const data = catalog();
  const html = renderTiming(data);
  const root = parse(html);

  it('renders the catalog template with one lane per lifeline', () => {
    const lanes = root.querySelectorAll('g[data-bl="lanes"] > g');
    expect(lanes).toHaveLength(2);
    expect(lanes[0]?.querySelector('[data-bp="lanes.0.label"]')?.text).toBe('Breaker');
  });

  it('gives the Breaker lane three state levels (closed, open, half-open) and Downstream two', () => {
    const lanes = root.querySelectorAll('g[data-bl="lanes"] > g');
    expect(lanes[0]?.getAttribute('data-levels')).toBe('3');
    expect(lanes[0]?.querySelectorAll('.tg-level').map((t) => t.text)).toEqual(['closed', 'open', 'half-open']);
    expect(lanes[1]?.getAttribute('data-levels')).toBe('2');
    // The two `closed` segments share one level; `open` sits below it.
    const closed = lanes[0]?.querySelectorAll('.tg-level').map((t) => Number(t.getAttribute('y'))) ?? [];
    expect(closed[0]).toBeLessThan(closed[1] ?? 0);
  });

  it('draws two event rules and a duration bracket', () => {
    expect(root.querySelectorAll('g[data-bl="events"] > g line')).toHaveLength(2);
    expect(html).toContain('5 failures in 10 s');
    expect(html).toContain('probe ok');
    expect(root.querySelectorAll('g[data-bl="constraints"] > g')).toHaveLength(1);
    expect(html).toContain('{ open 30 s }');
  });

  it('tints the red state negative and the amber one accent', () => {
    const open = root.querySelector('g[data-bp="lanes.0.states.1"] line');
    const half = root.querySelector('g[data-bp="lanes.0.states.2"] line');
    expect(open?.getAttribute('stroke')).toBe('var(--negative)');
    expect(half?.getAttribute('stroke')).toBe('var(--accent)');
    expect(root.querySelector('g[data-bp="lanes.0.states.0"] line')).toBeNull();
  });

  it('runs a shared axis in the unit with segments in time order', () => {
    expect(html).toContain('>0s<');
    expect(html).toContain('>60s<');
    const open = root.querySelector('g[data-bp="lanes.0.states.1"] line');
    const half = root.querySelector('g[data-bp="lanes.0.states.2"] line');
    expect(Number(open?.getAttribute('x2'))).toBeLessThanOrEqual(Number(half?.getAttribute('x1')));
    expect(html).not.toMatch(/NaN/);
    expect(html).not.toMatch(/#[0-9a-f]{3,6}\b/i);
    expect(root.querySelector('.diagram-legend')?.text).toContain('event');
  });

  it('staggers event labels that would overlap onto separate tiers', () => {
    const h = renderTiming({
      lanes: [{ label: 'L', states: [{ state: 'a', from: 0, to: 10 }] }],
      events: [
        { at: 5, label: 'first long event label' },
        { at: 5.2, label: 'second long event label' },
      ],
    });
    const ys = parse(h)
      .querySelectorAll('g[data-bl="events"] text')
      .map((t) => Number(t.getAttribute('y')));
    expect(ys[0]).not.toBe(ys[1]);
  });

  it('confines an event with a lane to that lane', () => {
    const h = renderTiming({
      lanes: [
        { label: 'A', states: [{ state: 'x', from: 0, to: 10 }] },
        { label: 'B', states: [{ state: 'y', from: 0, to: 10 }] },
      ],
      events: [{ at: 5, label: 'only B', lane: 'B' }],
    });
    const r = parse(h);
    const rule = r.querySelector('g[data-bl="events"] line');
    const laneB = r.querySelectorAll('g[data-bl="lanes"] > g')[1]?.querySelector('.t-name');
    expect(Number(rule?.getAttribute('y2'))).toBeGreaterThan(Number(laneB?.getAttribute('y')));
    expect(h).not.toMatch(/NaN/);
  });
});
