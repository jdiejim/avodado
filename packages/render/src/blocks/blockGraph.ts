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
import { edgeStep, stepsLegend } from '../svg/edgeSteps.js';
import { blockStyle, nodeGlyph, GEDGE } from '../svg/blockStyle.js';
import { wrapText } from '../svg/wrapText.js';
import { safeColor } from '../sanitize.js';
import { diagramFrame } from './frame.js';
import { ensureGrid } from './autoLayout.js';

type Data = BlockDataMap['block'];
type Group = NonNullable<Data['groups']>[number];
type Node = NonNullable<Data['nodes']>[number];

interface FrameOpts {
  readonly tag: string;
  readonly tagBg?: string;
  readonly tagClass?: string;
}

const FALLBACK_EDGE = {
  stroke: 'var(--charcoal)',
  sw: 1.4,
  dash: '',
  marker: 'gArrow',
  err: false,
} as const;

/**
 * Renders collected edge labels either as on-edge pills (sparse diagrams) or —
 * when the diagram has 4+ labelled edges — as circled step numerals with the
 * text moved to a legend under the SVG (the agent-loop language; pills at that
 * density collide and read cluttered).
 */
function edgeLabelLayer(
  pending: ReadonlyArray<{ lx: number; ly: number; label?: string; err: boolean }>,
): { overlay: string; legend: string } {
  const labelled = pending.filter((l) => l.label !== undefined && l.label !== '');
  const numbered = labelled.length >= 4;
  const overlay: string[] = [];
  const steps: Array<{ label: string; err?: boolean }> = [];
  for (const l of pending) {
    if (l.label === undefined || l.label === '') continue;
    if (numbered) {
      steps.push({ label: l.label, ...(l.err ? { err: true } : {}) });
      overlay.push(edgeStep({ lx: l.lx, ly: l.ly }, steps.length, l.err));
    } else {
      overlay.push(edgePill({ lx: l.lx, ly: l.ly }, l.label, l.err));
    }
  }
  return { overlay: overlay.join(''), legend: stepsLegend(steps) };
}

/**
 * Renders a node's `name` (wrapped to ≤2 lines) and optional `tech` (≤2 lines),
 * vertically centred in the box so long labels never overflow or overlap.
 * `anchor: 'middle'` centres each line on `x` (for shaped nodes).
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
  readonly anchor?: 'middle';
}): string {
  const nameLineH = 15;
  const techLineH = 12;
  const gap = 4;
  const anchorAttr = opts.anchor === 'middle' ? ' text-anchor="middle"' : '';
  const nameLines = wrapText(opts.name, Math.max(6, Math.floor(opts.textW / 6.6)), 2);
  const techLines =
    opts.tech !== undefined ? wrapText(opts.tech, Math.max(6, Math.floor(opts.textW / 5.8)), 2) : [];
  const blockH = nameLines.length * nameLineH + (techLines.length > 0 ? gap + techLines.length * techLineH : 0);
  let y = opts.boxY + (opts.boxH - blockH) / 2 + nameLineH - 4;
  let s = '';
  for (const ln of nameLines) {
    s += `<text x="${opts.x}" y="${y.toFixed(1)}" class="blk-name" fill="${opts.nameFill}"${anchorAttr}>${escapeHtml(ln)}</text>`;
    y += nameLineH;
  }
  if (techLines.length > 0) {
    y += gap - nameLineH + techLineH;
    for (const ln of techLines) {
      s += `<text x="${opts.x}" y="${y.toFixed(1)}" class="blk-tech" fill="${opts.techFill}"${anchorAttr}>${escapeHtml(ln)}</text>`;
      y += techLineH;
    }
  }
  return s;
}

type Rect = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };

/**
 * The rect edges should anchor to for a given kind — most shapes fill their
 * grid cell, but the cloud's outline is inset (arrows would float in air) and
 * the instance stack's back cards overhang the cell top-right (they'd be drawn
 * over incoming arrowheads). Boxless shapes anchor to their visible core.
 */
export function edgeAnchorRect(kind: string | undefined, r: Rect): Rect {
  switch (shapeFor(kind)) {
    case 'cloud':
      return { x: r.x + r.w * 0.07, y: r.y + r.h * 0.3, w: r.w * 0.86, h: r.h * 0.7 - 4 };
    case 'stack':
      return { x: r.x, y: r.y - 12, w: r.w + 12, h: r.h + 12 };
    case 'figure':
    case 'crowd':
      return { x: r.x + r.w * 0.28, y: r.y, w: r.w * 0.44, h: r.h };
    case 'globe':
      return { x: r.x + r.w * 0.3, y: r.y, w: r.w * 0.4, h: r.h };
    default:
      return r;
  }
}

/**
 * The canonical system-design shapes, chosen by node kind: data stores render
 * as cylinders, queues/streams as pipes (stadiums), CDN/external as clouds,
 * gateways/load-balancers as hexagons. Everything else keeps the accent card.
 */
