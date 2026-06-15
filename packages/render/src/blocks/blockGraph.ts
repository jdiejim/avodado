/**
 * Block-graph rendering — backs `block`, `infra`, `event`, `ddd`, and
 * `network`. Two layout modes share the same data shape:
 *
 * - **Layered:** if `spec.layers` is present, nodes are placed in horizontal
 *   bands by their `layer` index.
 * - **Grid:** otherwise nodes use `(col, row, w?)` placements, optionally
 *   wrapped in dashed group boxes.
 *
 * Ported from doc-studio.jsx `GridBlock` + `LayeredBlock` + `BlockDiagram`.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { ortho } from '../svg/ortho.js';
import { edgePill } from '../svg/edgePill.js';
import { blockStyle, nodeGlyph, GEDGE } from '../svg/blockStyle.js';
import { rectRoundRight } from '../svg/shapes.js';
import { wrapText } from '../svg/wrapText.js';
import { safeColor } from '../sanitize.js';
import { diagramFrame } from './frame.js';

type Data = BlockDataMap['block'];
type Group = NonNullable<Data['groups']>[number];
type Node = NonNullable<Data['nodes']>[number];

interface FrameOpts {
  readonly tag: string;
  readonly tagBg?: string;
  readonly tagClass?: string;
}

const FALLBACK_EDGE = {
  stroke: '#1a1a2e',
  sw: 1.4,
  dash: '',
  marker: 'gArrow',
  err: false,
} as const;

/**
 * Renders a node's `name` (wrapped to ≤2 lines) and optional `tech` (≤2 lines),
 * vertically centred in the box so long labels never overflow or overlap.
 */
function nodeLabels(opts: {
  readonly name: string;
  readonly tech?: string;
  readonly x: number;
  readonly boxY: number;
  readonly boxH: number;
  readonly textW: number;
  readonly nameFill: string;
  readonly techFill: string;
}): string {
  const nameLineH = 15;
  const techLineH = 12;
  const gap = 4;
  const nameLines = wrapText(opts.name, Math.max(6, Math.floor(opts.textW / 6.6)), 2);
  const techLines =
    opts.tech !== undefined ? wrapText(opts.tech, Math.max(6, Math.floor(opts.textW / 5.8)), 2) : [];
  const blockH = nameLines.length * nameLineH + (techLines.length > 0 ? gap + techLines.length * techLineH : 0);
  let y = opts.boxY + (opts.boxH - blockH) / 2 + nameLineH - 4;
  let s = '';
  for (const ln of nameLines) {
    s += `<text x="${opts.x}" y="${y.toFixed(1)}" class="blk-name" fill="${opts.nameFill}">${escapeHtml(ln)}</text>`;
    y += nameLineH;
  }
  if (techLines.length > 0) {
    y += gap - nameLineH + techLineH;
    for (const ln of techLines) {
      s += `<text x="${opts.x}" y="${y.toFixed(1)}" class="blk-tech" fill="${opts.techFill}">${escapeHtml(ln)}</text>`;
      y += techLineH;
    }
  }
  return s;
}

