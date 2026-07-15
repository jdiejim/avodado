import { describe, expect, it } from 'vitest';
import { parseDocument, validateDocument } from '@avodado/core';
import {
  fixedCellFor,
  groupIndexFromPath,
  groupMoveSets,
  groupOps,
  groupRangeAt,
  groupResizeSets,
  growRange,
  marqueeToCellRange,
  moveRangeBy,
  rangeBox,
  resizeRange,
  supportsGroups,
  type CellRange,
} from './groupMarquee.js';
import { setPathsInSegment } from './host.js';
import type { GridGeom } from './drag.js';

/** Narrows away null/undefined (the test asserts the value exists). */
function must<T>(v: T | null | undefined): T {
  if (v === null || v === undefined) throw new Error('expected a value');
  return v;
}

/** The flow renderer's grid (cellW 176, cellH 70, gaps 60/56, pads 26/26). */
const GEOM: GridGeom = {
  cellW: 176,
  cellH: 70,
  gapX: 60,
  gapY: 56,
  padX: 26,
  padTop: 26,
  cols: 3,
  rows: 2,
  scale: 1,
};

const FENCES: Readonly<Record<string, string>> = {
  flow: [
    '```flow',
    'nodes:',
    '  - { id: a, label: Start, kind: start, col: 1, row: 1 }',
    'edges: []',
    '```',
  ].join('\n'),
  dfd: ['```dfd', 'nodes:', '  - { id: a, name: Client, col: 1, row: 1 }', '```'].join('\n'),
  state: ['```state', 'states:', '  - { id: a, name: Draft, col: 1, row: 1 }', '```'].join('\n'),
  c4: ['```c4', 'nodes:', '  - { id: a, kind: person, name: User, col: 1, row: 1 }', '```'].join('\n'),
  block: ['```block', 'nodes:', '  - { id: a, name: API, col: 1, row: 1 }', '```'].join('\n'),
};

describe('supportsGroups', () => {
  it('covers exactly the five grid kinds', () => {
    for (const k of Object.keys(FENCES)) expect(supportsGroups(k), k).toBe(true);
    expect(supportsGroups('sequence')).toBe(false);
    expect(supportsGroups('erd')).toBe(false);
  });
});

describe('marqueeToCellRange', () => {
  it('snaps both corners to cells and normalizes the direction', () => {
    // Cell (1,1) center is at (26+88, 26+35) = (114, 61); cell (2,2) center
    // is at (262+88, 152+35) = (350, 187).
    expect(marqueeToCellRange(GEOM, 114, 61, 350, 187)).toEqual({ col: 1, row: 1, cols: 2, rows: 2 });
    // Dragging up-left gives the same normalized range.
    expect(marqueeToCellRange(GEOM, 350, 187, 114, 61)).toEqual({ col: 1, row: 1, cols: 2, rows: 2 });
  });

  it('a tiny marquee inside one cell is a 1×1 range', () => {
    expect(marqueeToCellRange(GEOM, 100, 50, 130, 70)).toEqual({ col: 1, row: 1, cols: 1, rows: 1 });
  });

  it('clamps to one cell beyond the current extent (growth allowed)', () => {
    const r = marqueeToCellRange(GEOM, 114, 61, 5000, 5000);
    expect(r.col).toBe(1);
    expect(r.col + r.cols - 1).toBe(GEOM.cols + 1);
    expect(r.row + r.rows - 1).toBe(GEOM.rows + 1);
  });
});

describe('groupOps', () => {
  for (const [kind, fence] of Object.entries(FENCES)) {
    it(`${kind}: appends a schema-valid group (validateDocument stays clean)`, () => {
      const source = `# T\n\n${fence}\n`;
      const doc = parseDocument(source, 't');
      const idx = doc.segments.findIndex((s) => s.kind !== 'markdown');
      const seg = doc.segments[idx];
      if (seg === undefined || seg.kind === 'markdown') throw new Error('segment missing');
      const r = must(groupOps(kind, seg.data, { col: 1, row: 1, cols: 2, rows: 1 }));
      expect(r.groupPath).toBe('groups.0');
      expect(r.sets).toHaveLength(1);
      expect(r.sets[0]?.value).toEqual({ col: 1, row: 1, cols: 2, rows: 1, label: 'Group' });
      const edited = setPathsInSegment(source, doc, idx, r.sets);
      const errors = validateDocument(parseDocument(edited, 't'), 't.md').filter(
        (d) => d.level === 'error',
      );
      expect(errors, kind).toEqual([]);
    });
  }

  it('appends after existing groups and rejects unsupported kinds', () => {
    const r = must(
      groupOps('flow', { groups: [{ col: 1, row: 1, label: 'Zone' }] }, { col: 2, row: 1, cols: 1, rows: 1 }),
    );
    expect(r.groupPath).toBe('groups.1');
    expect(r.sets[0]?.path).toEqual(['groups', 1]);
    expect(groupOps('sequence', {}, { col: 1, row: 1, cols: 1, rows: 1 })).toBeNull();
  });
});