function shapeFor(
  kind: string | undefined,
):
  | 'cylinder'
  | 'pipe'
  | 'cloud'
  | 'hex'
  | 'octagon'
  | 'stack'
  | 'pail'
  | 'tiered'
  | 'rack'
  | 'shield'
  | 'figure'
  | 'crowd'
  | 'window'
  | 'phone'
  | 'fn'
  | 'clock'
  | 'vault'
  | 'shards'
  | 'replica'
  | 'globe'
  | 'card' {
  switch ((kind ?? '').toLowerCase()) {
    case 'db':
    case 'database':
    case 'store':
    case 'postgres':
    case 'mysql':
    case 'mongo':
    case 'mongodb':
    case 'dynamo':
      return 'cylinder';
    case 'warehouse':
    case 'lake':
      return 'tiered';
    case 'bucket':
    case 'blob':
    case 'object':
    case 's3':
      return 'pail';
    case 'queue':
    case 'topic':
    case 'stream':
    case 'mq':
    case 'broker':
    case 'sqs':
    case 'rabbitmq':
    case 'kafka':
    case 'kinesis':
      return 'pipe';
    case 'cdn':
    case 'external':
      return 'cloud';
    case 'gateway':
    case 'proxy':
      return 'hex';
    case 'lb':
      return 'octagon';
    case 'cache':
    case 'redis':
    case 'memcached':
    case 'worker':
    case 'etl':
      return 'stack';
    case 'vm':
    case 'server':
    case 'host':
      return 'rack';
    case 'waf':
    case 'firewall':
    case 'shield':
      return 'shield';
    case 'user':
    case 'person':
    case 'actor':
      return 'figure';
    case 'users':
    case 'crowd':
      return 'crowd';
    case 'browser':
    case 'web':
      return 'window';
    case 'mobile':
      return 'phone';
    case 'function':
    case 'lambda':
      return 'fn';
    case 'scheduler':
    case 'cron':
    case 'job':
      return 'clock';
    case 'secrets':
    case 'vault':
    case 'kms':
      return 'vault';
    case 'shard':
    case 'shards':
    case 'sharded':
      return 'shards';
    case 'replica':
    case 'replicas':
    case 'replicaset':
      return 'replica';
    case 'region':
    case 'geo':
    case 'globe':
      return 'globe';
    default:
      return 'card';
  }
}

/**
 * Renders one node — shaped by kind — inside its grid rect. Exported so other
 * architecture renderers (felogic/belogic, …) can reuse the shape language for
 * their data/queue/cache/external nodes.
 */
