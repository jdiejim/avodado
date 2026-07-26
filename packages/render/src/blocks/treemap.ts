/**
 * Renders a `treemap` block — proportional composition as nested tiles.
 *
 * A donut is honest up to about six slices; past that the arcs are too thin to
 * label and the eye can't compare them. A treemap keeps working: area is the
 * value, the big tiles are the answer, and the small ones still have somewhere
 * to sit. Cloud spend by service, a bundle by module, test time by suite.
 *
 * Laid out by the standard **squarified** algorithm: take items biggest-first,
 * keep adding to the current row while doing so improves the worst
 * aspect-ratio in that row, then lay the row along the short edge of what's
 * left and recurse into the rest. That is what keeps tiles near-square, which
 * is what makes areas comparable by eye.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { wrapText } from '../svg/wrapText.js';
import { diagramFrame } from './frame.js';

type TreemapData = BlockDataMap['treemap'];
type Item = TreemapData['items'][number];

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
const CYCLE = ['var(--navy)', 'var(--teal)', 'var(--blue)', 'var(--purple)', 'var(--highlight)'];

const W = 880;
const H = 400;
const PAD = 3; // gutter between tiles

interface Tile {
  readonly item: Item;
  readonly index: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Worst aspect ratio in a row of areas laid along `side`. */
function worst(areas: readonly number[], side: number): number {
  if (areas.length === 0 || side <= 0) return Infinity;
  const sum = areas.reduce((a, v) => a + v, 0);
  if (sum <= 0) return Infinity;
  const max = Math.max(...areas);
  const min = Math.min(...areas);
  return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));
}

/** Places one settled row along the short edge and returns what's left. */
function layRow(row: readonly { area: number; tile: Tile }[], rect: Rect): Rect {
  const sum = row.reduce((a, r) => a + r.area, 0);
  const horizontal = rect.w >= rect.h;
  const thickness = sum / (horizontal ? rect.h : rect.w);
  let along = horizontal ? rect.y : rect.x;
  for (const { area, tile } of row) {
    const length = area / thickness;
    if (horizontal) {
      tile.x = rect.x;
      tile.y = along;
      tile.w = thickness;
      tile.h = length;
    } else {
      tile.x = along;
      tile.y = rect.y;
      tile.w = length;
      tile.h = thickness;
    }
    along += length;
  }
  return horizontal
    ? { x: rect.x + thickness, y: rect.y, w: rect.w - thickness, h: rect.h }
    : { x: rect.x, y: rect.y + thickness, w: rect.w, h: rect.h - thickness };
}

/** Squarified treemap: fills `rect` with tiles whose areas are `areas`. */
function squarify(tiles: readonly Tile[], areas: readonly number[], start: Rect): void {
  let rect = start;
  let row: { area: number; tile: Tile }[] = [];
  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i];
    const area = areas[i];
    if (tile === undefined || area === undefined) continue;
    const side = Math.min(rect.w, rect.h);
    const current = row.map((r) => r.area);
    if (row.length === 0 || worst([...current, area], side) <= worst(current, side)) {
      row.push({ area, tile });
    } else {
      rect = layRow(row, rect);
      row = [{ area, tile }];
    }
  }
  if (row.length > 0) layRow(row, rect);
}

function fmt(v: number, unit: string | undefined): string {
  const rounded = Math.round(v * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return unit !== undefined ? `${text}${unit}` : text;
}

export function renderTreemap(data: TreemapData): string {
  // Biggest first — squarified layout depends on descending order, and the
  // authored index rides along so click-to-edit still points at the right item.
  const ordered = data.items
    .map((item, index) => ({ item, index }))
    .filter((e) => e.item.value > 0)
    .sort((a, b) => b.item.value - a.item.value);

  const total = ordered.reduce((a, e) => a + e.item.value, 0);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img"><title>${escapeHtml(data.title ?? 'Treemap')}</title>`;

  if (ordered.length === 0 || total <= 0) {
    s += `<rect x="0" y="0" width="${W}" height="${H}" rx="8" fill="var(--light-gray)"/></svg>`;
    return frame(data, s);
  }

  const tiles: Tile[] = ordered.map((e) => ({ item: e.item, index: e.index, x: 0, y: 0, w: 0, h: 0 }));
  const scale = (W * H) / total;
  squarify(
    tiles,
    ordered.map((e) => e.item.value * scale),
    { x: 0, y: 0, w: W, h: H },
  );

  s += `<g${bl('items')}>`;
  tiles.forEach((t, i) => {
    const x = t.x + PAD / 2;
    const y = t.y + PAD / 2;
    const w = Math.max(0, t.w - PAD);
    const h = Math.max(0, t.h - PAD);
    if (w < 2 || h < 2) return;
    const color = t.item.accent !== undefined ? (ACCENT[t.item.accent] ?? CYCLE[0]) : CYCLE[i % CYCLE.length];
    const share = Math.round((t.item.value / total) * 100);
    s += `<g${bp(`items.${t.index}`)}>`;
    s += `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" rx="5" fill="${color ?? 'var(--navy)'}" fill-opacity="${0.9 - Math.min(i, 6) * 0.08}"/>`;
    // Text only where it fits — a 12px line needs room, and a half-clipped
    // label reads worse than a tile that lets its tooltip do the talking.
    if (w >= 58 && h >= 30) {
      const chars = Math.max(6, Math.floor(w / 7.2));
      const lines = wrapText(t.item.label, chars, h >= 58 ? 2 : 1);
      lines.forEach((line, li) => {
        s += `<text x="${r(x + 9)}" y="${r(y + 20 + li * 14)}" class="tm-name">${escapeHtml(line)}</text>`;
      });
      const below = y + 20 + lines.length * 14;
      if (h >= 48) {
        s += `<text x="${r(x + 9)}" y="${r(below + 2)}" class="tm-value">${escapeHtml(fmt(t.item.value, data.unit))} · ${share}%</text>`;
      }
      if (t.item.desc !== undefined && h >= 74) {
        s += `<text x="${r(x + 9)}" y="${r(below + 18)}" class="tm-desc">${escapeHtml(t.item.desc)}</text>`;
      }
    }
    s += `<title>${escapeHtml(`${t.item.label}: ${fmt(t.item.value, data.unit)} (${share}%)`)}</title>`;
    s += `</g>`;
  });
  s += `</g></svg>`;
  return frame(data, s);
}

function r(v: number): number {
  return Math.round(v * 10) / 10;
}

function frame(data: TreemapData, inner: string): string {
  return diagramFrame(
    {
      tag: 'TREEMAP',
      tagBg: '#5b4a8a',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
    },
    inner,
  );
}
