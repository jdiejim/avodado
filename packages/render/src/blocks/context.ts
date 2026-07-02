/**
 * Renders a `context` block — a context-window token budget, in pure SVG
 * inside the diagram frame (tag CONTEXT). One horizontal stacked bar sized
 * against `window`: segments left-to-right proportional to their tokens,
 * coloured by accent (default bright cycle) at fill-opacity .9; wide
 * segments (>90px) carry a white label, narrow ones a numeral matching the
 * legend beneath. Remaining space renders as a dim light-gray "free (N)"
 * segment; when the segments sum past the window, the overflow renders in
 * var(--negative) past a dashed window boundary with an "over budget" chip.
 *
 * Zero-token segments are skipped; sums that hit the window exactly draw no
 * free segment.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { diagramFrame } from './frame.js';

type ContextData = BlockDataMap['context'];
type Segment = ContextData['segments'][number];

/** Accent name → bright diagram palette hex (matches chart / blockStyle). */
const ACCENT_HEX: Record<string, string> = {
  navy: '#0e54a1',
  blue: '#1a6dbe',
  teal: '#0f766e',
  green: '#1f9747',
  amber: '#f7952c',
  purple: '#6b21a8',
  red: '#991b1b',
  gray: '#6b7280',
};

/** Default colour cycle when a segment carries no accent. */
const CYCLE = ['#0e54a1', '#0f766e', '#f7952c', '#6b21a8', '#1f9747', '#1a6dbe'];

function colorAt(accent: string | undefined, i: number): string {
  if (accent !== undefined && ACCENT_HEX[accent] !== undefined) return ACCENT_HEX[accent];
  return CYCLE[i % CYCLE.length] ?? '#0e54a1';
}

const WIDTH = 820;
const BAR_H = 34;
const RADIUS = 8;
const TOP = 22;

/** Clamps negatives / non-finite values to 0. */
const pos = (v: number): number => (Number.isFinite(v) && v > 0 ? v : 0);

/** Formats a token count with thousands separators. */
const fmt = (v: number): string => Math.round(v).toLocaleString('en-US');

/**
 * A bar-segment path with independently rounded left / right corners, so the
 * stacked bar keeps its 8px radius at the outer edges only.
 */
function segPath(x: number, w: number, y: number, h: number, rl: number, rr: number): string {
  return (
    `M${x + rl} ${y} H ${x + w - rr}` +
    (rr > 0 ? ` a ${rr} ${rr} 0 0 1 ${rr} ${rr}` : '') +
    ` V ${y + h - rr}` +
    (rr > 0 ? ` a ${rr} ${rr} 0 0 1 -${rr} ${rr}` : '') +
    ` H ${x + rl}` +
    (rl > 0 ? ` a ${rl} ${rl} 0 0 1 -${rl} -${rl}` : '') +
    ` V ${y + rl}` +
    (rl > 0 ? ` a ${rl} ${rl} 0 0 1 ${rl} -${rl}` : '') +
    ` Z`
  );
}

