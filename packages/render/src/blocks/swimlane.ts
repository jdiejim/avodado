/**
 * Renders a swimlane diagram — horizontal lanes per role with labelled steps
 * in column positions, plus orthogonal links between steps.
 *
 * Placement comes from core (`swimlanePlacements`): a step names its lane by
 * label, id, or index, and its column is either the `col` it carries or its
 * longest-path rank through the links, so the renderer, the Studio canvas,
 * and `avo check` agree on every cell. Optional `phases` band the columns
 * (BPMN milestones) as a header row above the lanes.
 *
 * Skin (`DESIGN.md`): lanes are paper bands with hairline separators and a
 * `paper-2` label column; a step is a paper card with an ink outline whose
 * kind travels through shape and chip — `start` / `end` are stadiums (`start`
 * on the inactive fill), `decision` and `wait` carry an eyebrow chip, `wait`
 * on the inactive fill; a `note` is a mono sub-line under the label. Links
 * are `muted` arrows; `kind: dashed` is the open-headed dashed message flow,
 * `kind: error` is `negative`.
 *
 * Accent rule: author-marked. The one step the author sets `accent: true`
 * on takes the accent outline and tint; the renderer adds none of its own.
 */

import { swimlanePlacements, type BlockDataMap } from '@avodado/core';
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
  const phases = data.phases ?? [];
  const { placements, derived } = swimlanePlacements(data);
  const labelW = 132;
  const padX = 18;
  const padBot = 20;
  const colW = 168;
  const gapCol = 34;
  const boxW = 150;
  // A phase header sits above the lanes; the lanes start below it.
  const phaseH = phases.length > 0 ? 26 : 0;
  const padTop = 24 + phaseH;
  // Long step labels wrap to a third line (instead of silently dropping the
  // tail); boxes and lanes grow uniformly so nothing overlaps. A note adds a
  // mono line under the label.
  const stepLines = steps.map((st) => wrapText(st.label, 18, 3));
  const maxLines = Math.max(1, ...stepLines.map((ls) => ls.length));
  const hasNote = steps.some((st) => st.note !== undefined && st.note !== '');
  const noteH = hasNote ? 12 : 0;
  const boxH = 52 + Math.max(0, maxLines - 2) * 14 + noteH;
  const laneH = 92 + Math.max(0, maxLines - 2) * 14 + noteH;
  const cols = Math.max(1, ...placements.map((p) => p.col), ...phases.map((p) => p.to ?? p.from));
  // An open-ended phase (no `to`) runs to the last column.
  const xCol = (c: number): number => labelW + padX + (c - 1) * (colW + gapCol);
  const yLane = (l: number): number => padTop + l * laneH;
  const rectFor = (p: { col: number; lane: number }): {
    x: number;
    y: number;
    w: number;
    h: number;
  } => ({
    x: xCol(p.col) + (colW - boxW) / 2,
    y: yLane(p.lane) + (laneH - boxH) / 2,
    w: boxW,
    h: boxH,
  });
  const byId = new Map<string, { col: number; lane: number }>();
  steps.forEach((st, i) => {
    const p = placements[i];
    if (p !== undefined && !byId.has(st.id)) byId.set(st.id, p);
  });
  const width = labelW + padX * 2 + cols * colW + (cols - 1) * gapCol;
  const lanesH = Math.max(1, lanes.length) * laneH;
  const height = padTop + lanesH + padBot;

  // Grid metadata for editors (Avodado Studio drag-to-move / drag-to-connect):
  // the step grid is labelW-offset columns × lanes-as-rows, so the left pad
  // includes the lane-label column and the row pitch is the lane height. Each
  // step's data-row below is its 1-based lane (`lane + 1`) — editors work in
  // row space and write back `lane = row - 1`. `quick` says the columns were
  // derived, so the first drag pins every step's `col`.
  const gridMeta = gridMetaAttrs({
    quick: derived,
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

  // Phase bands: a header cell over columns `from`..`to`, and a hairline down
  // through the lanes at each band edge that is not the diagram's own edge.
  if (phases.length > 0) {
    const yTop = padTop - phaseH;
    const yBot = padTop + lanesH;
    s += `<g${bl('phases')}>`;
    phases.forEach((ph, pi) => {
      const from = Math.min(ph.from, cols);
      const to = Math.min(Math.max(ph.to ?? cols, from), cols);
      const x0 = from === 1 ? padX + labelW : xCol(from) - gapCol / 2;
      const x1 = to === cols ? width - padX : xCol(to) + colW + gapCol / 2;
      const seps =
        (from > 1 ? `<line x1="${x0}" y1="${yTop}" x2="${x0}" y2="${yBot}" stroke="var(--rule-solid)" stroke-width="1" stroke-dasharray="4 3"/>` : '') +
        (to < cols ? `<line x1="${x1}" y1="${yTop}" x2="${x1}" y2="${yBot}" stroke="var(--rule-solid)" stroke-width="1" stroke-dasharray="4 3"/>` : '');
      const label = wrapText(ph.label, Math.max(6, Math.floor((x1 - x0 - 16) / 7)), 1)[0] ?? '';
      s +=
        `<g${bp(`phases.${pi}`)}>` +
        `<rect x="${x0}" y="${yTop}" width="${x1 - x0}" height="${phaseH}" fill="var(--paper-2)" stroke="var(--rule-solid)" stroke-width="1"/>` +
        `<text x="${(x0 + x1) / 2}" y="${yTop + phaseH / 2 + 3}" class="t-eyebrow" text-anchor="middle">${escapeHtml(label.toUpperCase())}</text>` +
        seps +
        `</g>`;
    });
    s += `</g>`; // close the phases list container
  }

  const pending: EdgeLabelPoint[] = [];
  const linkLanes = edgeLanes(links);
  const linkEntries = entryPortOffsets(links, (id) => {
    const n = byId.get(id);
    return n !== undefined ? rectFor(n) : undefined;
  });
  const used = { plain: false, dashed: false, error: false };
  s += `<g${bl('links')}>`;
  links.forEach((lk, li) => {
    const A = byId.get(lk.from);
    const B = byId.get(lk.to);
    if (!A || !B) return;
    const p = ortho(rectFor(A), rectFor(B), linkLanes[li] ?? 0, linkEntries[li] ?? 0);
    const isErr = lk.kind === 'error';
    const isDashed = lk.kind === 'dashed';
    const stroke = isErr ? 'var(--negative)' : 'var(--muted)';
    const marker = isErr ? 'skErr' : isDashed ? 'skOpen' : 'skArrow';
    const dash = isDashed ? ' stroke-dasharray="5 4"' : '';
    if (isErr) used.error = true;
    else if (isDashed) used.dashed = true;
    else used.plain = true;
    s += `<path d="${p.d}" fill="none" stroke="${stroke}" stroke-width="1.5"${dash} marker-end="url(#${marker})"${bp(`links.${li}`)}/>`;
    pending.push({
      lx: p.lx,
      ly: p.ly,
      ...(lk.label !== undefined ? { label: lk.label } : {}),
      path: `links.${li}`,
      ...(isErr ? { err: true } : {}),
    });
  });
  s += `</g>`; // close the links list container (editors add via its chip)

  const kindsUsed = new Set<Kind>();
  let accented = false;
  s += `<g${bl('steps')}>`;
  steps.forEach((st, si) => {
    const place = placements[si] ?? { col: 1, lane: 0 };
    const r = rectFor(place);
    const kind: Kind = st.kind ?? 'action';
    kindsUsed.add(kind);
    const accent = st.accent === true;
    if (accent) accented = true;
    const inactive = !accent && (kind === 'start' || kind === 'wait');
    const fill = accent ? 'var(--accent-tint)' : inactive ? 'var(--paper-2)' : 'var(--paper)';
    const stroke = accent ? 'var(--accent)' : inactive ? 'var(--rule-solid)' : 'var(--ink)';
    const sw = inactive ? 1 : 1.5;
    const rx = kind === 'start' || kind === 'end' ? r.h / 2 : 4;
    const chip = CHIP[kind];
    const chipSvg =
      chip !== ''
        ? `<text x="${r.x + 10}" y="${r.y + 12}" class="t-eyebrow${accent ? ' c-accent' : inactive ? ' c-muted' : ''}">${chip}</text>`
        : '';
    // A chip takes the top of the card, so the name block shifts down a step;
    // a note takes the bottom, so it shifts back up.
    const note = st.note !== undefined && st.note !== '' ? st.note : undefined;
    const dy = (chip !== '' ? 5 : 0) - (note !== undefined ? 6 : 0);
    const lines = stepLines[si] ?? [];
    const texts = lines
      .map(
        (ln, j) =>
          `<text x="${r.x + r.w / 2}" y="${r.y + r.h / 2 + 4 + dy - (lines.length - 1) * 7 + j * 14}" class="t-name" text-anchor="middle">${escapeHtml(ln)}</text>`,
      )
      .join('');
    const noteSvg =
      note !== undefined
        ? `<text x="${r.x + r.w / 2}" y="${r.y + r.h - 9}" class="t-sub" text-anchor="middle">${escapeHtml(wrapText(note, 24, 1)[0] ?? '')}</text>`
        : '';
    s +=
      `<g${bp(`steps.${si}`)}${nodeCellAttrs(place.col, place.lane + 1)}>` +
      `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>` +
      chipSvg +
      texts +
      noteSvg +
      `</g>`;
  });
  s += `</g>`; // close the steps list container

  const { overlay, legend: stepLegend } = edgeLabelLayer(pending, placements.map((p) => rectFor(p)), { skin: true });
  s += overlay; // labels on top, never crossed by a line
  s += `</svg>`;

  const items: LegendItem[] = [];
  if (kindsUsed.has('start')) items.push({ swatch: 'node-stadium-fill2', label: 'start' });
  if (kindsUsed.has('action')) items.push({ swatch: 'node', label: 'step' });
  if (kindsUsed.has('decision')) items.push({ swatch: 'chip', chip: 'DECISION', label: 'decision' });
  if (kindsUsed.has('wait')) items.push({ swatch: 'chip', chip: 'WAIT', label: 'waiting' });
  if (kindsUsed.has('end')) items.push({ swatch: 'node-stadium', label: 'end' });
  if (accented) items.push({ swatch: 'node-accent', label: 'focal step' });
  if (used.plain) items.push({ swatch: 'edge', label: 'next' });
  if (used.dashed) items.push({ swatch: 'edge-dashed', label: 'message' });
  if (used.error) items.push({ swatch: 'edge-error', label: 'error path' });
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
