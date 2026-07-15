/**
 * The one labelled-edge rule shared by every edge-bearing diagram renderer:
 * fewer than 4 labelled edges keep on-edge pills; 4 or more switch to circled
 * step numerals on the arrows plus a numbered legend under the SVG. Legend
 * entries carry the SAME `data-bp` as their edge so studio twin highlighting
 * works. `state` is the dual-representation exception: its numerals point at
 * the transition table's rows instead of a second legend.
 */

import { describe, expect, it } from 'vitest';
import { renderDfd } from '../blocks/dfd.js';
import { renderFlow } from '../blocks/flow.js';
import { renderGraph } from '../blocks/graph.js';
import { renderState } from '../blocks/state.js';
import { renderSwimlane } from '../blocks/swimlane.js';
import { renderUml } from '../blocks/uml.js';
import { renderFelogic } from '../blocks/felogic.js';

const chain = (n: number): { nodes: Array<{ id: string; name: string; col: number; row: number }>; edges: Array<{ from: string; to: string; label: string }> } => {
  const nodes = Array.from({ length: n + 1 }, (_, i) => ({
    id: `n${i}`,
    name: `Node ${i}`,
    col: i + 1,
    row: 1,
  }));
  const edges = Array.from({ length: n }, (_, i) => ({
    from: `n${i}`,
    to: `n${i + 1}`,
    label: `step ${i}`,
  }));
  return { nodes, edges };
};

