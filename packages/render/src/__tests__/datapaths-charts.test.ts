/**
 * Direct-edit path tagging for the charts & overview renderers: each emits
 * `data-bp` (one addressable YAML value/item) and `data-bl` (array container)
 * attributes whose paths match the block's schema field names. The attributes
 * are inert metadata — these tests pin the contract the studio's direct-edit
 * layer navigates by.
 */

import { describe, expect, it } from 'vitest';
import { renderChart } from '../blocks/chart.js';
import { renderGantt } from '../blocks/gantt.js';
import { renderGraph } from '../blocks/graph.js';
import { renderHeatmap } from '../blocks/heatmap.js';
import { renderJourney } from '../blocks/journey.js';
import { renderPyramid } from '../blocks/pyramid.js';
import { renderQuadrant } from '../blocks/quadrant.js';
import { renderScorecard } from '../blocks/scorecard.js';
import { renderTree } from '../blocks/tree.js';

describe('data-path tagging (charts & overviews)', () => {
  it('chart (bar) tags series, per-bar values, category labels, and legend entries', () => {
    const html = renderChart({
      kind: 'bar',
      labels: ['Q1', 'Q2'],
      series: [
        { label: 'North', values: [10, 20] },
        { label: 'South', values: [5, 8] },
      ],
    });
    expect(html).toContain('<g data-bl="series">');
    expect(html).toContain('<g data-bp="series.0">');
    expect(html).toContain('<g data-bp="series.0.values.1">');
    expect(html).toContain('<g data-bp="series.1.values.0">');
    expect(html).toContain('<g data-bl="labels">');
    expect(html).toContain('data-bp="labels.0"');
    expect(html).toContain('<div class="legend" data-bl="series">');
    expect(html).toContain('<span class="item" data-bp="series.1">');
  });

  it('chart (donut) tags slices, the items container, and legend entries', () => {
    const html = renderChart({
      kind: 'donut',
      items: [
        { label: 'A', value: 60 },
        { label: 'B', value: 40 },
      ],
    });
    expect(html).toContain('<g data-bl="items">');
    expect(html).toContain('data-bp="items.0"');
    expect(html).toContain('data-bp="items.1"');
    expect(html).toContain('<div class="legend" data-bl="items">');
    expect(html).toContain('<span class="item" data-bp="items.0">');
  });

  it('chart (waterfall) tags item rows, label/value texts, budget, and the items container', () => {
    const html = renderChart({
      kind: 'waterfall',
      budget: 100,
      items: [
        { label: 'Parse', value: 40 },
        { label: 'Render', value: 30 },
      ],
    });
    expect(html).toContain('<g data-bl="items">');
    expect(html).toContain('<g data-bp="items.0">');
    expect(html).toContain('data-bp="items.0.label"');
    expect(html).toContain('data-bp="items.1.value"');
    expect(html).toContain('data-bp="budget"');
  });

  it('heatmap tags cells, row labels, column labels, and the grid container', () => {
    const html = renderHeatmap({
      xLabels: ['Mon', 'Tue'],
      rows: [
        { label: 'API', values: [1, 2] },
        { label: 'Web', values: [3, 4] },
      ],
    });
    expect(html).toContain('data-bl="rows"');
    expect(html).toContain('data-bp="xLabels.0"');
    expect(html).toContain('data-bp="rows.1.label"');
    expect(html).toContain('data-bp="rows.0.values.1"');
    expect(html).toContain('data-bp="rows.1.values.0"');
  });

  it('scorecard tags criterion rows, option headers, score cells, and both containers', () => {
    const html = renderScorecard({
      criteria: [
        { label: 'Cost', weight: 2 },
        { label: 'Speed' },
      ],
      options: [
        { label: 'Build', scores: [3, 4] },
        { label: 'Buy', scores: [5, 2], note: 'vendor' },
      ],
    });
    expect(html).toContain('<tr data-bl="options">');
    expect(html).toContain('data-bp="options.1"');
    expect(html).toContain('data-bp="options.1.note"');
    expect(html).toContain('<tbody data-bl="criteria">');
    expect(html).toContain('<tr data-bp="criteria.0">');
    expect(html).toContain('data-bp="criteria.0.label"');
    expect(html).toContain('data-bp="criteria.0.weight"');
    expect(html).toContain('data-bp="options.0.scores.1"');
  });

  it('chart (funnel) tags stage bands and label/value/desc texts — paths follow the field used', () => {
    // Canonical `items` field → items.* paths.
    const html = renderChart({
      kind: 'funnel',
      items: [
        { label: 'Visit', value: 1000 },
        { label: 'Signup', value: 200, desc: 'free tier' },
      ],
    });
    expect(html).toContain('<g data-bl="items">');
    expect(html).toContain('<g data-bp="items.0">');
    expect(html).toContain('data-bp="items.0.value"');
    expect(html).toContain('data-bp="items.1.label"');
    expect(html).toContain('data-bp="items.1.desc"');

    // Funnel-era legacy `stages` field → stages.* paths (direct edit must
    // address the YAML the author actually wrote).
    const legacy = renderChart({
      kind: 'funnel',
      stages: [
        { label: 'Visit', value: 1000 },
        { label: 'Signup', value: 200, desc: 'free tier' },
      ],
    });
    expect(legacy).toContain('<g data-bl="stages">');
    expect(legacy).toContain('<g data-bp="stages.0">');
    expect(legacy).toContain('data-bp="stages.0.value"');
    expect(legacy).toContain('data-bp="stages.1.label"');
    expect(legacy).toContain('data-bp="stages.1.desc"');
  });

  it('pyramid tags level bands, desc texts, and the levels container', () => {
    const html = renderPyramid({
      levels: [
        { label: 'Vision' },
        { label: 'Strategy', desc: 'how we win' },
      ],
    });
    expect(html).toContain('<g data-bl="levels">');
    expect(html).toContain('<g data-bp="levels.0">');
    expect(html).toContain('data-bp="levels.1.desc"');
  });

  it('quadrant tags point groups, point labels, axis fields, and the items container', () => {
    const html = renderQuadrant({
      xAxis: { label: 'Effort', low: 'Low', high: 'High' },
      yAxis: { label: 'Impact' },
      items: [
        { x: 0.2, y: 0.8, label: 'Quick win' },
        { x: 0.9, y: 0.9, label: 'Big bet' },
      ],
    });
    expect(html).toContain('<g data-bl="items">');
    expect(html).toContain('data-bp="items.0"');
    expect(html).toContain('data-bp="items.1.label"');
    expect(html).toContain('data-bp="xAxis.label"');
    expect(html).toContain('data-bp="yAxis.label"');
    expect(html).toContain('data-bp="xAxis.low"');
  });

  it('tree tags rows by original node index, labels, notes, and the list container', () => {
    const html = renderTree({
      nodes: [
        { id: 'root', label: 'src' },
        { id: 'a', parent: 'root', label: 'blocks', note: 'renderers' },
        { id: 'b', parent: 'root', label: 'svg' },
      ],
    });
    expect(html).toContain('<div class="tree-list" data-bl="nodes">');
    expect(html).toContain('data-bp="nodes.0"');
    expect(html).toContain('data-bp="nodes.1.label"');
    expect(html).toContain('data-bp="nodes.1.note"');
    expect(html).toContain('data-bp="nodes.2"');
  });

  it('tree variant: issue (the former mece) tags node cards and the nodes container', () => {
    const html = renderTree({
      variant: 'issue' as const,
      nodes: [
        { id: 'root', label: 'Revenue down' },
        { id: 'p', parent: 'root', label: 'Price', note: 'per unit' },
        { id: 'v', parent: 'root', label: 'Volume' },
      ],
    });
    expect(html).toContain('<g data-bl="nodes">');
    expect(html).toContain('data-bp="nodes.0"');
    expect(html).toContain('data-bp="nodes.2"');
  });

  it('graph tags node pills, edges, edge pills, and the nodes container', () => {
    const html = renderGraph({
      nodes: [
        { id: 'a', col: 1, row: 1, label: 'A' },
        { id: 'b', col: 2, row: 1, label: 'B' },
      ],
      edges: [{ from: 'a', to: 'b', label: 'link', weight: 3 }],
    });
    expect(html).toContain('<g data-bl="nodes">');
    expect(html).toContain('data-bp="nodes.0"');
    expect(html).toContain('data-bp="nodes.1"');
    expect(html).toContain('data-bp="edges.0"');
  });

  it('journey tags stage headers, row cells, emotion dots, and their containers', () => {
    const html = renderJourney({
      stages: [{ label: 'Discover' }, { label: 'Buy' }],
      rows: [
        { label: 'Actions', cells: ['search', 'checkout'] },
        { label: 'Feelings', cells: ['curious', 'happy'] },
      ],
      emotion: [0.5, 0.9],
    });
    expect(html).toContain('<tr data-bl="stages">');
    expect(html).toContain('data-bp="stages.1"');
    expect(html).toContain('<tbody data-bl="rows">');
    expect(html).toContain('<tr data-bp="rows.0">');
    expect(html).toContain('data-bp="rows.0.label"');
    expect(html).toContain('data-bp="rows.1.cells.0"');
    expect(html).toContain('<g data-bl="emotion">');
    expect(html).toContain('data-bp="emotion.1"');
  });

  it('gantt tags period columns, task rows, task labels, and both containers', () => {
    const html = renderGantt({
      periods: ['W1', 'W2', 'W3'],
      tasks: [
        { label: 'Design', start: 0, span: 1 },
        { label: 'Build', start: 1, span: 2, kind: 'active' },
      ],
    });
    expect(html).toContain('<g data-bl="periods">');
    expect(html).toContain('<g data-bp="periods.0">');
    expect(html).toContain('<g data-bl="tasks">');
    expect(html).toContain('<g data-bp="tasks.1">');
    expect(html).toContain('data-bp="tasks.0.label"');
  });
});
