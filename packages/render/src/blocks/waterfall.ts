/**
 * Renders a `waterfall` block — a budget cascade (latency budgets, cost
 * breakdowns) in pure SVG, inside the diagram frame (tag BUDGET). Horizontal
 * cascading bars: each bar starts at the running total of the previous items
 * and spans its value; a final full-width TOTAL bar runs from 0 in navy. An
 * optional `budget` draws a dashed cap line — any bar segment past it tints
 * negative, and the total row gets an over / under / on-budget chip.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { diagramFrame } from './frame.js';

type WaterfallData = BlockDataMap['waterfall'];
type Item = WaterfallData['items'][number];

/** Bright diagram palette (same cycle order as chart / funnel). */
const CYCLE = ['#0e54a1', '#0f766e', '#f7952c', '#6b21a8', '#1f9747', '#1a6dbe'];

const WIDTH = 720;
const LABEL_W = 150; // fixed left label column
const BAR_H = 34;
const GAP = 14;

/** Clamps negatives / non-finite values to 0. */
const pos = (v: number): number => (Number.isFinite(v) && v > 0 ? v : 0);

/** Formats a value with the unit suffix (default "ms"), trimming float noise. */
function fmt(v: number, unit: string | undefined): string {
  const n = Math.round(v * 100) / 100;
  return `${n.toLocaleString('en-US')} ${unit ?? 'ms'}`;
}

/** Max characters that fit the fixed label column at 13px. */
const LABEL_CHARS = 23;

/** Truncates a label (with optional desc) to fit the left column. */
function labelFor(item: Item): string {
  const full =
    item.desc !== undefined && item.desc.length > 0 ? `${item.label} — ${item.desc}` : item.label;
  if (full.length <= LABEL_CHARS) return full;
  if (item.label.length <= LABEL_CHARS) return item.label;
  return `${item.label.slice(0, LABEL_CHARS - 1)}…`;
}

export function renderWaterfall(data: WaterfallData): string {
  const items = data.items ?? [];
  const unit = data.unit;
  const total = items.reduce((acc, it) => acc + pos(it.value), 0);
  const budget = data.budget !== undefined && data.budget > 0 ? data.budget : undefined;
  const hasBudget = budget !== undefined;
  const topPad = hasBudget ? 22 : 6;
  const rows = items.length + (items.length > 0 ? 1 : 0); // items + TOTAL
  const height = topPad + rows * (BAR_H + GAP) - (rows > 0 ? GAP : 0) + 6;
  const x0 = LABEL_W + 10;
  // Right margin: room for the value text, plus the over/under chip when a
  // budget is set.
  const valueW = hasBudget ? 176 : 74;
  const plotW = WIDTH - x0 - valueW;
  // A budget far beyond the cascade would crush the bars into slivers: scale to
  // the bars instead and annotate the off-scale budget (the under-chip carries
  // the headroom). The in-plot cap line only draws when it's within ~1.4× total.
  const budgetOnScale = hasBudget && total > 0 && budget <= total * 1.4;
  const scaleMax = budgetOnScale ? Math.max(total, budget) : total > 0 ? total : (budget ?? 0);
  const px = (v: number): number => (scaleMax > 0 ? Math.round((plotW * v) / scaleMax) : 0);

  let s = `<svg viewBox="0 0 ${WIDTH} ${Math.max(height, 40)}" role="img"><title>Budget waterfall</title>`;

  // Cascading item bars.
  let running = 0;
  items.forEach((it: Item, i) => {
    const v = pos(it.value);
    const y = topPad + i * (BAR_H + GAP);
    const bx = x0 + px(running);
    const bw = Math.max(px(v), v > 0 ? 2 : 0);
    const color = CYCLE[i % CYCLE.length] ?? '#0e54a1';
    s += `<text x="0" y="${y + 22}" class="wfl-label">${escapeHtml(labelFor(it))}</text>`;
    s += `<rect x="${bx}" y="${y}" width="${bw}" height="${BAR_H}" rx="3" fill="${color}" fill-opacity="0.9"/>`;
    // Segment past the budget line tints negative.
    if (hasBudget && running + v > budget) {
      const overStart = Math.max(running, budget);
      const ox = x0 + px(overStart);
      const ow = Math.max(px(running + v) - px(overStart), 2);
      s += `<rect x="${ox}" y="${y}" width="${ow}" height="${BAR_H}" rx="3" fill="var(--negative)" fill-opacity="0.9"/>`;
    }
    s += `<text x="${bx + bw + 6}" y="${y + 22}" class="wfl-value">${escapeHtml(fmt(v, unit))}</text>`;
    running += v;
  });

  // Full-width TOTAL bar from 0.
  if (items.length > 0) {
    const y = topPad + items.length * (BAR_H + GAP);
    const tw = Math.max(px(total), total > 0 ? 2 : 0);
    s += `<rect x="${x0}" y="${y}" width="${tw}" height="${BAR_H}" rx="3" fill="var(--navy)"/>`;
    s += `<text x="${x0 + 10}" y="${y + 22}" class="wfl-total-label">TOTAL</text>`;
    s += `<text x="${x0 + tw + 6}" y="${y + 22}" class="wfl-value">${escapeHtml(fmt(total, unit))}</text>`;
    // Over / under / on-budget chip after the total value.
    if (hasBudget) {
      const diff = Math.round((total - budget) * 100) / 100;
      const over = diff > 0;
      const label = diff === 0 ? 'on budget' : over ? `${fmt(diff, unit)} over` : `${fmt(-diff, unit)} under`;
      const cw = 20 + label.length * 6;
      const cx = x0 + tw + 6 + Math.round(fmt(total, unit).length * 6.6) + 8;
      const tone = over ? 'wfl-chip-over' : 'wfl-chip-under';
      s += `<rect x="${cx}" y="${y + 4}" width="${cw}" height="${BAR_H - 8}" rx="9" class="wfl-chip-bg ${tone}"/>`;
      s += `<text x="${cx + Math.round(cw / 2)}" y="${y + 22}" class="wfl-chip ${tone}">${escapeHtml(label)}</text>`;
    }
  }

  // Dashed budget cap line + label (drawn last so it sits above the bars).
  if (hasBudget && budgetOnScale) {
    const lx = x0 + px(budget);
    s += `<line x1="${lx}" y1="${topPad - 6}" x2="${lx}" y2="${Math.max(height, 40) - 4}" class="wfl-budget-line"/>`;
    // Flip the label to the left of the line when it would overflow the frame.
    const flip = lx > WIDTH - 130;
    s += `<text x="${flip ? lx - 6 : lx + 6}" y="${topPad - 8}" class="wfl-budget-label"${flip ? ' text-anchor="end"' : ''}>budget: ${escapeHtml(fmt(budget, unit))}</text>`;
  } else if (hasBudget) {
    // Off-scale budget: annotate instead of drawing an unreachable line.
    s += `<text x="${WIDTH - 4}" y="${topPad - 8}" class="wfl-budget-label" text-anchor="end">budget: ${escapeHtml(fmt(budget, unit))} — beyond scale →</text>`;
  }

  s += `</svg>`;
  return diagramFrame(
    {
      tag: 'BUDGET',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
    },
    s,
  );
}