export function renderContext(data: ContextData): string {
  const unit = data.unit ?? 'tokens';
  const window = pos(data.window);
  const segments = data.segments.filter((seg: Segment) => pos(seg.tokens) > 0);
  const sum = segments.reduce((acc, seg) => acc + pos(seg.tokens), 0);
  const over = window > 0 && sum > window;
  const free = window > 0 && sum < window ? window - sum : 0;
  const scaleMax = Math.max(window, sum, 1);
  const px = (v: number): number => Math.round((WIDTH * v) / scaleMax);

  const height = TOP + BAR_H + 8;
  let s = `<svg viewBox="0 0 ${WIDTH} ${height}" width="${WIDTH}" height="${height}" role="img"><title>Context window</title>`;

  // Window summary, top-right.
  s += `<text x="${WIDTH}" y="${TOP - 8}" text-anchor="end" class="ctx-window-label">window: ${escapeHtml(fmt(window))} ${escapeHtml(unit)}</text>`;

  // Stacked segments.
  let running = 0;
  segments.forEach((seg, i) => {
    const v = pos(seg.tokens);
    const x = px(running);
    const w = Math.max(px(running + v) - x, 2);
    const first = i === 0;
    const last = i === segments.length - 1 && free === 0;
    s += `<path d="${segPath(x, w, TOP, BAR_H, first ? RADIUS : 0, last ? RADIUS : 0)}" fill="${colorAt(seg.accent, i)}" fill-opacity="0.9"/>`;
    const cx = x + Math.round(w / 2);
    if (w > 90) {
      s += `<text x="${cx}" y="${TOP + 21}" text-anchor="middle" class="ctx-seg-label">${escapeHtml(seg.label)}</text>`;
    } else if (w >= 18) {
      s += `<text x="${cx}" y="${TOP + 21}" text-anchor="middle" class="ctx-seg-label">${i + 1}</text>`;
    }
    running += v;
  });

  // Free space (dim) — only when the segments leave room.
  if (free > 0) {
    const x = px(sum);
    const w = Math.max(WIDTH - x, 2);
    s += `<path d="${segPath(x, w, TOP, BAR_H, segments.length === 0 ? RADIUS : 0, RADIUS)}" fill="var(--light-gray)" stroke="var(--rule)" stroke-width="1"/>`;
    if (w >= 90) {
      s += `<text x="${x + Math.round(w / 2)}" y="${TOP + 21}" text-anchor="middle" class="ctx-free-label">free (${escapeHtml(fmt(free))})</text>`;
    }
  }

  // Over budget: negative overlay past a dashed window boundary + a chip.
  if (over) {
    const bx = px(window);
    const ow = Math.max(WIDTH - bx, 2);
    s += `<path d="${segPath(bx, ow, TOP, BAR_H, 0, RADIUS)}" fill="var(--negative)" fill-opacity="0.9"/>`;
    if (ow >= 70) {
      s += `<text x="${bx + Math.round(ow / 2)}" y="${TOP + 21}" text-anchor="middle" class="ctx-seg-label">+${escapeHtml(fmt(sum - window))}</text>`;
    }
    s += `<line x1="${bx}" y1="${TOP - 6}" x2="${bx}" y2="${TOP + BAR_H + 5}" class="ctx-boundary"/>`;
    const chipLabel = 'over budget';
    const chipW = 20 + chipLabel.length * 6;
    const chipX = Math.min(bx - Math.round(chipW / 2), WIDTH - chipW - 160);
    s += `<rect x="${chipX}" y="${TOP - 20}" width="${chipW}" height="16" rx="8" class="ctx-chip-bg"/>`;
    s += `<text x="${chipX + Math.round(chipW / 2)}" y="${TOP - 8.5}" text-anchor="middle" class="ctx-chip">${chipLabel}</text>`;
  }

  s += `</svg>`;

  // Legend — one row per segment: numbered dot, label, tokens · %, desc.
  const rows = segments
    .map((seg, i) => {
      const v = pos(seg.tokens);
      const pct = window > 0 ? Math.round((v / window) * 100) : 0;
      const desc =
        seg.desc !== undefined && seg.desc.length > 0
          ? `<span class="ctx-note">${escapeHtml(seg.desc)}</span>`
          : '';
      return (
        `<div class="ctx-row">` +
        `<span class="ctx-dot" style="background:${colorAt(seg.accent, i)}"></span>` +
        `<span class="ctx-idx">${i + 1}</span>` +
        `<span class="ctx-label">${escapeHtml(seg.label)}</span>` +
        `<span class="ctx-num">${escapeHtml(fmt(v))} ${escapeHtml(unit)} · ${pct}%</span>` +
        desc +
        `</div>`
      );
    })
    .join('');
  const legend = rows.length > 0 ? `<div class="ctx-legend">${rows}</div>` : '';

  return diagramFrame(
    {
      tag: 'CONTEXT',
      tagBg: '#7c3aed',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
    },
    s + legend,
  );
}