export function renderShapedNode(
  n: {
    readonly kind?: string | undefined;
    readonly name: string;
    readonly tech?: string | undefined;
  },
  r: Rect,
): string {
  const st = blockStyle(n.kind);
  const shape = shapeFor(n.kind);
  const cx = r.x + r.w / 2;
  const tech = n.tech !== undefined ? { tech: n.tech } : {};

  if (shape === 'cylinder') {
    const ry = Math.min(13, r.h * 0.16);
    const rx = r.w / 2;
    return (
      `<g filter="url(#gshadow)">` +
      `<path d="M${r.x} ${r.y + ry} A ${rx} ${ry} 0 0 1 ${r.x + r.w} ${r.y + ry} V ${r.y + r.h - ry} A ${rx} ${ry} 0 0 1 ${r.x} ${r.y + r.h - ry} Z" fill="${st.fill}" stroke="${st.accent}" stroke-width="1.2"/>` +
      `<path d="M${r.x} ${r.y + ry} A ${rx} ${ry} 0 0 0 ${r.x + r.w} ${r.y + ry}" fill="none" stroke="${st.accent}" stroke-width="1.2"/>` +
      nodeLabels({
        name: n.name,
        ...tech,
        x: cx,
        boxY: r.y + ry * 2,
        boxH: r.h - ry * 2.6,
        textW: r.w - 30,
        nameFill: st.text,
        techFill: st.accent,
        anchor: 'middle',
      }) +
      `</g>`
    );
  }
  if (shape === 'pipe') {
    // A horizontal cylinder — the classic queue/topic silhouette. The rim
    // ellipse marks the open (consumer) end on the right.
    const ex = Math.min(15, r.w * 0.11);
    const ry = r.h / 2;
    const cy = r.y + ry;
    return (
      `<g filter="url(#gshadow)">` +
      `<path d="M${r.x + ex} ${r.y} H ${r.x + r.w - ex} A ${ex} ${ry} 0 0 1 ${r.x + r.w - ex} ${r.y + r.h} H ${r.x + ex} A ${ex} ${ry} 0 0 1 ${r.x + ex} ${r.y} Z" fill="${st.fill}" stroke="${st.accent}" stroke-width="1.2"/>` +
      `<ellipse cx="${r.x + r.w - ex}" cy="${cy}" rx="${ex}" ry="${ry}" fill="none" stroke="${st.accent}" stroke-width="1.1" stroke-opacity="0.7"/>` +
      nodeLabels({
        name: n.name,
        ...tech,
        x: r.x + (r.w - ex) / 2,
        boxY: r.y,
        boxH: r.h,
        textW: r.w - ex * 3.2,
        nameFill: st.text,
        techFill: st.accent,
        anchor: 'middle',
      }) +
      `</g>`
    );
  }
  if (shape === 'stack') {
    // A stack of instances — two receding cards behind the main one (Redis /
    // cache clusters, replicated nodes).
    const off = 6;
    const back = (i: number, op: number): string =>
      `<rect x="${r.x + off * i}" y="${r.y - off * i}" width="${r.w}" height="${r.h}" rx="10" fill="${st.fill}" stroke="${st.accent}" stroke-width="1" opacity="${op}"/>`;
    const gl = nodeGlyph(n.kind, r.x + 14, r.y + r.h / 2 - 8, st.accent);
    const nx = gl.length > 0 ? r.x + 40 : r.x + 16;
    return (
      `<g filter="url(#gshadow)">` +
      back(2, 0.45) +
      back(1, 0.7) +
      `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="10" fill="${st.fill}" stroke="${st.accent}" stroke-width="1.2"/>` +
      gl +
      nodeLabels({
        name: n.name,
        ...tech,
        x: nx,
        boxY: r.y,
        boxH: r.h,
        textW: r.x + r.w - nx - 14,
        nameFill: st.text,
        techFill: st.accent,
      }) +
      `</g>`
    );
  }
  if (shape === 'cloud') {
    const b = r.y + r.h - 3;
    const p =
      `M ${r.x + r.w * 0.2} ${b} ` +
      `A ${r.w * 0.13} ${r.h * 0.2} 0 0 1 ${r.x + r.w * 0.14} ${b - r.h * 0.32} ` +
      `A ${r.w * 0.17} ${r.h * 0.28} 0 0 1 ${r.x + r.w * 0.43} ${b - r.h * 0.58} ` +
      `A ${r.w * 0.18} ${r.h * 0.26} 0 0 1 ${r.x + r.w * 0.72} ${b - r.h * 0.5} ` +
      `A ${r.w * 0.13} ${r.h * 0.21} 0 0 1 ${r.x + r.w * 0.82} ${b} Z`;
    return (
      `<g filter="url(#gshadow)">` +
      `<path d="${p}" fill="${st.fill}" stroke="${st.accent}" stroke-width="1.2" stroke-linejoin="round"/>` +
      nodeLabels({
        name: n.name,
        ...tech,
        x: r.x + r.w * 0.48,
        boxY: r.y + r.h * 0.34,
        boxH: r.h * 0.58,
        textW: r.w * 0.52,
        nameFill: st.text,
        techFill: st.accent,
        anchor: 'middle',
      }) +
      `</g>`
    );
  }
  if (shape === 'hex') {
    const inset = Math.min(26, r.w * 0.16);
    const p =
      `M${r.x + inset} ${r.y} L ${r.x + r.w - inset} ${r.y} L ${r.x + r.w} ${r.y + r.h / 2} ` +
      `L ${r.x + r.w - inset} ${r.y + r.h} L ${r.x + inset} ${r.y + r.h} L ${r.x} ${r.y + r.h / 2} Z`;
    return (
      `<g filter="url(#gshadow)">` +
      `<path d="${p}" fill="${st.fill}" stroke="${st.accent}" stroke-width="1.2" stroke-linejoin="round"/>` +
      nodeLabels({
        name: n.name,
        ...tech,
        x: cx,
        boxY: r.y,
        boxH: r.h,
        textW: r.w - inset * 2 - 6,
        nameFill: st.text,
        techFill: st.accent,
        anchor: 'middle',
      }) +
      `</g>`
    );
  }

  if (shape === 'pail') {
    // An S3-style pail: elliptical rim, tapered sides.
    const ry = Math.min(11, r.h * 0.13);
    const tp = r.w * 0.12;
    return (
      `<g filter="url(#gshadow)">` +
      `<path d="M${r.x} ${r.y + ry} A ${r.w / 2} ${ry} 0 0 1 ${r.x + r.w} ${r.y + ry} L ${r.x + r.w - tp} ${r.y + r.h - 6} A ${(r.w - tp * 2) / 2} 6 0 0 1 ${r.x + tp} ${r.y + r.h - 6} Z" fill="${st.fill}" stroke="${st.accent}" stroke-width="1.2"/>` +
      `<path d="M${r.x} ${r.y + ry} A ${r.w / 2} ${ry} 0 0 0 ${r.x + r.w} ${r.y + ry}" fill="none" stroke="${st.accent}" stroke-width="1.2"/>` +
      nodeLabels({
        name: n.name,
        ...tech,
        x: cx,
        boxY: r.y + ry * 2,
        boxH: r.h - ry * 2.6,
        textW: r.w - tp * 2 - 16,
        nameFill: st.text,
        techFill: st.accent,
        anchor: 'middle',
      }) +
      `</g>`
    );
  }
  if (shape === 'tiered') {
    // A warehouse/lake: cylinder with extra tier rims — visibly "more data".
    const ry = Math.min(12, r.h * 0.14);
    const rx = r.w / 2;
    const rim = (dy: number): string =>
      `<path d="M${r.x} ${r.y + dy} A ${rx} ${ry} 0 0 0 ${r.x + r.w} ${r.y + dy}" fill="none" stroke="${st.accent}" stroke-width="1" stroke-opacity="0.55"/>`;
    return (
      `<g filter="url(#gshadow)">` +
      `<path d="M${r.x} ${r.y + ry} A ${rx} ${ry} 0 0 1 ${r.x + r.w} ${r.y + ry} V ${r.y + r.h - ry} A ${rx} ${ry} 0 0 1 ${r.x} ${r.y + r.h - ry} Z" fill="${st.fill}" stroke="${st.accent}" stroke-width="1.2"/>` +
      `<path d="M${r.x} ${r.y + ry} A ${rx} ${ry} 0 0 0 ${r.x + r.w} ${r.y + ry}" fill="none" stroke="${st.accent}" stroke-width="1.2"/>` +
      rim(ry + (r.h - ry * 2) * 0.42) +
      nodeLabels({
        name: n.name,
        ...tech,
        x: cx,
        boxY: r.y + ry * 2 + (r.h - ry * 2) * 0.3,
        boxH: r.h - ry * 2.6 - (r.h - ry * 2) * 0.3,
        textW: r.w - 30,
        nameFill: st.text,
        techFill: st.accent,
        anchor: 'middle',
      }) +
      `</g>`
    );
  }
  if (shape === 'rack') {
    // A server rack: three stacked slabs with indicator ticks.
    const gap = 5;
    const slabH = (r.h - gap * 2) / 3;
    let slabs = '';
    for (let i = 0; i < 3; i++) {
      const sy = r.y + i * (slabH + gap);
      slabs +=
        `<rect x="${r.x}" y="${sy.toFixed(1)}" width="${r.w}" height="${slabH.toFixed(1)}" rx="6" fill="${st.fill}" stroke="${st.accent}" stroke-width="1.2"/>` +
        `<circle cx="${r.x + 12}" cy="${(sy + slabH / 2).toFixed(1)}" r="2.4" fill="${st.accent}" opacity="0.8"/>` +
        `<path d="M${r.x + 20} ${(sy + slabH / 2).toFixed(1)} H ${r.x + 32}" stroke="${st.accent}" stroke-width="1.4" stroke-opacity="0.5"/>`;
    }
    return (
      `<g filter="url(#gshadow)">` +
      slabs +
      nodeLabels({
        name: n.name,
        ...tech,
        x: r.x + r.w / 2 + 10,
        boxY: r.y,
        boxH: r.h,
        textW: r.w - 84,
        nameFill: st.text,
        techFill: st.accent,
        anchor: 'middle',
      }) +
      `</g>`
    );
  }
  if (shape === 'shield') {
    // A true shield silhouette for WAF / firewall.
    const p =
      `M${cx} ${r.y} L ${r.x + r.w * 0.9} ${r.y + r.h * 0.14} V ${r.y + r.h * 0.5} ` +
      `Q ${r.x + r.w * 0.9} ${r.y + r.h * 0.82} ${cx} ${r.y + r.h} ` +
      `Q ${r.x + r.w * 0.1} ${r.y + r.h * 0.82} ${r.x + r.w * 0.1} ${r.y + r.h * 0.5} V ${r.y + r.h * 0.14} Z`;
    return (
      `<g filter="url(#gshadow)">` +
      `<path d="${p}" fill="${st.fill}" stroke="${st.accent}" stroke-width="1.3" stroke-linejoin="round"/>` +
      nodeLabels({
        name: n.name,
        ...tech,
        x: cx,
        boxY: r.y + r.h * 0.14,
        boxH: r.h * 0.62,
        textW: r.w * 0.6,
        nameFill: st.text,
        techFill: st.accent,
        anchor: 'middle',
      }) +
      `</g>`
    );
  }
  if (shape === 'figure') {
    // A boxless actor: head + shoulders above the name (UML-actor spirit).
    const headR = Math.min(11, r.h * 0.13);
    const headCy = r.y + headR + 2;
    const shoulderY = headCy + headR + 20;
    return (
      `<g>` +
      `<circle cx="${cx}" cy="${headCy.toFixed(1)}" r="${headR}" fill="${st.accent}"/>` +
      `<path d="M ${cx - headR * 1.8} ${shoulderY.toFixed(1)} a ${headR * 1.8} ${headR * 2} 0 0 1 ${headR * 3.6} 0 z" fill="${st.accent}"/>` +
      nodeLabels({
        name: n.name,
        ...tech,
        x: cx,
        boxY: shoulderY + 2,
        boxH: r.y + r.h - shoulderY - 2,
        textW: r.w - 12,
        nameFill: 'var(--charcoal)',
        techFill: st.accent,
        anchor: 'middle',
      }) +
      `</g>`
    );
  }
  if (shape === 'octagon') {
    // A load balancer: octagon (distinct from the gateway hexagon).
    const ic = Math.min(24, r.w * 0.15);
    const ich = Math.min(24, r.h * 0.3);
    const p =
      `M${r.x + ic} ${r.y} H ${r.x + r.w - ic} L ${r.x + r.w} ${r.y + ich} V ${r.y + r.h - ich} ` +
      `L ${r.x + r.w - ic} ${r.y + r.h} H ${r.x + ic} L ${r.x} ${r.y + r.h - ich} V ${r.y + ich} Z`;
    return (
      `<g filter="url(#gshadow)">` +
      `<path d="${p}" fill="${st.fill}" stroke="${st.accent}" stroke-width="1.2" stroke-linejoin="round"/>` +
      nodeLabels({
        name: n.name,
        ...tech,
        x: cx,
        boxY: r.y,
        boxH: r.h,
        textW: r.w - ic * 2 - 6,
        nameFill: st.text,
        techFill: st.accent,
        anchor: 'middle',
      }) +
      `</g>`
    );
  }
  if (shape === 'fn') {
    // A function/lambda: a circle with the ƒ mark.
    const rad = Math.min(r.h / 2, r.w * 0.32);
    const cy = r.y + r.h / 2;
    return (
      `<g filter="url(#gshadow)">` +
      `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="${st.fill}" stroke="${st.accent}" stroke-width="1.2"/>` +
      `<text x="${cx}" y="${(cy - rad * 0.25).toFixed(1)}" font-family="Georgia, serif" font-size="${Math.max(15, rad * 0.42).toFixed(0)}" font-style="italic" font-weight="700" fill="${st.accent}" text-anchor="middle">ƒ</text>` +
      nodeLabels({
        name: n.name,
        ...tech,
        x: cx,
        boxY: cy - rad * 0.1,
        boxH: rad,
        textW: rad * 1.7,
        nameFill: st.text,
        techFill: st.accent,
        anchor: 'middle',
      }) +
      `</g>`
    );
  }
  if (shape === 'clock') {
    // A scheduler/cron: the industry-standard calendar card with a clock badge.
    const hh = Math.min(18, r.h * 0.22);
    const ringY = r.y + 3;
    const ring = (fx: number): string =>
      `<path d="M${fx.toFixed(1)} ${(ringY - 6).toFixed(1)} V ${(ringY + 4).toFixed(1)}" stroke="${st.accent}" stroke-width="3" stroke-linecap="round"/>`;
    const ccx = r.x + r.w - 18;
    const ccy = r.y + r.h - 16;
    const cr = Math.min(11, r.h * 0.14);
    return (
      `<g filter="url(#gshadow)">` +
      `<rect x="${r.x}" y="${r.y + 3}" width="${r.w}" height="${r.h - 3}" rx="9" fill="${st.fill}" stroke="${st.accent}" stroke-width="1.2"/>` +
      `<path d="M${r.x} ${r.y + 12} a 9 9 0 0 1 9 -9 H ${r.x + r.w - 9} a 9 9 0 0 1 9 9 V ${r.y + 3 + hh} H ${r.x} Z" fill="${st.accent}" fill-opacity="0.16"/>` +
      `<path d="M${r.x} ${r.y + 3 + hh} H ${r.x + r.w}" stroke="${st.accent}" stroke-width="1" stroke-opacity="0.5"/>` +
      ring(r.x + r.w * 0.3) +
      ring(r.x + r.w * 0.7) +
      `<circle cx="${ccx}" cy="${ccy}" r="${cr}" fill="var(--white)" stroke="${st.accent}" stroke-width="1.4"/>` +
      `<path d="M${ccx} ${(ccy - cr * 0.55).toFixed(1)} V ${ccy} L ${(ccx + cr * 0.45).toFixed(1)} ${(ccy + cr * 0.3).toFixed(1)}" stroke="${st.accent}" stroke-width="1.4" fill="none" stroke-linecap="round"/>` +
      nodeLabels({
        name: n.name,
        ...tech,
        x: cx,
        boxY: r.y + 3 + hh,
        boxH: r.h - 3 - hh,
        textW: r.w - 40,
        nameFill: st.text,
        techFill: st.accent,
        anchor: 'middle',
      }) +
      `</g>`
    );
  }
  if (shape === 'vault') {
    // Secrets: a padlock — shackle arc over a rounded body.
    const bodyY = r.y + r.h * 0.3;
    const bodyH = r.h * 0.7;
    const bw = Math.min(r.w * 0.72, r.h * 1.6);
    const bx = cx - bw / 2;
    const shR = bw * 0.22;
    return (
      `<g filter="url(#gshadow)">` +
      `<path d="M${(cx - shR).toFixed(1)} ${(bodyY + 4).toFixed(1)} V ${(r.y + shR * 0.9 + 4).toFixed(1)} A ${shR.toFixed(1)} ${(shR * 0.95).toFixed(1)} 0 0 1 ${(cx + shR).toFixed(1)} ${(r.y + shR * 0.9 + 4).toFixed(1)} V ${(bodyY + 4).toFixed(1)}" fill="none" stroke="${st.accent}" stroke-width="4" stroke-linecap="round"/>` +
      `<rect x="${bx.toFixed(1)}" y="${bodyY.toFixed(1)}" width="${bw.toFixed(1)}" height="${bodyH.toFixed(1)}" rx="10" fill="${st.fill}" stroke="${st.accent}" stroke-width="1.3"/>` +
      nodeLabels({
        name: n.name,
        ...tech,
        x: cx,
        boxY: bodyY,
        boxH: bodyH,
        textW: bw - 18,
        nameFill: st.text,
        techFill: st.accent,
        anchor: 'middle',
      }) +
      `</g>`
    );
  }
  if (shape === 'shards') {
    // A sharded store: three small cylinders side by side.
    const gap = 8;
    const pad = 12;
    const cw = (r.w - pad * 2 - gap * 2) / 3;
    const ch = r.h * 0.58;
    const ry = Math.min(7, ch * 0.18);
    let cyls = '';
    for (let i = 0; i < 3; i++) {
      const sx = r.x + pad + i * (cw + gap);
      cyls +=
        `<path d="M${sx.toFixed(1)} ${r.y + ry} A ${cw / 2} ${ry} 0 0 1 ${(sx + cw).toFixed(1)} ${r.y + ry} V ${(r.y + ch - ry).toFixed(1)} A ${cw / 2} ${ry} 0 0 1 ${sx.toFixed(1)} ${(r.y + ch - ry).toFixed(1)} Z" fill="${st.fill}" stroke="${st.accent}" stroke-width="1.1"/>` +
        `<path d="M${sx.toFixed(1)} ${r.y + ry} A ${cw / 2} ${ry} 0 0 0 ${(sx + cw).toFixed(1)} ${r.y + ry}" fill="none" stroke="${st.accent}" stroke-width="1.1"/>`;
    }
    return (
      `<g filter="url(#gshadow)">` +
      cyls +
      nodeLabels({
        name: n.name,
        ...tech,
        x: cx,
        boxY: r.y + ch + 2,
        boxH: r.h - ch - 2,
        textW: r.w - 16,
        nameFill: st.text,
        techFill: st.accent,
        anchor: 'middle',
      }) +
      `</g>`
    );
  }
  if (shape === 'replica') {
    // A replica set: a cylinder with two receding copies behind it.
    const off = 7;
    const ry = Math.min(11, r.h * 0.14);
    const cw = r.w - off * 2;
    const cyl = (dx: number, dy: number, op: number, sw: number): string =>
      `<g opacity="${op}"><path d="M${(r.x + dx).toFixed(1)} ${(r.y + dy + ry).toFixed(1)} A ${cw / 2} ${ry} 0 0 1 ${(r.x + dx + cw).toFixed(1)} ${(r.y + dy + ry).toFixed(1)} V ${(r.y + dy + r.h - off * 2 - ry).toFixed(1)} A ${cw / 2} ${ry} 0 0 1 ${(r.x + dx).toFixed(1)} ${(r.y + dy + r.h - off * 2 - ry).toFixed(1)} Z" fill="${st.fill}" stroke="${st.accent}" stroke-width="${sw}"/>` +
      `<path d="M${(r.x + dx).toFixed(1)} ${(r.y + dy + ry).toFixed(1)} A ${cw / 2} ${ry} 0 0 0 ${(r.x + dx + cw).toFixed(1)} ${(r.y + dy + ry).toFixed(1)}" fill="none" stroke="${st.accent}" stroke-width="${sw}"/></g>`;
    return (
      `<g filter="url(#gshadow)">` +
      cyl(off * 2, 0, 0.5, 1) +
      cyl(off, off, 0.75, 1) +
      cyl(0, off * 2, 1, 1.2) +
      nodeLabels({
        name: n.name,
        ...tech,
        x: r.x + cw / 2,
        boxY: r.y + off * 2 + ry * 2,
        boxH: r.h - off * 2 - ry * 2.6,
        textW: cw - 24,
        nameFill: st.text,
        techFill: st.accent,
        anchor: 'middle',
      }) +
      `</g>`
    );
  }
  if (shape === 'crowd') {
    // Many users: overlapping actor figures.
    const hr = Math.min(9, r.h * 0.11);
    const fig = (fx: number, fy: number, scale: number, op: number): string => {
      const rr = hr * scale;
      return (
        `<g opacity="${op}">` +
        `<circle cx="${fx}" cy="${(fy + rr).toFixed(1)}" r="${rr.toFixed(1)}" fill="${st.accent}"/>` +
        `<path d="M ${(fx - rr * 1.7).toFixed(1)} ${(fy + rr * 2 + rr * 1.9).toFixed(1)} a ${(rr * 1.7).toFixed(1)} ${(rr * 1.9).toFixed(1)} 0 0 1 ${(rr * 3.4).toFixed(1)} 0 z" fill="${st.accent}"/>` +
        `</g>`
      );
    };
    const baseY = r.y + 4;
    return (
      `<g>` +
      fig(cx - hr * 2.4, baseY + 3, 0.85, 0.45) +
      fig(cx + hr * 2.4, baseY + 3, 0.85, 0.45) +
      fig(cx, baseY, 1, 1) +
      nodeLabels({
        name: n.name,
        ...tech,
        x: cx,
        boxY: baseY + hr * 4.6,
        boxH: r.y + r.h - (baseY + hr * 4.6),
        textW: r.w - 12,
        nameFill: 'var(--charcoal)',
        techFill: st.accent,
        anchor: 'middle',
      }) +
      `</g>`
    );
  }
  if (shape === 'globe') {
    // A region / geo node: boxless globe above the label.
    const rad = Math.min(r.h * 0.33, 30);
    const gcy = r.y + rad + 2;
    return (
      `<g>` +
      `<circle cx="${cx}" cy="${gcy.toFixed(1)}" r="${rad}" fill="${st.fill}" stroke="${st.accent}" stroke-width="1.3"/>` +
      `<ellipse cx="${cx}" cy="${gcy.toFixed(1)}" rx="${(rad * 0.42).toFixed(1)}" ry="${rad}" fill="none" stroke="${st.accent}" stroke-width="1" stroke-opacity="0.65"/>` +
      `<path d="M${(cx - rad).toFixed(1)} ${gcy.toFixed(1)} H ${(cx + rad).toFixed(1)}" stroke="${st.accent}" stroke-width="1" stroke-opacity="0.65"/>` +
      `<path d="M${(cx - rad * 0.87).toFixed(1)} ${(gcy - rad * 0.45).toFixed(1)} a ${rad * 1.15} ${rad * 1.15} 0 0 1 ${(rad * 1.74).toFixed(1)} 0" fill="none" stroke="${st.accent}" stroke-width="1" stroke-opacity="0.45"/>` +
      nodeLabels({
        name: n.name,
        ...tech,
        x: cx,
        boxY: gcy + rad + 2,
        boxH: r.y + r.h - (gcy + rad + 2),
        textW: r.w - 12,
        nameFill: 'var(--charcoal)',
        techFill: st.accent,
        anchor: 'middle',
      }) +
      `</g>`
    );
  }
  if (shape === 'phone') {
    // A mobile client: phone frame at the left, label beside it.
    const pw = 34;
    const px2 = r.x + 12;
    const py = r.y + 5;
    const ph = r.h - 10;
    const nx = px2 + pw + 14;
    return (
      `<g filter="url(#gshadow)">` +
      `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="10" fill="${st.fill}" stroke="${st.accent}" stroke-width="1.2"/>` +
      `<rect x="${px2}" y="${py}" width="${pw}" height="${ph}" rx="7" fill="var(--white)" stroke="${st.accent}" stroke-width="1.2"/>` +
      `<path d="M${px2 + pw / 2 - 5} ${py + 6} H ${px2 + pw / 2 + 5}" stroke="${st.accent}" stroke-width="1.4" stroke-linecap="round"/>` +
      `<circle cx="${px2 + pw / 2}" cy="${py + ph - 7}" r="2" fill="${st.accent}"/>` +
      nodeLabels({
        name: n.name,
        ...tech,
        x: nx,
        boxY: r.y,
        boxH: r.h,
        textW: r.x + r.w - nx - 12,
        nameFill: st.text,
        techFill: st.accent,
      }) +
      `</g>`
    );
  }
  if (shape === 'window') {
    // A browser window: rounded frame, header band with traffic dots.
    const hh = 18;
    const dot = (i: number): string =>
      `<circle cx="${r.x + 12 + i * 10}" cy="${r.y + hh / 2}" r="2.6" fill="${st.accent}" opacity="${0.85 - i * 0.2}"/>`;
    return (
      `<g filter="url(#gshadow)">` +
      `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="9" fill="${st.fill}" stroke="${st.accent}" stroke-width="1.2"/>` +
      `<path d="M${r.x} ${r.y + 9} a 9 9 0 0 1 9 -9 H ${r.x + r.w - 9} a 9 9 0 0 1 9 9 V ${r.y + hh} H ${r.x} Z" fill="${st.accent}" fill-opacity="0.14"/>` +
      `<path d="M${r.x} ${r.y + hh} H ${r.x + r.w}" stroke="${st.accent}" stroke-width="1" stroke-opacity="0.5"/>` +
      dot(0) +
      dot(1) +
      dot(2) +
      nodeLabels({
        name: n.name,
        ...tech,
        x: cx,
        boxY: r.y + hh,
        boxH: r.h - hh,
        textW: r.w - 24,
        nameFill: st.text,
        techFill: st.accent,
        anchor: 'middle',
      }) +
      `</g>`
    );
  }

  return renderCardNode(n, r);
}

