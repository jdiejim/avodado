/**
 * Slide layout intelligence:
 *  - AUTO-SPLIT: substantial prose + the section's first medium exhibit that
 *    would overflow stacked lays out side by side (message | exhibit) instead
 *    of spilling or shrinking — the `{split}` layout, chosen automatically;
 *  - the HERO rule still wins for full-stage exhibits (they never share);
 *  - light sections keep the plain stacked layout;
 *  - the deck ships the progressive step-reveal (build) machinery.
 */

import { describe, expect, it } from 'vitest';
import { parseDocument } from '@avodado/core';
import { renderSlides } from '../parts.js';
import { toSlides } from '../deck.js';

const PROSE_LONG = ('Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod. '.repeat(11)).trim(); // ~800 chars → weight ~4.5

/** Medium sequence: weight 2 + 2·0.6 + 3·0.9 ≈ 5.9 (≥3, < hero 8). */
const SEQ_MED =
  '```sequence\nactors:\n  - { id: a, name: A }\n  - { id: b, name: B }\nmessages:\n  - a -> b: one\n  - b -> a: two\n  - a -> b: three\n```\n';

/** Heavy sequence: weight 2 + 1.2 + 6·0.9 ≈ 8.6 (hero). */
const SEQ_HERO =
  '```sequence\nactors:\n  - { id: a, name: A }\n  - { id: b, name: B }\nmessages:\n  - a -> b: m1\n  - b -> a: m2\n  - a -> b: m3\n  - b -> a: m4\n  - a -> b: m5\n  - b -> a: m6\n```\n';

function slidesOf(md: string) {
  return renderSlides(parseDocument(md, 't')).slides;
}

describe('auto-split slide layout', () => {
  it('long prose + a medium exhibit becomes ONE split slide (not a spill)', () => {
    const slides = slidesOf(`## The flow\n\n${PROSE_LONG}\n\n${SEQ_MED}`);
    expect(slides).toHaveLength(1);
    expect(slides[0]?.layout).toBe('split');
    expect(slides[0]?.html).toContain('sl-msg');
    expect(slides[0]?.html).toContain('sl-exhibit');
  });

  it('light prose + a small block stays a plain stacked slide', () => {
    const slides = slidesOf(`## The flow\n\nOne short line of context.\n\n${SEQ_MED}`);
    expect(slides).toHaveLength(1);
    expect(slides[0]?.layout).toBeUndefined();
  });

  it('a HERO exhibit still takes its own slide (prose keeps the first)', () => {
    const slides = slidesOf(`## The flow\n\n${PROSE_LONG}\n\n${SEQ_HERO}`);
    expect(slides).toHaveLength(2);
    expect(slides[0]?.layout).toBeUndefined();
    expect(slides[1]?.title).toBe('The flow'); // continuation keeps the section title
  });

  it('an explicit {split} marker still forces the layout', () => {
    const slides = slidesOf(`## The flow {split}\n\nShort intro.\n\n${SEQ_MED}`);
    expect(slides[0]?.layout).toBe('split');
  });
});

describe('deck shows diagrams complete (no step builds)', () => {
  it('ships no reveal machinery — the full diagram is visible on entry', () => {
    const html = toSlides(parseDocument(`## The flow\n\n${SEQ_MED}`, 't'));
    expect(html).not.toContain('rv-hide');
    expect(html).not.toContain('revealGroups');
  });
});
