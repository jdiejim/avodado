/**
 * Renders a `venn` block — two or three overlapping sets.
 *
 * The shape for scope, ownership and responsibility questions, where the
 * interesting part is what two groups share. Positions are fixed (the standard
 * two-circle pair, or three on an equilateral triangle) because a Venn's job
 * is naming regions, not measuring them — `shared` labels a region by the sets
 * it belongs to, so the overlap says what it is instead of leaving the reader
 * to guess.
 *
 * Skin (`DESIGN.md`): every set is an ink outline with a faint ink wash, so
 * overlaps read darker by tone alone. A set the author marked with an accent
 * takes the accent outline and tint (`accent: red` is `negative`).
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { marksOf, type Mark } from '../svg/dsTone.js';
import { wrapText } from '../svg/wrapText.js';
import { diagramFrame } from './frame.js';

type VennData = BlockDataMap['venn'];

type Tone = 'plain' | 'accent' | 'negative';

function toneOf(mark: Mark): Tone {
  if (mark === 'negative') return 'negative';
  if (mark === 'focal') return 'accent';
  return 'plain';
}

const CIRCLE_ATTRS: Record<Tone, string> = {
  plain: 'fill="var(--ink)" fill-opacity="0.06" stroke="var(--ink)" stroke-width="1.5"',
  accent: 'fill="var(--accent-tint)" stroke="var(--accent)" stroke-width="1.5"',
  negative: 'fill="var(--negative-tint)" stroke="var(--negative)" stroke-width="1.5"',
};
const NAME_CLS: Record<Tone, string> = {
  plain: 't-name',
  accent: 't-name c-accent',
  negative: 't-name c-negative',
};

const W = 620;

/** Circle centres and the label anchors for each region, per set count. */
function geometry(n: number): {
  height: number;
  radius: number;
  circles: ReadonlyArray<{ cx: number; cy: number }>;
  own: ReadonlyArray<{ x: number; y: number }>;
  pairs: ReadonlyArray<{ of: readonly number[]; x: number; y: number }>;
  centre: { x: number; y: number };
} {
  if (n <= 2) {
    const r = 132;
    const cy = 176;
    return {
      height: 340,
      radius: r,
      circles: [
        { cx: 240, cy },
        { cx: 380, cy },
      ],
      own: [
        { x: 178, y: cy },
        { x: 442, y: cy },
      ],
      pairs: [{ of: [0, 1], x: 310, y: cy }],
      centre: { x: 310, y: cy },
    };
  }
  const r = 118;
  return {
    height: 396,
    radius: r,
    circles: [
      { cx: 250, cy: 158 },
      { cx: 370, cy: 158 },
      { cx: 310, cy: 258 },
    ],
    own: [
      { x: 196, y: 126 },
      { x: 424, y: 126 },
      { x: 310, y: 316 },
    ],
    pairs: [
      { of: [0, 1], x: 310, y: 132 },
      // The side lenses sit between two centres and away from the third —
      // measured toward the middle, not at the naive midpoint, or the label
      // drifts onto the circle's edge.
      { of: [0, 2], x: 264, y: 226 },
      { of: [1, 2], x: 356, y: 226 },
    ],
    centre: { x: 310, y: 202 },
  };
}

export function renderVenn(data: VennData): string {
  const sets = data.sets.slice(0, 3);
  const g = geometry(sets.length);
  const marks = marksOf(sets.map((set) => set.accent));
  const toneAt = (i: number): Tone => toneOf(marks[i]);

  let s = `<svg viewBox="0 0 ${W} ${g.height}" role="img"><title>${escapeHtml(data.title ?? 'Venn')}</title>`;

  s += `<g${bl('sets')}>`;
  sets.forEach((set, i) => {
    const c = g.circles[i];
    if (c === undefined) return;
    s += `<g${bp(`sets.${i}`)}>`;
    s += `<circle cx="${c.cx}" cy="${c.cy}" r="${g.radius}" ${CIRCLE_ATTRS[toneAt(i)]}/>`;
    s += `</g>`;
  });
  s += `</g>`;

  // Set names sit in the part of each circle no other circle covers.
  sets.forEach((set, i) => {
    const at = g.own[i];
    if (at === undefined) return;
    const lines = wrapText(set.label, 14, 2);
    lines.forEach((line, li) => {
      s += `<text x="${at.x}" y="${at.y - (lines.length - 1) * 8 + li * 16}" class="${NAME_CLS[toneAt(i)]}" text-anchor="middle">${escapeHtml(line)}</text>`;
    });
    if (set.desc !== undefined) {
      const y = at.y - (lines.length - 1) * 8 + lines.length * 16 + 2;
      wrapText(set.desc, 18, 2).forEach((line, li) => {
        s += `<text x="${at.x}" y="${y + li * 13}" class="t-sub c-muted" text-anchor="middle">${escapeHtml(line)}</text>`;
      });
    }
  });

  // Shared regions: match by set label, so the author names the overlap the
  // same way they named the sets.
  const indexOf = new Map(sets.map((set, i) => [set.label.toLowerCase(), i]));
  let hasShared = false;
  s += `<g${bl('shared')}>`;
  (data.shared ?? []).forEach((region, ri) => {
    const idx = region.sets
      .map((name) => indexOf.get(name.toLowerCase()))
      .filter((i): i is number => i !== undefined)
      .sort((a, b) => a - b);
    if (idx.length < 2) return;
    const at =
      idx.length >= 3
        ? g.centre
        : g.pairs.find((p) => p.of.length === idx.length && p.of.every((v, k) => v === idx[k]));
    if (at === undefined) return;
    hasShared = true;
    const lines = wrapText(region.label, sets.length > 2 ? 12 : 16, 2);
    lines.forEach((line, li) => {
      s += `<text x="${at.x}" y="${at.y - (lines.length - 1) * 7 + li * 14}" class="t-name" text-anchor="middle"${li === 0 ? bp(`shared.${ri}`) : ''}>${escapeHtml(line)}</text>`;
    });
  });
  s += `</g></svg>`;

  const items: LegendItem[] = [];
  if (sets.some((_set, i) => toneAt(i) === 'plain')) items.push({ swatch: 'node', label: 'set' });
  if (sets.some((_set, i) => toneAt(i) === 'accent')) items.push({ swatch: 'node-accent', label: 'focal set' });
  if (sets.some((_set, i) => toneAt(i) === 'negative')) items.push({ swatch: 'fill', fill: 'var(--negative-tint)', label: 'negative set' });
  if (hasShared) items.push({ swatch: 'node-fill2', label: 'overlap (darker = shared)' });
  const legendHtml = renderLegend(items);

  return diagramFrame(
    {
      tag: 'VENN',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legendHtml.length > 0 ? { legendHtml } : {}),
    },
    s,
  );
}
