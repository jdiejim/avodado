import { describe, expect, it } from 'vitest';
import { edgeLanes, entryPortOffsets, ortho } from '../svg/ortho.js';
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
    expect(ortho(A, B)).toEqual(ortho(A, B, 0, 0));
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

  it('fan-in: two edges into one node side get distinct centered offsets, ordered by source id', () => {
    const boxes = new Map([
      ['a', { x: 0, y: 0, w: 100, h: 50 }],
      ['c', { x: 0, y: 200, w: 100, h: 50 }],
      ['b', { x: 200, y: 100, w: 100, h: 50 }],
      ['x', { x: 400, y: 0, w: 100, h: 50 }],
      ['y', { x: 600, y: 0, w: 100, h: 50 }],
    ]);
    const offs = entryPortOffsets(
      [
        { from: 'c', to: 'b' },
        { from: 'a', to: 'b' },
        { from: 'x', to: 'y' },
      ],
      (id) => boxes.get(id),
    );
    // Both edges enter b's left side; spread ±4 (8px apart), 'a' before 'c'.
    expect(offs[1]).toBe(-4);
    expect(offs[0]).toBe(4);
    // The single-entry edge keeps offset 0 — its route stays byte-identical.
    expect(offs[2]).toBe(0);
    const A = boxes.get('x');
    const B = boxes.get('y');
    if (A === undefined || B === undefined) throw new Error('unreachable');
    expect(ortho(A, B, 0, offs[2] ?? 0).d).toBe(ortho(A, B).d);
  });

  it('a dfd with two edges into one node draws two arrowheads at distinct entry points', () => {
    const fanIn = renderDfd({
      nodes: [
        { id: 'a', col: 1, row: 1, kind: 'process', name: 'A' },
        { id: 'c', col: 1, row: 2, kind: 'process', name: 'C' },
        { id: 'b', col: 2, row: 1, kind: 'process', name: 'B' },
        { id: 'd', col: 3, row: 1, kind: 'process', name: 'D' },
        { id: 'e', col: 4, row: 1, kind: 'process', name: 'E' },
      ],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'c', to: 'b' },
        { from: 'd', to: 'e' },
      ],
    });
    const arrows = [...fanIn.matchAll(/<path d="([^"]+)" fill="none"[^>]*marker-end/g)].map(
      (m) => m[1] ?? '',
    );
    expect(arrows.length).toBe(3);
    // Horizontal routes end `… V <entryY> H <entryX>` — the entry y differs.
    const endY = (d: string): string => /V (-?[\d.]+) H (-?[\d.]+)$/.exec(d)?.[1] ?? '';
    expect(endY(arrows[0] ?? '')).not.toBe('');
    expect(endY(arrows[0] ?? '')).not.toBe(endY(arrows[1] ?? ''));
    // The lone d→e edge is untouched: same route as in a fan-in-free render.
    const solo = renderDfd({
      nodes: [
        { id: 'd', col: 3, row: 1, kind: 'process', name: 'D' },
        { id: 'e', col: 4, row: 1, kind: 'process', name: 'E' },
      ],
      edges: [{ from: 'd', to: 'e' }],
    });
    const soloArrow = /<path d="([^"]+)" fill="none"[^>]*marker-end/.exec(solo)?.[1];
    expect(arrows[2]).toBe(soloArrow);
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
