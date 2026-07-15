/**
 * Part-selection rules: classification (move vs navigate vs inert), the
 * one-step arrow planners, the selection-path remap after a move, and the
 * keyboard routing precedence ladder.
 */

import { describe, expect, it } from 'vitest';
import {
  capturesArrows,
  classifyPart,
  deletablePathFor,
  indexAfterReorder,
  kanbanPathAfterMove,
  keySurface,
  pathAfterReorder,
  planCellNav,
  planItemArrow,
} from './partSelect.js';

describe('classifyPart — move vs navigate vs inert', () => {
  it('grid nodes are grid movers on every grid kind, per node-list field', () => {
    // Only canonical kinds reach this layer — alias fences (infra/
    // event/ddd/network) parse to `block` with a preset.
    expect(classifyPart('block', 'nodes.2')).toEqual({ kind: 'grid', listPath: 'nodes', index: 2 });
    expect(classifyPart('flow', 'nodes.0')).toEqual({ kind: 'grid', listPath: 'nodes', index: 0 });
    expect(classifyPart('graph', 'nodes.1')).toEqual({ kind: 'grid', listPath: 'nodes', index: 1 });
    expect(classifyPart('state', 'states.1')).toEqual({ kind: 'grid', listPath: 'states', index: 1 });
    expect(classifyPart('swimlane', 'steps.2')).toEqual({ kind: 'grid', listPath: 'steps', index: 2 });
  });

  it('a tagged leaf INSIDE a grid node moves the node (not the array order)', () => {
    expect(classifyPart('state', 'states.1.name')).toEqual({ kind: 'grid', listPath: 'states', index: 1 });
    expect(classifyPart('c4', 'nodes.0.name')).toEqual({ kind: 'grid', listPath: 'nodes', index: 0 });
    // Kanban card leaves keep their own two-axis mapping via the enclosing card.
    expect(classifyPart('kanban', 'columns.0.cards.1.title')).toEqual({
      kind: 'item',
      listPath: 'columns.0.cards',
      index: 1,
      suffix: '.title',
    });
  });

  it('cycle stages are ring items (all four arrows reorder them)', () => {
    expect(classifyPart('cycle', 'steps.1')).toEqual({ kind: 'item', listPath: 'steps', index: 1 });
    expect(classifyPart('cycle', 'steps.1.label')).toEqual({ kind: 'item', listPath: 'steps', index: 1 });
  });

  it('group wrappers are range movers on every grid kind', () => {
    for (const k of ['flow', 'dfd', 'state', 'c4', 'block']) {
      expect(classifyPart(k, 'groups.1'), k).toEqual({ kind: 'grid-group', index: 1 });
    }
    // Non-grid kinds keep the generic item rule for a `groups` list.
    expect(classifyPart('sequence', 'groups.0')).toEqual({
      kind: 'item',
      listPath: 'groups',
      index: 0,
    });
  });

  it('table: cells NAVIGATE; rows and header cells move', () => {
    expect(classifyPart('table', 'rows.1.2')).toEqual({ kind: 'table-cell', row: 1, col: 2 });
    expect(classifyPart('table', 'rows.1')).toEqual({ kind: 'item', listPath: 'rows', index: 1 });
    expect(classifyPart('table', 'columns.0')).toEqual({ kind: 'table-col', index: 0 });
  });

  it('kanban: cards are two-axis movers; column labels move the column', () => {
    expect(classifyPart('kanban', 'columns.1.cards.0')).toEqual({
      kind: 'kanban-card',
      col: 1,
      index: 0,
    });
    expect(classifyPart('kanban', 'columns.2.label')).toEqual({
      kind: 'item',
      listPath: 'columns',
      index: 2,
    });
  });

  it('the GENERIC rule: any array item reorders — glossary terms, messages, deep lists', () => {
    expect(classifyPart('glossary', 'terms.3')).toEqual({
      kind: 'item',
      listPath: 'terms',
      index: 3,
    });
    expect(classifyPart('sequence', 'messages.1')).toEqual({
      kind: 'item',
      listPath: 'messages',
      index: 1,
    });
    expect(classifyPart('okr', 'objectives.0.krs.2')).toEqual({
      kind: 'item',
      listPath: 'objectives.0.krs',
      index: 2,
    });
  });

  it('a scalar leaf INSIDE an item moves the item, keeping the leaf suffix', () => {
    expect(classifyPart('okr', 'items.1.title')).toEqual({
      kind: 'item',
      listPath: 'items',
      index: 1,
      suffix: '.title',
    });
    // Kinds whose list drag-reorders resolve leaves to the ITEM itself
    // (timeline-style — the selection follows the row, not the leaf).
    expect(classifyPart('glossary', 'terms.3.term')).toEqual({
      kind: 'item',
      listPath: 'terms',
      index: 3,
    });
    expect(classifyPart('faq', 'items.0.question')).toEqual({
      kind: 'item',
      listPath: 'items',
      index: 0,
    });
  });

  it('parts with NO array ancestor are inert', () => {
    expect(classifyPart('callout', 'body')).toEqual({ kind: 'inert' });
    expect(classifyPart('sequence', 'title')).toEqual({ kind: 'inert' });
    expect(classifyPart('table', 'note')).toEqual({ kind: 'inert' });
  });

  it('deletablePathFor: items and leaves delete the enclosing item; cells/scalars nothing', () => {
    expect(deletablePathFor('glossary', 'terms.2')).toBe('terms.2');
    expect(deletablePathFor('glossary', 'terms.2.term')).toBe('terms.2');
    expect(deletablePathFor('timeline', 'items.1.label')).toBe('items.1');
    expect(deletablePathFor('kanban', 'columns.1.cards.0')).toBe('columns.1.cards.0');
    expect(deletablePathFor('block', 'nodes.2')).toBe('nodes.2');
    expect(deletablePathFor('state', 'states.1')).toBe('states.1');
    expect(deletablePathFor('swimlane', 'steps.0')).toBe('steps.0');
    expect(deletablePathFor('flow', 'groups.1')).toBe('groups.1');
    expect(deletablePathFor('table', 'columns.1')).toBe('columns.1');
    expect(deletablePathFor('table', 'rows.0.1')).toBeNull(); // cells navigate, never delete
    expect(deletablePathFor('callout', 'body')).toBeNull();
  });

  it('capturesArrows: movable parts and cells capture; inert releases (page scroll)', () => {
    expect(capturesArrows(classifyPart('block', 'nodes.0'))).toBe(true);
    expect(capturesArrows(classifyPart('table', 'rows.0.0'))).toBe(true);
    expect(capturesArrows(classifyPart('glossary', 'terms.0'))).toBe(true);
    expect(capturesArrows(classifyPart('callout', 'body'))).toBe(false);
  });
});