function renderGrid(data: Data): string {
  const groups = data.groups ?? [];
  const nodes = data.nodes ?? [];
  const edges = data.edges ?? [];
  const cellW = 178;
  const cellH = 88;
  const gapX = 64;
  const gapY = 64;
  const padX = 38;
  const padTop = 52;
  const padBot = 36;
  const cols = Math.max(
    1,
    ...nodes.map((n) => (n.col ?? 1) + ((n.w ?? 1) - 1)),
    ...groups.map((g) => g.col + (g.cols ?? 1) - 1),
  );
  const rows = Math.max(
    1,
    ...nodes.map((n) => n.row ?? 1),
    ...groups.map((g) => g.row + (g.rows ?? 1) - 1),
  );
  const xOf = (c: number): number => padX + (c - 1) * (cellW + gapX);
  const yOf = (r: number): number => padTop + (r - 1) * (cellH + gapY);
  const rectFor = (n: Node): { x: number; y: number; w: number; h: number } => ({
    x: xOf(n.col ?? 1),
    y: yOf(n.row ?? 1),
    w: (n.w ?? 1) * cellW + ((n.w ?? 1) - 1) * gapX,
    h: cellH,
  });
  const groupRect = (g: Group): { x: number; y: number; w: number; h: number } => ({
    x: xOf(g.col) - 28,
    y: yOf(g.row) - 38,
    w: (g.cols ?? 1) * cellW + ((g.cols ?? 1) - 1) * gapX + 56,
    h: (g.rows ?? 1) * cellH + ((g.rows ?? 1) - 1) * gapY + 66,
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const width = padX * 2 + cols * cellW + (cols - 1) * gapX;
  const height = padTop + rows * cellH + (rows - 1) * gapY + padBot;

  // Largest groups first so smaller ones layer on top.
  const sortedGroups = [...groups].sort(
    (a, b) => (b.cols ?? 1) * (b.rows ?? 1) - (a.cols ?? 1) * (a.rows ?? 1),
  );

  let s = `<svg viewBox="0 0 ${width} ${height}" role="img"><title>Block diagram</title>`;

  for (const g of sortedGroups) {
    const r = groupRect(g);
    const col = safeColor(g.color, '#475569');
    // Elegant outline zone (fe/be style): no background fill, a dashed boundary,
    // and a plain label in the top-left — no solid label badge.
    s +=
      `<g>` +
      `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="12" fill="none" stroke="${col}" stroke-opacity="0.6" stroke-width="1.3" stroke-dasharray="7 5"/>` +
      `<text x="${r.x + 16}" y="${r.y + 19}" class="grp-label" fill="${col}">${escapeHtml(g.label)}</text>` +
      `</g>`;
  }

  const labels: string[] = [];
  for (const e of edges) {
    const A = byId.get(e.from);
    const B = byId.get(e.to);
    if (!A || !B) continue;
    const p = ortho(rectFor(A), rectFor(B));
    const st = GEDGE[e.kind ?? 'solid'] ?? GEDGE['solid'] ?? FALLBACK_EDGE;
    s += `<path d="${p.d}" fill="none" stroke="${st.stroke}" stroke-width="${st.sw}" stroke-dasharray="${st.dash}" marker-end="url(#${st.marker})"/>`;
    labels.push(edgePill(p, e.label, st.err));
  }

  for (const n of nodes) {
    const r = rectFor(n);
    const st = blockStyle(n.kind);
    const gl = nodeGlyph(n.kind, r.x + 14, r.y + r.h / 2 - 8, st.accent);
    const nx = gl.length > 0 ? r.x + 40 : r.x + 16;
    s +=
      `<g filter="url(#gshadow)">` +
      `<path d="${rectRoundRight(r.x, r.y, r.w, r.h, 9)}" fill="${st.fill}" stroke="${st.accent}" stroke-width="1.2"/>` +
      `<rect x="${r.x}" y="${r.y}" width="5" height="${r.h}" fill="${st.accent}"/>` +
      gl +
      nodeLabels({
        name: n.name,
        ...(n.tech !== undefined ? { tech: n.tech } : {}),
        x: nx,
        boxY: r.y,
        boxH: r.h,
        textW: r.x + r.w - nx - 14,
        nameFill: st.text,
        techFill: st.accent,
      }) +
      `</g>`;
  }

  s += labels.join(''); // labels on top, never crossed by a line
  s += `</svg>`;
  return s;
}

function renderLayered(data: Data): string {
  const layers = data.layers ?? [];
  const nodes = data.nodes ?? [];
  const edges = data.edges ?? [];
  const byLayer: Node[][] = layers.map((_, i) =>
    nodes.filter((n) => (n.layer ?? 0) === i),
  );
  const outerPad = 28;
  const titleH = data.systemLabel !== undefined ? 32 : 16;
  const labelW = 132;
  const bandPadX = 16;
  const bandPadY = 14;
  const bandGap = 12;
  const nodeW = 158;
  const nodeH = 64;
  const nodeGap = 22;
  const rowW = (c: number): number => c * nodeW + (c - 1) * nodeGap;
  const contentW = Math.max(220, ...byLayer.map((a) => rowW(Math.max(a.length, 1))));
  const bandInnerW = contentW + bandPadX * 2;
  const bandH = nodeH + bandPadY * 2;
  const innerX = outerPad + 14;
  const contentX = innerX + labelW;
  const width = contentX + bandInnerW + 14 + outerPad;
  const top = outerPad + titleH;
  const bandY = (i: number): number => top + i * (bandH + bandGap);
  const height = bandY(layers.length) - bandGap + outerPad;

  const rects = new Map<string, { x: number; y: number; w: number; h: number }>();
  byLayer.forEach((arr, i) => {
    const startX = contentX + (bandInnerW - rowW(arr.length)) / 2;
    arr.forEach((n, j) => {
      rects.set(n.id, {
        x: startX + j * (nodeW + nodeGap),
        y: bandY(i) + bandPadY,
        w: nodeW,
        h: nodeH,
      });
    });
  });

  let s =
    `<svg viewBox="0 0 ${width} ${height}" role="img"><title>Layered architecture</title>` +
    `<rect x="${outerPad}" y="${outerPad}" width="${width - outerPad * 2}" height="${height - outerPad * 2}" rx="12" fill="none" stroke="var(--navy)" stroke-width="1.5"/>`;
  if (data.systemLabel !== undefined) {
    s += `<text x="${outerPad + 14}" y="${outerPad + 18}" class="grp-label" fill="var(--navy)">${escapeHtml(data.systemLabel)}</text>`;
  }
  for (let i = 0; i < layers.length; i++) {
    const L = layers[i];
    if (L === undefined) continue;
    // Wrap the band label (≤3 lines) so long names stay inside the label column.
    const lblLines = wrapText(L.label, Math.max(8, Math.floor((labelW - 24) / 6.4)), 3);
    const lblText = lblLines
      .map(
        (ln, j) =>
          `<text x="${innerX + 14}" y="${(bandY(i) + bandH / 2 + 4 - (lblLines.length - 1) * 7 + j * 14).toFixed(1)}" class="layer-label">${escapeHtml(ln)}</text>`,
      )
      .join('');
    s +=
      `<g>` +
      `<rect x="${innerX}" y="${bandY(i)}" width="${labelW + bandInnerW}" height="${bandH}" rx="6" fill="var(--light-gray)" stroke="var(--rule)"/>` +
      `<rect x="${innerX}" y="${bandY(i)}" width="${labelW}" height="${bandH}" rx="6" fill="var(--navy)"/>` +
      `<rect x="${innerX + labelW - 8}" y="${bandY(i)}" width="8" height="${bandH}" fill="var(--navy)"/>` +
      lblText +
      `</g>`;
  }

  const labels: string[] = [];
  for (const e of edges) {
    const A = rects.get(e.from);
    const B = rects.get(e.to);
    if (!A || !B) continue;
    const p = ortho(A, B);
    const st = GEDGE[e.kind ?? 'solid'] ?? GEDGE['solid'] ?? FALLBACK_EDGE;
    s += `<path d="${p.d}" fill="none" stroke="${st.stroke}" stroke-width="${st.sw}" stroke-dasharray="${st.dash}" marker-end="url(#${st.marker})"/>`;
    labels.push(edgePill(p, e.label, st.err));
  }

  for (const n of nodes) {
    const r = rects.get(n.id);
    if (r === undefined) continue;
    const st = blockStyle(n.kind);
    const gl = nodeGlyph(n.kind, r.x + 12, r.y + r.h / 2 - 8, st.accent);
    const nx = gl.length > 0 ? r.x + 34 : r.x + 14;
    s +=
      `<g filter="url(#gshadow)">` +
      `<path d="${rectRoundRight(r.x, r.y, r.w, r.h, 8)}" fill="${st.fill}" stroke="${st.accent}" stroke-width="1.2"/>` +
      `<rect x="${r.x}" y="${r.y}" width="5" height="${r.h}" fill="${st.accent}"/>` +
      gl +
      nodeLabels({
        name: n.name,
        ...(n.tech !== undefined ? { tech: n.tech } : {}),
        x: nx,
        boxY: r.y,
        boxH: r.h,
        textW: r.x + r.w - nx - 12,
        nameFill: st.text,
        techFill: st.accent,
      }) +
      `</g>`;
  }

  s += labels.join(''); // labels on top, never crossed by a line
  s += `</svg>`;
  return s;
}

function renderBlockGraph(data: Data, frame: FrameOpts): string {
  const svg = data.layers !== undefined && data.layers.length > 0 ? renderLayered(data) : renderGrid(data);
  const opts: Parameters<typeof diagramFrame>[0] = {
    tag: frame.tag,
    ...(frame.tagClass !== undefined ? { tagClass: frame.tagClass } : {}),
    ...(frame.tagBg !== undefined ? { tagBg: frame.tagBg } : {}),
    ...(data.title !== undefined ? { title: data.title } : {}),
    ...(data.description !== undefined ? { desc: data.description } : {}),
  };
  return diagramFrame(opts, svg);
}

/** `block` block — generic architecture (grid or layered). */
export function renderBlock(data: BlockDataMap['block']): string {
  return renderBlockGraph(data, { tag: 'ARCH', tagBg: '#0f766e' });
}
/** `infra` block — deployment topology. */
export function renderInfra(data: BlockDataMap['infra']): string {
  return renderBlockGraph(data, { tag: 'INFRA', tagBg: '#0078d4' });
}
/** `event` block — pub/sub choreography. */
export function renderEvent(data: BlockDataMap['event']): string {
  return renderBlockGraph(data, { tag: 'EVENT', tagBg: '#0f766e' });
}
/** `ddd` block — bounded-context map. */
export function renderDdd(data: BlockDataMap['ddd']): string {
  return renderBlockGraph(data, { tag: 'DDD', tagBg: '#6b21a8' });
}
/** `network` block — security zones / network topology. */
export function renderNetwork(data: BlockDataMap['network']): string {
  return renderBlockGraph(data, { tag: 'ZONES', tagBg: '#991b1b' });
}