describe('groupIndexFromPath / groupRangeAt', () => {
  it('matches exactly the group item path', () => {
    expect(groupIndexFromPath('groups.0')).toBe(0);
    expect(groupIndexFromPath('groups.12')).toBe(12);
    expect(groupIndexFromPath('groups.0.label')).toBeNull();
    expect(groupIndexFromPath('nodes.1')).toBeNull();
  });

  it('reads the range with spans defaulting to 1', () => {
    const data = { groups: [{ col: 2, row: 1, label: 'Zone' }, { col: 1, row: 2, cols: 3, rows: 2, label: 'B' }] };
    expect(groupRangeAt(data, 0)).toEqual({ col: 2, row: 1, cols: 1, rows: 1 });
    expect(groupRangeAt(data, 1)).toEqual({ col: 1, row: 2, cols: 3, rows: 2 });
    expect(groupRangeAt(data, 2)).toBeNull();
    expect(groupRangeAt({}, 0)).toBeNull();
  });
});

describe('resizeRange / fixedCellFor', () => {
  const range: CellRange = { col: 2, row: 2, cols: 2, rows: 2 }; // spans (2,2)-(3,3)

  it('fixes the corner opposite the grabbed handle', () => {
    expect(fixedCellFor('se', range)).toEqual({ col: 2, row: 2 });
    expect(fixedCellFor('nw', range)).toEqual({ col: 3, row: 3 });
    expect(fixedCellFor('ne', range)).toEqual({ col: 2, row: 3 });
    expect(fixedCellFor('sw', range)).toEqual({ col: 3, row: 2 });
  });

  it('normalizes the range whichever way the pointer crosses the anchor', () => {
    const fixed = fixedCellFor('se', range); // (2,2) anchored
    expect(resizeRange(fixed, { col: 4, row: 3 })).toEqual({ col: 2, row: 2, cols: 3, rows: 2 });
    // Crossing over the anchor flips the range instead of inverting it.
    expect(resizeRange(fixed, { col: 1, row: 1 })).toEqual({ col: 1, row: 1, cols: 2, rows: 2 });
  });

  it('collapsing onto the anchor is the 1×1 minimum', () => {
    expect(resizeRange({ col: 2, row: 2 }, { col: 2, row: 2 })).toEqual({ col: 2, row: 2, cols: 1, rows: 1 });
  });
});

describe('moveRangeBy', () => {
  const range: CellRange = { col: 2, row: 1, cols: 2, rows: 2 };

  it('shifts the origin, span unchanged', () => {
    expect(moveRangeBy(range, 1, 1, 4, 4)).toEqual({ col: 3, row: 2, cols: 2, rows: 2 });
    expect(moveRangeBy(range, -1, 0, 4, 4)).toEqual({ col: 1, row: 1, cols: 2, rows: 2 });
  });

  it('clamps to the origin ≥ 1 and one col/row of growth past the grid', () => {
    expect(moveRangeBy(range, -9, -9, 4, 4)).toEqual({ col: 1, row: 1, cols: 2, rows: 2 });
    // Far edge may reach gridCols+1 = 5 → col ≤ 4.
    expect(moveRangeBy(range, 9, 9, 4, 4)).toEqual({ col: 4, row: 4, cols: 2, rows: 2 });
  });
});

describe('growRange', () => {
  const range: CellRange = { col: 2, row: 1, cols: 2, rows: 1 };

  it('grows/shrinks the far edge one step per press', () => {
    expect(growRange(range, 'x', 1, 4, 3)).toEqual({ col: 2, row: 1, cols: 3, rows: 1 });
    expect(growRange(range, 'x', -1, 4, 3)).toEqual({ col: 2, row: 1, cols: 1, rows: 1 });
    expect(growRange(range, 'y', 1, 4, 3)).toEqual({ col: 2, row: 1, cols: 2, rows: 2 });
  });

  it('nulls at the 1×1 minimum and at one row/col past the grid', () => {
    expect(growRange({ ...range, cols: 1 }, 'x', -1, 4, 3)).toBeNull();
    expect(growRange({ ...range, rows: 1 }, 'y', -1, 4, 3)).toBeNull();
    // col 2 + cols 4 - 1 = 5 = gridCols+1 already — no further growth.
    expect(growRange({ ...range, cols: 4 }, 'x', 1, 4, 3)).toBeNull();
    expect(growRange({ col: 1, row: 3, cols: 1, rows: 1 }, 'y', 1, 4, 2)).toBeNull();
  });
});