/**
 * The clean card alone (rounded, soft fill, accent border, glyph — no left
 * bar). The layered band layout uses this directly: its short bands crowd the
 * taller kind silhouettes, so every node stays a calm box there.
 */
function renderCardNode(
  n: {
    readonly kind?: string | undefined;
    readonly name: string;
    readonly tech?: string | undefined;
  },
  r: Rect,
): string {
  const st = blockStyle(n.kind);
  const gl = nodeGlyph(n.kind, r.x + 14, r.y + r.h / 2 - 8, st.accent);
  const nx = gl.length > 0 ? r.x + 40 : r.x + 16;
  return (
    `<g filter="url(#gshadow)">` +
    `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="10" fill="${st.fill}" stroke="${st.accent}" stroke-width="1.2"/>` +
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
    `</g>`
  );
}

function renderGrid(data: Data): string {
  const groups = data.groups ?? [];
  const edges = data.edges ?? [];
  // Quick mode: with no coordinate-anchored groups, nodes missing `col`/`row`
  // trigger auto-layout of the whole graph from the edges (left-to-right).
  // Groups are positioned by explicit grid ranges, so they require coordinates.
  const nodes =
    groups.length === 0
      ? ensureGrid(data.nodes ?? [], edges, 'LR')
      : (data.nodes ?? []).map((n) => ({ ...n, col: n.col ?? 1, row: n.row ?? 1 }));
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
  // A group nested inside a bigger one anchors its label top-RIGHT so it never
  // sits on top of the container's top-left label (VPC → subnet nesting).
  const containedBy = (inner: Group, outer: Group): boolean => {
    if (inner === outer) return false;
    const ic2 = inner.col + (inner.cols ?? 1);
    const ir2 = inner.row + (inner.rows ?? 1);
    const oc2 = outer.col + (outer.cols ?? 1);
    const or2 = outer.row + (outer.rows ?? 1);
    const inside = inner.col >= outer.col && inner.row >= outer.row && ic2 <= oc2 && ir2 <= or2;
    const bigger = (outer.cols ?? 1) * (outer.rows ?? 1) > (inner.cols ?? 1) * (inner.rows ?? 1);
    return inside && bigger;
  };

  let s = `<svg viewBox="0 0 ${width} ${height}" role="img"><title>Block diagram</title>`;

  for (const g of sortedGroups) {
    const raw = groupRect(g);
    const col = safeColor(g.color, '#475569');
    // Nested zones inset by containment depth so a subnet's border never sits
    // on top of its VPC's border — the containing area reads clearly.
    const depth = groups.filter((o) => containedBy(g, o)).length;
    const r = {
      x: raw.x + depth * 12,
      y: raw.y + depth * 11,
      w: raw.w - depth * 24,
      h: raw.h - depth * 17,
    };
    const nested = depth > 0;
    const label = nested
      ? `<text x="${r.x + r.w - 16}" y="${r.y + 19}" class="grp-label" fill="${col}" text-anchor="end">${escapeHtml(g.label)}</text>`
      : `<text x="${r.x + 16}" y="${r.y + 19}" class="grp-label" fill="${col}">${escapeHtml(g.label)}</text>`;
    // Elegant outline zone (fe/be style): no background fill, a dashed boundary,
    // and a plain label — no solid label badge.
    s +=
      `<g>` +
      `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="12" fill="none" stroke="${col}" stroke-opacity="0.6" stroke-width="1.3" stroke-dasharray="7 5"/>` +
      label +
      `</g>`;
  }

  const pending: Array<{ lx: number; ly: number; label?: string; err: boolean }> = [];
  for (const e of edges) {
    const A = byId.get(e.from);
    const B = byId.get(e.to);
    if (!A || !B) continue;
    const p = ortho(edgeAnchorRect(A.kind, rectFor(A)), edgeAnchorRect(B.kind, rectFor(B)));
    const st = GEDGE[e.kind ?? 'solid'] ?? GEDGE['solid'] ?? FALLBACK_EDGE;
    s += `<path d="${p.d}" fill="none" stroke="${st.stroke}" stroke-width="${st.sw}" stroke-dasharray="${st.dash}" marker-end="url(#${st.marker})"/>`;
    pending.push({ lx: p.lx, ly: p.ly, ...(e.label !== undefined ? { label: e.label } : {}), err: st.err });
  }

  for (const n of nodes) {
    s += renderShapedNode(n, rectFor(n));
  }

  const { overlay, legend } = edgeLabelLayer(pending);
  s += overlay; // labels on top, never crossed by a line
  s += `</svg>`;
  return s + legend;
}

