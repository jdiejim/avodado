/**
 * Renders a swimlane diagram — horizontal lanes per role with labelled steps
 * in column positions, plus orthogonal links between steps.
 *
 * Skin (`DESIGN.md`): lanes are paper bands with hairline separators and a
 * `paper-2` label column; a step is a paper card with an ink outline whose
 * kind travels through shape and chip — `start` / `end` are stadiums (`start`
 * on the inactive fill), `decision` and `wait` carry an eyebrow chip, `wait`
 * on the inactive fill. Links are `muted` arrows.
 *
 * Accent rule: none. The schema marks no owning lane or focal step, so the
 * swimlane spends no colour.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { edgeLanes, entryPortOffsets, ortho } from '../svg/ortho.js';
import { wrapText } from '../svg/wrapText.js';
import { edgeLabelLayer, type EdgeLabelPoint } from '../svg/edgeSteps.js';
import { gridMetaAttrs, nodeCellAttrs } from '../svg/gridMeta.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';

type Kind = 'action' | 'decision' | 'start' | 'end' | 'wait';

const CHIP: Record<Kind, string> = { action: '', decision: 'DECISION', start: '', end: '', wait: 'WAIT' };

export function renderSwimlane(data: BlockDataMap['swimlane']): string {
  const lanes = data.lanes ?? [];
  const steps = data.steps ?? [];
  const links = data.links ?? [];
  const labelW = 132;
  const padX = 18;
  const padTop = 24;
  const padBot = 20;
  const colW = 168;
  const gapCol = 34;
  const boxW = 150;
  // Long step labels wrap to a third line (instead of silently dropping the
  // tail); boxes and lanes grow uniformly so nothing overlaps.
  const stepLines = steps.map((st) => wrapText(st.label, 18, 3));
  const maxLines = Math.max(1, ...stepLines.map((ls) => ls.length));
  const boxH = 52 + Math.max(0, maxLines - 2) * 14;
  const laneH = 92 + Math.max(0, maxLines - 2) * 14;
  const cols = Math.max(1, ...steps.map((s) => s.col));
  const xCol = (c: number): number => labelW + padX + (c - 1) * (colW + gapCol);
  const yLane = (l: number): number => padTop + l * laneH;
  const rectFor = (s: { col: number; lane: number }): {
    x: number;
    y: number;
    w: number;
    h: number;
  } => ({
    x: xCol(s.col) + (colW - boxW) / 2,
    y: yLane(s.lane) + (laneH - boxH) / 2,
    w: boxW,
    h: boxH,
  });
  const byId = new Map(steps.map((s) => [s.id, s]));
  const width = labelW + padX * 2 + cols * colW + (cols - 1) * gapCol;
  const height = padTop + lanes.length * laneH + padBot;

  // Grid metadata for editors (Avodado Studio drag-to-move / drag-to-connect):
  // the step grid is labelW-offset columns × lanes-as-rows, so the left pad
  // includes the lane-label column and the row pitch is the lane height. Each
  // step's data-row below is its 1-based lane (`lane + 1`) — editors work in
  // row space and write back `lane = row - 1`.
  const gridMeta = gridMetaAttrs({
    quick: false, // col/lane are required — swimlanes are always placed
    cols,
    rows: Math.max(1, lanes.length),
    cellW: colW,
    cellH: laneH,
    gapX: gapCol,
    gapY: 0,
    padX: labelW + padX,
    padTop,
  });
  let s = `<svg viewBox="0 0 ${width} ${height}" role="img"${gridMeta}><title>Swimlane</title>`;

  s += `<g${bl('lanes')}>`;
  for (let i = 0; i < lanes.length; i++) {
    const L = lanes[i];
    if (L === undefined) continue;
    // Wrap the lane label (≤3 lines) so it never spills out of the label column.
    const llines = wrapText(L.label, Math.max(8, Math.floor((labelW - 28) / 7)), 3);
    const ltext = llines
      .map(
        (ln, j) =>
          `<text x="${padX + 14}" y="${(yLane(i) + laneH / 2 + 4 - (llines.length - 1) * 8 + j * 16).toFixed(1)}" class="t-name">${escapeHtml(ln)}</text>`,
      )
      .join('');
    s +=
      `<g${bp(`lanes.${i}`)}>` +
      `<rect x="${padX}" y="${yLane(i)}" width="${width - padX * 2}" height="${laneH}" fill="var(--paper)" stroke="var(--rule-solid)" stroke-width="1"/>` +
      `<rect x="${padX}" y="${yLane(i)}" width="${labelW}" height="${laneH}" fill="var(--paper-2)" stroke="var(--rule-solid)" stroke-width="1"/>` +
      ltext +
      `</g>`;
  }
  s += `</g>`; // close the lanes list container

  const pending: EdgeLabelPoint[] = [];
  const linkLanes = edgeLanes(links);
  const linkEntries = entryPortOffsets(links, (id) => {
    const n = byId.get(id);
    return n !== undefined ? rectFor(n) : undefined;
  });
  s += `<g${bl('links')}>`;
  links.forEach((lk, li) => {
    const A = byId.get(lk.from);
    const B = byId.get(lk.to);
    if (!A || !B) return;
    const p = ortho(rectFor(A), rectFor(B), linkLanes[li] ?? 0, linkEntries[li] ?? 0);
    s += `<path d="${p.d}" fill="none" stroke="var(--muted)" stroke-width="1.5" marker-end="url(#skArrow)"${bp(`links.${li}`)}/>`;
    pending.push({ lx: p.lx, ly: p.ly, ...(lk.label !== undefined ? { label: lk.label } : {}), path: `links.${li}` });
  });
  s += `</g>`; // close the links list container (editors add via its chip)

  const kindsUsed = new Set<Kind>();
  s += `<g${bl('steps')}>`;
  steps.forEach((st, si) => {
    const r = rectFor(st);
    const kind: Kind = st.kind ?? 'action';
    kindsUsed.add(kind);
    const inactive = kind === 'start' || kind === 'wait';
    const fill = inactive ? 'var(--paper-2)' : 'var(--paper)';
    const stroke = inactive ? 'var(--rule-solid)' : 'var(--ink)';
    const sw = inactive ? 1 : 1.5;
    const rx = kind === 'start' || kind === 'end' ? r.h / 2 : 4;
    const chip = CHIP[kind];
    const chipSvg =
      chip !== ''
        ? `<text x="${r.x + 10}" y="${r.y + 12}" class="t-eyebrow${inactive ? ' c-muted' : ''}">${chip}</text>`
        : '';
    // A chip takes the top of the card, so the name block shifts down a step.
    const dy = chip !== '' ? 5 : 0;
    const lines = stepLines[si] ?? [];
    const texts = lines
      .map(
        (ln, j) =>
          `<text x="${r.x + r.w / 2}" y="${r.y + r.h / 2 + 4 + dy - (lines.length - 1) * 7 + j * 14}" class="t-name" text-anchor="middle">${escapeHtml(ln)}</text>`,
      )
      .join('');
    s +=
      `<g${bp(`steps.${si}`)}${nodeCellAttrs(st.col, st.lane + 1)}>` +
      `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>` +
      chipSvg +
      texts +
      `</g>`;
  });
  s += `</g>`; // close the steps list container

  const { overlay, legend: stepLegend } = edgeLabelLayer(pending, steps.map((st) => rectFor(st)), { skin: true });
  s += overlay; // labels on top, never crossed by a line
  s += `</svg>`;

  const items: LegendItem[] = [];
  if (kindsUsed.has('start')) items.push({ swatch: 'node-stadium-fill2', label: 'start' });
  if (kindsUsed.has('action')) items.push({ swatch: 'node', label: 'step' });
  if (kindsUsed.has('decision')) items.push({ swatch: 'chip', chip: 'DECISION', label: 'decision' });
  if (kindsUsed.has('wait')) items.push({ swatch: 'chip', chip: 'WAIT', label: 'waiting' });
  if (kindsUsed.has('end')) items.push({ swatch: 'node-stadium', label: 'end' });
  if (links.length > 0) items.push({ swatch: 'edge', label: 'next' });
  const legend = renderLegend(items);

  return diagramFrame(
    {
      tag: 'LANES',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legend.length > 0 ? { legendHtml: legend } : {}),
    },
    s + stepLegend,
  );
}
