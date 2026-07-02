/**
 * Renders a `funnel` block — a conversion funnel in pure SVG, inside the
 * diagram frame (tag FUNNEL). Stages stack vertically as centered trapezoid
 * bands whose width is proportional to `value / maxValue` (with a 28% floor so
 * labels always fit). Band colours cycle the bright diagram palette. Between
 * bands, a small mono chip shows the stage-to-stage conversion (`↓ NN%`) —
 * honestly above 100% when a stage grows, and 0% when the previous stage is 0.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { diagramFrame } from './frame.js';

type FunnelData = BlockDataMap['funnel'];
type Stage = FunnelData['stages'][number];

/** Bright diagram palette (matches chart's cycle order for the funnel). */
const CYCLE = ['#0e54a1', '#1a6dbe', '#0f766e', '#1f9747', '#6b21a8'];

const WIDTH = 560;
const BAND_H = 54;
const GAP = 10; // gap between a band and the conversion-chip zone
const CHIP_H = 18;
const MIN_FRAC = 0.28; // minimum band width so labels fit

/** Clamps negatives / non-finite values to 0. */
const pos = (v: number): number => (Number.isFinite(v) && v > 0 ? v : 0);

/** Formats a value with thousands separators plus the optional unit suffix. */
function fmt(v: number, unit: string | undefined): string {
  const n = Math.round(v * 100) / 100;
  return `${n.toLocaleString('en-US')}${unit !== undefined ? ` ${unit}` : ''}`;
}

/** Band width in px for a value, floored at MIN_FRAC of the drawable width. */
function widthFor(value: number, maxValue: number): number {
  const frac = maxValue > 0 ? pos(value) / maxValue : 0;
  return Math.round(WIDTH * Math.max(frac, MIN_FRAC));
}

function renderBand(stage: Stage, nextStage: Stage | undefined, i: number, maxValue: number, y: number, unit: string | undefined): string {
  const cx = WIDTH / 2;
  const topW = widthFor(stage.value, maxValue);
  const botW = nextStage !== undefined ? widthFor(nextStage.value, maxValue) : topW;
  const color = CYCLE[i % CYCLE.length] ?? '#0e54a1';
  const pts = [
    `${cx - topW / 2},${y}`,
    `${cx + topW / 2},${y}`,
    `${cx + botW / 2},${y + BAND_H}`,
    `${cx - botW / 2},${y + BAND_H}`,
  ].join(' ');
  const hasDesc = stage.desc !== undefined && stage.desc.length > 0;
  const labelY = hasDesc ? y + 20 : y + 24;
  const valueY = hasDesc ? y + 35 : y + 40;
  const descText = hasDesc
    ? `<text x="${cx}" y="${y + 47}" class="fn-desc">${escapeHtml(stage.desc ?? '')}</text>`
    : '';
  return (
    `<polygon points="${pts}" fill="${color}" fill-opacity="0.92"/>` +
    `<text x="${cx}" y="${labelY}" class="fn-label">${escapeHtml(stage.label)}</text>` +
    `<text x="${cx}" y="${valueY}" class="fn-value">${escapeHtml(fmt(pos(stage.value), unit))}</text>` +
    descText
  );
}

function renderChip(from: Stage, to: Stage, y: number): string {
  const cx = WIDTH / 2;
  const prev = pos(from.value);
  const next = pos(to.value);
  const pct = prev > 0 ? Math.round((next / prev) * 100) : 0;
  const label = `↓ ${pct}%`;
  const w = 34 + String(pct).length * 7;
  return (
    `<rect x="${cx - w / 2}" y="${y}" width="${w}" height="${CHIP_H}" rx="9" class="fn-chip-bg"/>` +
    `<text x="${cx}" y="${y + 13}" class="fn-chip">${escapeHtml(label)}</text>`
  );
}

export function renderFunnel(data: FunnelData): string {
  const stages = data.stages;
  const maxValue = Math.max(...stages.map((s) => pos(s.value)), 0);
  const stepH = BAND_H + GAP + CHIP_H + GAP;
  const height = stages.length * BAND_H + (stages.length - 1) * (GAP + CHIP_H + GAP);
  let s = `<svg viewBox="0 0 ${WIDTH} ${height}" role="img"><title>Funnel</title>`;
  stages.forEach((stage, i) => {
    const y = i * stepH;
    s += renderBand(stage, stages[i + 1], i, maxValue, y, data.unit);
    const next = stages[i + 1];
    if (next !== undefined) s += renderChip(stage, next, y + BAND_H + GAP);
  });
  s += `</svg>`;
  return diagramFrame(
    {
      tag: 'FUNNEL',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
    },
    s,
  );
}
