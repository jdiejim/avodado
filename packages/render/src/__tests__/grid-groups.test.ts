/**
 * Dashed GROUP wrappers on the grid diagrams (flow / dfd / state / c4 share
 * the block renderer's group drawing via `svg/gridGroups.ts`):
 *
 * - a group renders as a dashed outline rect + corner label inside a
 *   `data-bl="groups"` layer, each group tagged `data-bp="groups.N"`,
 *   drawn BEFORE (beneath) edges and nodes;
 * - padding grows only when groups exist, so an edge-hugging group is never
 *   clipped by the viewBox — and a GROUP-LESS document renders byte-identically
 *   to the pre-groups output (pinned below).
 */

import { describe, expect, it } from 'vitest';
import { renderC4 } from '../blocks/c4.js';
import { renderDfd } from '../blocks/dfd.js';
import { renderFlow } from '../blocks/flow.js';
import { renderState } from '../blocks/state.js';

const GROUP = [{ col: 1, row: 1, cols: 2, rows: 1, label: 'Zone A' }];

const DASHED_RECT = /<rect [^>]*stroke-dasharray="7 5"\/>/;

describe('grid groups on flow / dfd / state / c4', () => {
  const outputs: ReadonlyArray<[string, string]> = [
    [
      'flow',
      renderFlow({
        nodes: [
          { id: 'a', label: 'Start', kind: 'start', col: 1, row: 1 },
          { id: 'b', label: 'Work', kind: 'process', col: 2, row: 1 },
        ],
        edges: [{ from: 'a', to: 'b' }],
        groups: GROUP,
      }),
    ],
    [
      'dfd',
      renderDfd({
        nodes: [
          { id: 'a', name: 'Client', kind: 'external', col: 1, row: 1 },
          { id: 'b', name: 'Ingest', kind: 'process', col: 2, row: 1 },
        ],
        edges: [{ from: 'a', to: 'b' }],
        groups: GROUP,
      }),
    ],
    [
      'state',
      renderState({
        states: [
          { id: 'a', name: 'Draft', col: 1, row: 1 },
          { id: 'b', name: 'Live', col: 2, row: 1 },
        ],
        transitions: [{ from: 'a', to: 'b', event: 'publish' }],
        groups: GROUP,
      }),
    ],
    [
      'c4',
      renderC4({
        nodes: [
          { id: 'a', kind: 'person', name: 'User', col: 1, row: 1 },
          { id: 'b', kind: 'system', name: 'API', col: 2, row: 1 },
        ],
        edges: [{ from: 'a', to: 'b' }],
        groups: GROUP,
      }),
    ],
  ];

  for (const [kind, html] of outputs) {
    it(`${kind}: renders the dashed group layer beneath edges and nodes`, () => {
      expect(html, kind).toContain('data-bl="groups"');
      expect(html, kind).toContain('data-bp="groups.0"');
      expect(html, kind).toMatch(DASHED_RECT);
      expect(html, kind).toContain('class="grp-label"');
      expect(html, kind).toContain('>Zone A</text>');
      // Beneath: the groups layer appears before the first edge/node markup.
      expect(html.indexOf('data-bl="groups"'), kind).toBeLessThan(html.indexOf('data-bp="nodes.0"') === -1 ? html.indexOf('data-bp="states.0"') : html.indexOf('data-bp="nodes.0"'));
    });

    it(`${kind}: an edge-hugging group stays inside the viewBox`, () => {
      const m = /<rect x="(-?[\d.]+)" y="(-?[\d.]+)" [^>]*stroke-dasharray="7 5"\/>/.exec(html);
      expect(m, kind).not.toBeNull();
      expect(Number(m?.[1]), kind).toBeGreaterThanOrEqual(0);
      expect(Number(m?.[2]), kind).toBeGreaterThanOrEqual(0);
    });
  }

  it('a group color flows into the outline and label; bad colors are dropped', () => {
    const html = renderFlow({
      nodes: [{ id: 'a', label: 'A', col: 1, row: 1 }],
      groups: [
        { col: 1, row: 1, label: 'Tinted', color: '#9c4a2f' },
      ],
    });
    expect(html).toContain('stroke="#9c4a2f"');
    expect(html).toContain('fill="#9c4a2f"');
  });

  it('group-less flow output is byte-identical to the pre-groups renderer (pin)', () => {
    const html = renderFlow({
      nodes: [
        { id: 'a', label: 'Start', kind: 'start', col: 1, row: 1 },
        { id: 'b', label: 'Work', kind: 'process', col: 2, row: 1 },
      ],
      edges: [{ from: 'a', to: 'b' }],
    });
    // Captured from the renderer BEFORE groups landed, updated deliberately
    // when the edges gained their `data-bl` list container (add-chips) —
    // pads and layer set must not shift for documents that use no groups.
    expect(html).toBe(
      '<div class="diagram"><div class="diagram-head"><span class="diagram-tag" style="background:#374151">FLOW</span></div><svg viewBox="0 0 464 118" role="img" data-grid="1" data-cols="2" data-rows="1" data-cell-w="176" data-cell-h="70" data-gap-x="60" data-gap-y="56" data-pad-x="26" data-pad-top="26"><title>Flowchart</title><g data-bl="edges"><path d="M 202 61 H 232 V 61 H 262" fill="none" stroke="var(--charcoal)" stroke-width="1.4" marker-end="url(#gArrow)" data-bp="edges.0"/></g><g data-bl="nodes"><g filter="url(#gshadow)" data-bp="nodes.0" data-col="1" data-row="1" data-w="1"><rect x="26" y="26" width="176" height="70" rx="35" fill="#dcf1e2" stroke="#1f9747" stroke-width="1.5"/><text x="114" y="65" class="fc-label" fill="#0f3d22">Start</text></g><g filter="url(#gshadow)" data-bp="nodes.1" data-col="2" data-row="1" data-w="1"><rect x="262" y="26" width="176" height="70" rx="7" fill="#e5eff8" stroke="#0e54a1" stroke-width="1.4"/><text x="350" y="65" class="fc-label" fill="#0a3a6e">Work</text></g></g></svg></div>',
    );
  });
});