describe('planItemArrow — one-step reorder planning', () => {
  it('vertical lists answer ↑↓, horizontal lists ←→ — off-axis is null', () => {
    expect(planItemArrow({ axis: 'y', key: 'ArrowDown', index: 0, length: 3 })).toEqual({
      gap: 2,
      newIndex: 1,
    });
    expect(planItemArrow({ axis: 'y', key: 'ArrowUp', index: 2, length: 3 })).toEqual({
      gap: 1,
      newIndex: 1,
    });
    expect(planItemArrow({ axis: 'y', key: 'ArrowLeft', index: 1, length: 3 })).toBeNull();
    expect(planItemArrow({ axis: 'x', key: 'ArrowRight', index: 0, length: 2 })).toEqual({
      gap: 2,
      newIndex: 1,
    });
    expect(planItemArrow({ axis: 'x', key: 'ArrowDown', index: 0, length: 2 })).toBeNull();
  });

  it('edges are null (no wrap)', () => {
    expect(planItemArrow({ axis: 'y', key: 'ArrowUp', index: 0, length: 3 })).toBeNull();
    expect(planItemArrow({ axis: 'y', key: 'ArrowDown', index: 2, length: 3 })).toBeNull();
  });
});

describe('planCellNav — spreadsheet cell cursor', () => {
  const colsInRow = (r: number): number => (r === 1 ? 2 : 3); // row 1 is ragged

  it('moves within the row and across rows', () => {
    expect(planCellNav({ row: 0, col: 0, key: 'ArrowRight', rowCount: 3, colsInRow })).toEqual({
      row: 0,
      col: 1,
    });
    expect(planCellNav({ row: 0, col: 1, key: 'ArrowLeft', rowCount: 3, colsInRow })).toEqual({
      row: 0,
      col: 0,
    });
    expect(planCellNav({ row: 0, col: 0, key: 'ArrowDown', rowCount: 3, colsInRow })).toEqual({
      row: 1,
      col: 0,
    });
    expect(planCellNav({ row: 2, col: 1, key: 'ArrowUp', rowCount: 3, colsInRow })).toEqual({
      row: 1,
      col: 1,
    });
  });

  it('clamps the column when entering a ragged (shorter) row', () => {
    expect(planCellNav({ row: 0, col: 2, key: 'ArrowDown', rowCount: 3, colsInRow })).toEqual({
      row: 1,
      col: 1,
    });
  });

  it('stops at the table edges (no wrap)', () => {
    expect(planCellNav({ row: 0, col: 0, key: 'ArrowLeft', rowCount: 3, colsInRow })).toBeNull();
    expect(planCellNav({ row: 0, col: 2, key: 'ArrowRight', rowCount: 3, colsInRow })).toBeNull();
    expect(planCellNav({ row: 0, col: 0, key: 'ArrowUp', rowCount: 3, colsInRow })).toBeNull();
    expect(planCellNav({ row: 2, col: 0, key: 'ArrowDown', rowCount: 3, colsInRow })).toBeNull();
  });
});