describe('numbered edge steps + legend (labelled edges >= 4)', () => {
  it('dfd keeps pills below the threshold (no legend)', () => {
    const { nodes, edges } = chain(3);
    const html = renderDfd({ nodes, edges });
    expect(html).toContain('class="edge-label"');
    expect(html).not.toContain('class="edge-steps"');
  });

  it('dfd switches to numerals + legend at 4 labelled edges, legend items carry the edge data-bp', () => {
    const { nodes, edges } = chain(4);
    const html = renderDfd({ nodes, edges });
    expect(html).not.toContain('class="edge-label"');
    expect(html).toContain('class="edge-steps"');
    // legend entry № 1 twins with edges.0
    expect(html).toContain('<span class="edge-step" data-bp="edges.0"><b>1</b>step 0</span>');
    expect(html).toContain('<span class="edge-step" data-bp="edges.3"><b>4</b>step 3</span>');
  });

  it('flow numbers labelled edges only and keeps the error tint in the legend', () => {
    const nodes = [
      { id: 'a', label: 'A', col: 1, row: 1 },
      { id: 'b', label: 'B', col: 2, row: 1 },
      { id: 'c', label: 'C', col: 3, row: 1 },
      { id: 'd', label: 'D', col: 4, row: 1 },
      { id: 'e', label: 'E', col: 5, row: 1 },
      { id: 'f', label: 'F', col: 6, row: 1 },
    ];
    const edges = [
      { from: 'a', to: 'b', label: 'one' },
      { from: 'b', to: 'c' }, // unlabelled: never numbered
      { from: 'c', to: 'd', label: 'two' },
      { from: 'd', to: 'e', label: 'three' },
      { from: 'e', to: 'f', label: 'no', kind: 'error' as const },
    ];
    const html = renderFlow({ nodes, edges });
    expect(html).toContain('class="edge-steps"');
    // numbering runs over labelled edges in order; the unlabelled edge is skipped
    expect(html).toContain('<span class="edge-step" data-bp="edges.0"><b>1</b>one</span>');
    expect(html).toContain('<span class="edge-step" data-bp="edges.2"><b>2</b>two</span>');
    expect(html).toContain('<span class="edge-step err" data-bp="edges.4"><b>4</b>no</span>');
  });

  it('graph legend shows the weighted "label · w" text', () => {
    const nodes = Array.from({ length: 5 }, (_, i) => ({
      id: `n${i}`,
      label: `N${i}`,
      col: i + 1,
      row: 1,
    }));
    const edges = Array.from({ length: 4 }, (_, i) => ({
      from: `n${i}`,
      to: `n${i + 1}`,
      label: `hop${i}`,
      weight: i + 1,
    }));
    const html = renderGraph({ nodes, edges });
    expect(html).toContain('<span class="edge-step" data-bp="edges.0"><b>1</b>hop0 · 1</span>');
  });

  it('swimlane numbers its links with links.N paths', () => {
    const lanes = [{ label: 'One' }, { label: 'Two' }];
    const steps = [
      { id: 's1', col: 1, lane: 0, label: 'A' },
      { id: 's2', col: 2, lane: 0, label: 'B' },
      { id: 's3', col: 3, lane: 1, label: 'C' },
      { id: 's4', col: 4, lane: 1, label: 'D' },
      { id: 's5', col: 5, lane: 0, label: 'E' },
    ];
    const links = [
      { from: 's1', to: 's2', label: 'l1' },
      { from: 's2', to: 's3', label: 'l2' },
      { from: 's3', to: 's4', label: 'l3' },
      { from: 's4', to: 's5', label: 'l4' },
    ];
    const html = renderSwimlane({ lanes, steps, links });
    expect(html).toContain('class="edge-steps"');
    expect(html).toContain('<span class="edge-step" data-bp="links.2"><b>3</b>l3</span>');
  });

  it('uml numbers labelled rels with rels.N paths', () => {
    const classes = Array.from({ length: 5 }, (_, i) => ({ id: `c${i}`, name: `C${i}` }));
    const rels = Array.from({ length: 4 }, (_, i) => ({
      from: `c${i}`,
      to: `c${i + 1}`,
      label: `rel${i}`,
    }));
    const html = renderUml({ classes, rels });
    expect(html).toContain('class="edge-steps"');
    expect(html).toContain('<span class="edge-step" data-bp="rels.1"><b>2</b>rel1</span>');
  });

  it('felogic adopts the same rule with edges.N paths', () => {
    const nodes = Array.from({ length: 5 }, (_, i) => ({
      id: `m${i}`,
      name: `Mod ${i}`,
      col: i + 1,
      row: 1,
    }));
    const edges = Array.from({ length: 4 }, (_, i) => ({
      from: `m${i}`,
      to: `m${i + 1}`,
      label: `call${i}`,
    }));
    const html = renderFelogic({ nodes, edges });
    expect(html).toContain('class="edge-steps"');
    expect(html).toContain('<span class="edge-step" data-bp="edges.0"><b>1</b>call0</span>');
  });

  it('state at 4+ transitions numbers the arrows against the table rows (no second legend)', () => {
    const states = [
      { id: 'a', name: 'A', col: 1, row: 1 },
      { id: 'b', name: 'B', col: 2, row: 1 },
      { id: 'c', name: 'C', col: 3, row: 1 },
      { id: 'd', name: 'D', col: 4, row: 1 },
      { id: 'e', name: 'E', col: 5, row: 1 },
    ];
    const transitions = [
      { from: 'a', to: 'b', event: 'go1' },
      { from: 'b', to: 'c', event: 'go2' },
      { from: 'c', to: 'd', event: 'go3' },
      { from: 'd', to: 'e', event: 'go4' },
    ];
    const html = renderState({ states, transitions });
    // numerals on the diagram, no separate steps legend
    expect(html).not.toContain('class="edge-steps"');
    expect(html).toContain('<th>№</th>');
    // table row № matches the transition index; the row already carries transitions.N
    expect(html).toContain(
      '<tr data-bp="transitions.2"><td class="t-num"><span class="edge-step"><b>3</b></span></td>',
    );
  });

  it('state below 4 transitions keeps pills and the plain table', () => {
    const states = [
      { id: 'a', name: 'A', col: 1, row: 1 },
      { id: 'b', name: 'B', col: 2, row: 1 },
    ];
    const transitions = [{ from: 'a', to: 'b', event: 'publish' }];
    const html = renderState({ states, transitions });
    expect(html).toContain('class="edge-label"');
    expect(html).not.toContain('<th>№</th>');
  });
});
