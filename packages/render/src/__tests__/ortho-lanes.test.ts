import { describe, expect, it } from 'vitest';
import { edgeLanes, ortho } from '../svg/ortho.js';
import { renderDfd } from '../blocks/dfd.js';

describe('bidirectional edge lanes', () => {
  it('edgeLanes: opposite pairs get opposite lanes; unpaired and self-loops stay centered', () => {
    const lanes = edgeLanes([
      { from: 'a', to: 'b' },
      { from: 'b', to: 'a' },
      { from: 'b', to: 'c' },
      { from: 'd', to: 'd' },
    ]);
    expect(lanes[0]).toBe(-1);
    expect(lanes[1]).toBe(1);
    expect(lanes[2]).toBe(0);
    expect(lanes[3]).toBe(0);
  });

  it('lane 0 is byte-identical to the pre-lane route', () => {
    const A = { x: 0, y: 0, w: 100, h: 50 };
    const B = { x: 200, y: 0, w: 100, h: 50 };
    expect(ortho(A, B)).toEqual(ortho(A, B, 0));
    expect(ortho(A, B).d).toBe('M 100 25 H 150 V 25 H 200');
  });

  it('opposite lanes produce two distinct parallel routes', () => {
    const A = { x: 0, y: 0, w: 100, h: 50 };
    const B = { x: 200, y: 0, w: 100, h: 50 };
    const ab = ortho(A, B, -1);
    const ba = ortho(B, A, 1);
    expect(ab.d).not.toBe(ba.d);
    // 10px per lane → label midpoints sit 20px apart, clear of each other.
    expect(Math.abs(ab.ly - ba.ly)).toBe(20);
  });

  it('a dfd with A→B and B→A emits two different edge paths', () => {
    const html = renderDfd({
      nodes: [
        { id: 'a', col: 1, row: 1, kind: 'process', name: 'A' },
        { id: 'b', col: 2, row: 1, kind: 'process', name: 'B' },
      ],
      edges: [
        { from: 'a', to: 'b', label: 'push' },
        { from: 'b', to: 'a', label: 'pull' },
      ],
    });
    const ds = [...html.matchAll(/<path d="([^"]+)" fill="none"/g)].map((m) => m[1]);
    expect(ds.length).toBe(2);
    expect(ds[0]).not.toBe(ds[1]);
  });
});
