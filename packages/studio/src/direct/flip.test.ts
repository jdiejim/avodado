import { describe, expect, it } from 'vitest';
import { invertTransform, planFlip } from './flip.js';
import type { Box } from './drag.js';

const box = (left: number, top: number, width = 100, height = 40): Box => ({ left, top, width, height });
const isEdge = (k: string): boolean => k.startsWith('edges.');

describe('planFlip', () => {
  it('moves survivors whose box changed, pops newcomers, crossfades edges, lists the removed', () => {
    const before = new Map<string, Box>([
      ['nodes.0', box(0, 0)],
      ['nodes.1', box(150, 0)],
      ['nodes.2', box(300, 0)],
      ['edges.0', box(100, 15, 50, 4)],
      ['edges.1', box(250, 15, 50, 4)],
    ]);
    const after = new Map<string, Box>([
      ['nodes.0', box(0, 0)], // unchanged → nothing
      ['nodes.1', box(150, 120)], // moved down → move
      ['nodes.3', box(450, 0)], // new → pop
      ['edges.0', box(100, 60, 50, 4)], // re-routed → crossfade
      ['edges.2', box(400, 15, 50, 4)], // new edge → crossfade, never pop
    ]);
    const plan = planFlip(before, after, isEdge);
    expect(plan.moves).toEqual([{ key: 'nodes.1', from: box(150, 0), to: box(150, 120) }]);
    expect(plan.pops).toEqual(['nodes.3']);
    expect(plan.crossfades).toEqual(['edges.0', 'edges.2']);
    expect(plan.fades).toEqual(['nodes.2', 'edges.1']);
  });

  it('ignores sub-pixel jitter', () => {
    const before = new Map([['nodes.0', box(10, 10)]]);
    const after = new Map([['nodes.0', box(10.3, 9.8)]]);
    expect(planFlip(before, after, isEdge).moves).toEqual([]);
  });

  it('with moves disabled (a deletion shifts every later index) survivors stay put', () => {
    const before = new Map([
      ['nodes.0', box(0, 0)],
      ['nodes.1', box(150, 0)],
      ['nodes.2', box(300, 0)],
    ]);
    // nodes.0 deleted: the old nodes.1/2 are now nodes.0/1 at their old spots.
    const after = new Map([
      ['nodes.0', box(150, 0)],
      ['nodes.1', box(300, 0)],
    ]);
    const naive = planFlip(before, after, isEdge);
    expect(naive.moves).toHaveLength(2); // would animate the wrong parts
    const plan = planFlip(before, after, isEdge, { moves: false });
    expect(plan.moves).toEqual([]);
    expect(plan.pops).toEqual([]);
    expect(plan.fades).toEqual(['nodes.2']);
  });

  it('a size change rides along as a scale on the inverted transform', () => {
    expect(invertTransform(box(0, 0, 100, 40), box(30, 10, 100, 40))).toBe('translate(-30.00px, -10.00px)');
    expect(invertTransform(box(0, 0, 50, 40), box(0, 0, 100, 40))).toBe('translate(0.00px, 0.00px) scale(0.5000, 1.0000)');
  });
});