function renderLayered(data: Data): string {
  const layers = data.layers ?? [];
  const nodes = data.nodes ?? [];
  const edges = data.edges ?? [];
  const byLayer: Node[][] = layers.map((_, i) =>
    nodes.filter((n) => (n.layer ?? 0) === i),
  );
  const outerPad = 28;
  // Extra bottom padding under the system label so the first band doesn't crowd it.
  const titleH = data.systemLabel !== undefined ? 46 : 16;
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
  // Inner bottom padding so the last band doesn't touch the dashed boundary.
  const innerBot = 16;
  const height = bandY(layers.length) - bandGap + innerBot + outerPad;

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
    // The refined zone language: a dashed system boundary instead of a heavy
    // solid frame.
    `<rect x="${outerPad}" y="${outerPad}" width="${width - outerPad * 2}" height="${height - outerPad * 2}" rx="12" fill="none" stroke="var(--navy)" stroke-opacity="0.6" stroke-width="1.3" stroke-dasharray="7 5"/>`;
  if (data.systemLabel !== undefined) {
    s += `<text x="${outerPad + 14}" y="${outerPad + 19}" class="grp-label" fill="var(--navy)">${escapeHtml(data.systemLabel)}</text>`;
  }
  for (let i = 0; i < layers.length; i++) {
    const L = layers[i];
    if (L === undefined) continue;
    const lc = safeColor(L.color, '#233a5e');
    // Wrap the band label (≤3 lines) so long names stay inside the label column.
    const lblLines = wrapText(L.label, Math.max(8, Math.floor((labelW - 24) / 6.4)), 3);
    const lblText = lblLines
      .map(
        (ln, j) =>
          `<text x="${innerX + 14}" y="${(bandY(i) + bandH / 2 + 4 - (lblLines.length - 1) * 7 + j * 14).toFixed(1)}" class="layer-label" style="fill:${lc}">${escapeHtml(ln)}</text>`,
      )
      .join('');
    // Quiet band: a soft wash + hairline (no solid navy label slab), the layer
    // name as a colored kicker in the label column with a thin tick beside it.
    s +=
      `<g>` +
      `<rect x="${innerX}" y="${bandY(i)}" width="${labelW + bandInnerW}" height="${bandH}" rx="9" fill="${lc}" fill-opacity="0.045" stroke="${lc}" stroke-opacity="0.28"/>` +
      `<rect x="${innerX}" y="${bandY(i) + 10}" width="3" height="${bandH - 20}" rx="1.5" fill="${lc}" fill-opacity="0.75"/>` +
      lblText +
      `</g>`;
  }

  const pending: Array<{ lx: number; ly: number; label?: string; err: boolean }> = [];
  for (const e of edges) {
    const A = rects.get(e.from);
    const B = rects.get(e.to);
    if (!A || !B) continue;
    const p = ortho(A, B);
    const st = GEDGE[e.kind ?? 'solid'] ?? GEDGE['solid'] ?? FALLBACK_EDGE;
    s += `<path d="${p.d}" fill="none" stroke="${st.stroke}" stroke-width="${st.sw}" stroke-dasharray="${st.dash}" marker-end="url(#${st.marker})"/>`;
    pending.push({ lx: p.lx, ly: p.ly, ...(e.label !== undefined ? { label: e.label } : {}), err: st.err });
  }

  for (const n of nodes) {
    const r = rects.get(n.id);
    if (r === undefined) continue;
    s += renderCardNode(n, r);
  }

  const { overlay, legend } = edgeLabelLayer(pending);
  s += overlay; // labels on top, never crossed by a line
  s += `</svg>`;
  return s + legend;
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