describe('rangeBox', () => {
  it('matches the marquee snap math (cells + gaps, scaled)', () => {
    expect(rangeBox(GEOM, { col: 2, row: 1, cols: 2, rows: 2 })).toEqual({
      left: 26 + (176 + 60),
      top: 26,
      width: 2 * 176 + 60,
      height: 2 * 70 + 56,
    });
  });
});

describe('groupResizeSets / groupMoveSets — through the real pipeline', () => {
  /** The same fences, each seeded with one 1×1 group at (1,1). */
  const withGroup = (fence: string): string =>
    fence.replace(/```$/, 'groups:\n  - { col: 1, row: 1, label: Zone }\n```');

  for (const [kind, fence] of Object.entries(FENCES)) {
    it(`${kind}: a resize rewrites {col,row,cols,rows} and stays schema-valid`, () => {
      const source = `# T\n\n${withGroup(fence)}\n`;
      const doc = parseDocument(source, 't');
      const idx = doc.segments.findIndex((s) => s.kind !== 'markdown');
      const seg = doc.segments[idx];
      if (seg === undefined || seg.kind === 'markdown') throw new Error('segment missing');
      const sets = must(groupResizeSets(seg.data, 0, { col: 2, row: 1, cols: 3, rows: 2 }));
      expect(sets.map((s) => s.path)).toEqual([
        ['groups', 0, 'col'],
        ['groups', 0, 'row'],
        ['groups', 0, 'cols'],
        ['groups', 0, 'rows'],
      ]);
      const edited = setPathsInSegment(source, doc, idx, sets);
      const reparsed = parseDocument(edited, 't');
      const errors = validateDocument(reparsed, 't.md').filter((d) => d.level === 'error');
      expect(errors, kind).toEqual([]);
      const seg2 = reparsed.segments[idx];
      if (seg2 === undefined || seg2.kind === 'markdown') throw new Error('segment missing');
      expect(groupRangeAt(seg2.data, 0)).toEqual({ col: 2, row: 1, cols: 3, rows: 2 });
    });

    it(`${kind}: a move rewrites only {col,row} and stays schema-valid`, () => {
      const source = `# T\n\n${withGroup(fence)}\n`;
      const doc = parseDocument(source, 't');
      const idx = doc.segments.findIndex((s) => s.kind !== 'markdown');
      const seg = doc.segments[idx];
      if (seg === undefined || seg.kind === 'markdown') throw new Error('segment missing');
      const sets = must(groupMoveSets(seg.data, 0, { col: 3, row: 2, cols: 1, rows: 1 }));
      expect(sets.map((s) => s.path)).toEqual([
        ['groups', 0, 'col'],
        ['groups', 0, 'row'],
      ]);
      const edited = setPathsInSegment(source, doc, idx, sets);
      const reparsed = parseDocument(edited, 't');
      const errors = validateDocument(reparsed, 't.md').filter((d) => d.level === 'error');
      expect(errors, kind).toEqual([]);
      const seg2 = reparsed.segments[idx];
      if (seg2 === undefined || seg2.kind === 'markdown') throw new Error('segment missing');
      expect(groupRangeAt(seg2.data, 0)).toEqual({ col: 3, row: 2, cols: 1, rows: 1 });
      // The move never spells out the omitted spans.
      expect(edited).not.toContain('cols:');
    });
  }

  it('no-op writes commit nothing (no empty undo steps)', () => {
    const data = { groups: [{ col: 2, row: 1, cols: 2, rows: 2, label: 'Zone' }] };
    expect(groupResizeSets(data, 0, { col: 2, row: 1, cols: 2, rows: 2 })).toBeNull();
    expect(groupMoveSets(data, 0, { col: 2, row: 1, cols: 2, rows: 2 })).toBeNull();
    expect(groupResizeSets(data, 1, { col: 1, row: 1, cols: 1, rows: 1 })).toBeNull();
    expect(groupMoveSets({}, 0, { col: 1, row: 1, cols: 1, rows: 1 })).toBeNull();
  });
});
