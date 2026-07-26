/**
 * Renders a `venn` block — two or three overlapping sets.
 *
 * The shape for scope, ownership and responsibility questions, where the
 * interesting part is what two groups share. Positions are fixed (the standard
 * two-circle pair, or three on an equilateral triangle) because a Venn's job
 * is naming regions, not measuring them — `shared` labels a region by the sets
 * it belongs to, so the overlap says what it is instead of leaving the reader
 * to guess.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { wrapText } from '../svg/wrapText.js';
import { diagramFrame } from './frame.js';

type VennData = BlockDataMap['venn'];

const ACCENT: Readonly<Record<string, string>> = {
  navy: 'var(--navy)',
  blue: 'var(--blue)',
  teal: 'var(--teal)',
  green: 'var(--positive)',
  amber: 'var(--highlight)',
  purple: 'var(--purple)',
  red: 'var(--negative)',
  gray: 'var(--gray)',
};
const CYCLE = ['var(--navy)', 'var(--teal)', 'var(--highlight)'];

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
  const colorOf = (i: number): string =>
    sets[i]?.accent !== undefined ? (ACCENT[sets[i]?.accent ?? ''] ?? CYCLE[0] ?? '') : (CYCLE[i % CYCLE.length] ?? '');

  let s = `<svg viewBox="0 0 ${W} ${g.height}" role="img"><title>${escapeHtml(data.title ?? 'Venn')}</title>`;

  s += `<g${bl('sets')}>`;
  sets.forEach((set, i) => {
    const c = g.circles[i];
    if (c === undefined) return;
    const color = colorOf(i);
    s += `<g${bp(`sets.${i}`)}>`;
    s += `<circle cx="${c.cx}" cy="${c.cy}" r="${g.radius}" fill="${color}" fill-opacity="0.16" stroke="${color}" stroke-width="1.6"/>`;
    s += `</g>`;
  });
  s += `</g>`;

  // Set names sit in the part of each circle no other circle covers.
  sets.forEach((set, i) => {
    const at = g.own[i];
    if (at === undefined) return;
    const color = colorOf(i);
    const lines = wrapText(set.label, 14, 2);
    lines.forEach((line, li) => {
      s += `<text x="${at.x}" y="${at.y - (lines.length - 1) * 8 + li * 16}" class="vn-name" fill="${color}">${escapeHtml(line)}</text>`;
    });
    if (set.desc !== undefined) {
      const y = at.y - (lines.length - 1) * 8 + lines.length * 16 + 2;
      wrapText(set.desc, 18, 2).forEach((line, li) => {
        s += `<text x="${at.x}" y="${y + li * 13}" class="vn-desc">${escapeHtml(line)}</text>`;
      });
    }
  });

  // Shared regions: match by set label, so the author names the overlap the
  // same way they named the sets.
  const indexOf = new Map(sets.map((set, i) => [set.label.toLowerCase(), i]));
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
    const lines = wrapText(region.label, sets.length > 2 ? 12 : 16, 2);
    lines.forEach((line, li) => {
      s += `<text x="${at.x}" y="${at.y - (lines.length - 1) * 7 + li * 14}" class="vn-shared"${li === 0 ? bp(`shared.${ri}`) : ''}>${escapeHtml(line)}</text>`;
    });
  });
  s += `</g></svg>`;

  return diagramFrame(
    {
      tag: 'VENN',
      tagBg: '#2f6f6a',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
    },
    s,
  );
}
