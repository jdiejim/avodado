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

function renderGrid(data: Data): string {
  const groups = data.groups ?? [];
  const nodes = data.nodes ?? [];
  const edges = data.edges ?? [];
  const cellW = 184;
  const cellH = 82;
  const gapX = 56;
  const gapY = 58;
  const padX = 26;
  const padTop = 30;
  const padBot = 20;
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
    x: xOf(g.col) - 16,
    y: yOf(g.row) - 22,
    w: (g.cols ?? 1) * cellW + ((g.cols ?? 1) - 1) * gapX + 32,
    h: (g.rows ?? 1) * cellH + ((g.rows ?? 1) - 1) * gapY + 38,
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
    const col = safeColor(g.color, '#0e54a1');
    // AWS-console-style zone: dashed tinted boundary + a solid label badge.
    // 2D containers (e.g. a VPC) get a centered title pill on the top border;
    // band-shaped zones (e.g. subnets) get a top-left tab — so a VPC and the
    // subnet sharing its corner never collide.
    const badgeW = 16 + g.label.length * 6.4;
    const isContainer = (g.cols ?? 1) >= 2 && (g.rows ?? 1) >= 2;
    const zone = `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="10" fill="${col}" fill-opacity="0.06" stroke="${col}" stroke-opacity="0.55" stroke-width="1.3" stroke-dasharray="7 5"/>`;
    const label = isContainer
      ? `<rect x="${r.x + (r.w - badgeW) / 2}" y="${r.y - 1}" width="${badgeW}" height="20" rx="10" fill="${col}"/>` +
        `<text x="${r.x + r.w / 2}" y="${r.y + 13}" class="grp-label" fill="#fff" text-anchor="middle">${escapeHtml(g.label)}</text>`
      : `<path d="M${r.x} ${r.y + 20} L${r.x} ${r.y + 10} a10 10 0 0 1 10 -10 h${badgeW - 10} v20 z" fill="${col}"/>` +
        `<text x="${r.x + badgeW / 2}" y="${r.y + 14}" class="grp-label" fill="#fff" text-anchor="middle">${escapeHtml(g.label)}</text>`;
    s += `<g>${zone}${label}</g>`;
  }

  for (const e of edges) {
    const A = byId.get(e.from);
    const B = byId.get(e.to);
    if (!A || !B) continue;
    const p = ortho(rectFor(A), rectFor(B));
    const st = GEDGE[e.kind ?? 'solid'] ?? GEDGE['solid'] ?? FALLBACK_EDGE;
    s +=
      `<g><path d="${p.d}" fill="none" stroke="${st.stroke}" stroke-width="${st.sw}" stroke-dasharray="${st.dash}" marker-end="url(#${st.marker})"/>` +
      edgePill(p, e.label, st.err) +
      `</g>`;
  }

  for (const n of nodes) {
    const r = rectFor(n);
    const st = blockStyle(n.kind);
    const gl = nodeGlyph(n.kind, r.x + 16, r.y + 16, st.accent);
    const nx = gl.length > 0 ? r.x + 42 : r.x + 16;
    const chip =
      gl.length === 0 && n.kind !== undefined
        ? `<text x="${r.x + 16}" y="${r.y + 22}" class="blk-chip" fill="${st.accent}">${escapeHtml(n.kind)}</text>`
        : '';
    const tech =
      n.tech !== undefined
        ? `<text x="${nx}" y="${r.y + (gl.length > 0 ? 50 : 60)}" class="blk-tech" fill="${st.accent}">${escapeHtml(n.tech)}</text>`
        : '';
    s +=
      `<g filter="url(#gshadow)">` +
      `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="9" fill="${st.fill}" stroke="${st.accent}" stroke-width="1.2"/>` +
      `<rect x="${r.x}" y="${r.y}" width="5" height="${r.h}" rx="2" fill="${st.accent}"/>` +
      gl +
      chip +
      `<text x="${nx}" y="${r.y + (gl.length > 0 ? 34 : 44)}" class="blk-name" fill="${st.text}">${escapeHtml(n.name)}</text>` +
      tech +
      `</g>`;
  }

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
  const nodeH = 56;
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
    `<rect x="${outerPad}" y="${outerPad}" width="${width - outerPad * 2}" height="${height - outerPad * 2}" rx="12" fill="none" stroke="#0e54a1" stroke-width="1.5"/>`;
  if (data.systemLabel !== undefined) {
    s += `<text x="${outerPad + 14}" y="${outerPad + 18}" class="grp-label" fill="#0e54a1">${escapeHtml(data.systemLabel)}</text>`;
  }
  for (let i = 0; i < layers.length; i++) {
    const L = layers[i];
    if (L === undefined) continue;
    s +=
      `<g>` +
      `<rect x="${innerX}" y="${bandY(i)}" width="${labelW + bandInnerW}" height="${bandH}" rx="6" fill="#f3f4f6" stroke="#d1d5db"/>` +
      `<rect x="${innerX}" y="${bandY(i)}" width="${labelW}" height="${bandH}" rx="6" fill="#0e54a1"/>` +
      `<rect x="${innerX + labelW - 8}" y="${bandY(i)}" width="8" height="${bandH}" fill="#0e54a1"/>` +
      `<text x="${innerX + 14}" y="${bandY(i) + bandH / 2 + 4}" class="layer-label">${escapeHtml(L.label)}</text>` +
      `</g>`;
  }

  for (const e of edges) {
    const A = rects.get(e.from);
    const B = rects.get(e.to);
    if (!A || !B) continue;
    const p = ortho(A, B);
    const st = GEDGE[e.kind ?? 'solid'] ?? GEDGE['solid'] ?? FALLBACK_EDGE;
    s +=
      `<g><path d="${p.d}" fill="none" stroke="${st.stroke}" stroke-width="${st.sw}" stroke-dasharray="${st.dash}" marker-end="url(#${st.marker})"/>` +
      edgePill(p, e.label, st.err) +
      `</g>`;
  }

  for (const n of nodes) {
    const r = rects.get(n.id);
    if (r === undefined) continue;
    const st = blockStyle(n.kind);
    const gl = nodeGlyph(n.kind, r.x + 12, r.y + 12, st.accent);
    const nx = gl.length > 0 ? r.x + 34 : r.x + 14;
    const tech =
      n.tech !== undefined
        ? `<text x="${nx}" y="${r.y + 42}" class="blk-tech" fill="${st.accent}">${escapeHtml(n.tech)}</text>`
        : '';
    s +=
      `<g filter="url(#gshadow)">` +
      `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="8" fill="${st.fill}" stroke="${st.accent}" stroke-width="1.2"/>` +
      `<rect x="${r.x}" y="${r.y}" width="5" height="${r.h}" rx="2" fill="${st.accent}"/>` +
      gl +
      `<text x="${nx}" y="${r.y + (n.tech !== undefined ? 26 : 33)}" class="blk-name" fill="${st.text}">${escapeHtml(n.name)}</text>` +
      tech +
      `</g>`;
  }

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