describe('selection remap after a move', () => {
  it('indexAfterReorder mirrors applyReorder bookkeeping', () => {
    expect(indexAfterReorder(0, 3)).toBe(2); // moved past two items
    expect(indexAfterReorder(3, 0)).toBe(0); // moved to the front
    expect(indexAfterReorder(1, 1)).toBe(1); // no-op gaps keep the index
    expect(indexAfterReorder(1, 2)).toBe(1);
    expect(indexAfterReorder(2, 4)).toBe(3);
  });

  it('pathAfterReorder follows the item, including deep list paths', () => {
    expect(pathAfterReorder('actors', 0, 2)).toBe('actors.1');
    expect(pathAfterReorder('rows', 2, 0)).toBe('rows.0');
    expect(pathAfterReorder('objectives.0.krs', 1, 3)).toBe('objectives.0.krs.2');
  });

  it('kanbanPathAfterMove: same-column reorder vs cross-column insert (clamped)', () => {
    expect(
      kanbanPathAfterMove({ fromCol: 0, fromIdx: 0, toCol: 0, gap: 2, targetLen: 2 }),
    ).toBe('columns.0.cards.1');
    expect(
      kanbanPathAfterMove({ fromCol: 0, fromIdx: 1, toCol: 2, gap: 0, targetLen: 1 }),
    ).toBe('columns.2.cards.0');
    expect(
      kanbanPathAfterMove({ fromCol: 0, fromIdx: 0, toCol: 1, gap: 99, targetLen: 3 }),
    ).toBe('columns.1.cards.3');
  });
});

describe('keySurface — routing precedence', () => {
  it('sheet > part > block > canvas', () => {
    expect(keySurface({ sheetOpen: true, partSelected: true, blockSelected: true })).toBe('sheet');
    expect(keySurface({ sheetOpen: false, partSelected: true, blockSelected: true })).toBe('part');
    expect(keySurface({ sheetOpen: false, partSelected: false, blockSelected: true })).toBe(
      'block',
    );
    expect(keySurface({ sheetOpen: false, partSelected: false, blockSelected: false })).toBe(
      'canvas',
    );
  });
});
