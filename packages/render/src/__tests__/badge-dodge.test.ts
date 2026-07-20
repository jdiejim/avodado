/**
 * Edge-step badges dodge node boxes: an edge midpoint can land ON a node (a
 * long edge passing a box in a tight auto-layout), which used to print the
 * circled numeral over the node's label (the "Ch②ge" bug). The badge layer now
 * nudges any badge out of every node box (+ clearance).
 */

import { describe, expect, it } from 'vitest';
import { parseDocument } from '@avodado/core';
import { renderDocumentParts } from '../parts.js';

/** The exact shape that reproduced the bug: a vertical chain with a skip edge. */
const FLOW =
  '```flow\nnodes: [Receive, Lookup, Charge, Ack]\nedges:\n  - Receive -> Lookup: by key\n  - Lookup -> Ack: hit\n  - Lookup -> Charge: miss\n  - Charge -> Ack: record\n```\n';

/** All `x/y/width/height` node boxes in the svg. */
function nodeBoxes(svg: string): Array<{ x: number; y: number; w: number; h: number }> {
  return [...svg.matchAll(/<rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.-]+)" height="([\d.-]+)"[^>]*stroke/g)].map(
    (m) => ({ x: Number(m[1]), y: Number(m[2]), w: Number(m[3]), h: Number(m[4]) }),
  );
}

/** All step-badge circle centres (r=9.5 is the numbered-badge radius). */
function badgeCentres(svg: string): Array<{ x: number; y: number }> {
  return [...svg.matchAll(/<circle cx="([\d.-]+)" cy="([\d.-]+)" r="9\.5"/g)].map((m) => ({
    x: Number(m[1]),
    y: Number(m[2]),
  }));
}

describe('edge-step badges dodge node boxes', () => {
  it('no numbered badge centre lands inside a node box', () => {
    const { body } = renderDocumentParts(parseDocument(FLOW, 't'));
    const boxes = nodeBoxes(body);
    const badges = badgeCentres(body);
    expect(boxes.length).toBeGreaterThanOrEqual(4);
    expect(badges.length).toBe(4); // 4 labelled edges → numbered mode
    for (const b of badges) {
      for (const r of boxes) {
        const inside = b.x > r.x && b.x < r.x + r.w && b.y > r.y && b.y < r.y + r.h;
        expect(inside, `badge (${b.x},${b.y}) overlaps node box (${r.x},${r.y},${r.w},${r.h})`).toBe(false);
      }
    }
  });
});
