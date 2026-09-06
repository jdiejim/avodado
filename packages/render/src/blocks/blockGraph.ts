/**
 * Block-graph rendering — backs `block`, `infra`, `event`, `ddd`, and
 * `network`. Two layout modes share the same data shape:
 *
 * - **Layered:** if `spec.layers` is present, nodes are placed in horizontal
 *   bands by their `layer` index.
 * - **Grid:** otherwise nodes use `(col, row, w?)` placements, optionally
 *   wrapped in dashed group boxes.
 *
 * Skin (`DESIGN.md`): every node is paper (stores, caches and queues take
 * `paper-2`) with an ink or hairline outline, dashed for external kinds, and
 * an eyebrow chip (`SVC`, `DB`, `QUEUE`, …) naming the kind. Hue is spent on
 * one thing: the entry node (`gateway`, or the preset's entry kind) when
 * exactly one exists. Groups and layers are `paper-2` panels with an eyebrow.
 *
 * Ported from doc-studio.jsx `GridBlock` + `LayeredBlock` + `BlockDiagram`.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { edgeLanes, entryPortOffsets, ortho } from '../svg/ortho.js';
import { edgeLabelLayer, type EdgeLabelPoint } from '../svg/edgeSteps.js';
import {
  nodeGlyph,
  nodeSkin,
  skinFill,
  SKIN_EDGE,
  type EdgeStyle,
  type NodeSkin,
} from '../svg/blockStyle.js';
import type { NodeColors } from '../svg/blockStyle.js';
import { gridGroupsSvg } from '../svg/gridGroups.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { gridMetaAttrs, nodeCellAttrs } from '../svg/gridMeta.js';
import { wrapText } from '../svg/wrapText.js';
import { safeColor } from '../sanitize.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';
import { ensureGrid } from './autoLayout.js';

type Data = BlockDataMap['block'];
type Node = NonNullable<Data['nodes']>[number];

interface FrameOpts {
  /** Eyebrow family word. */
  readonly tag: string;
  /** Kinds that mark the diagram's entry; the accent goes to the one node of these kinds, if exactly one. */
  readonly entry: readonly string[];
}

const FALLBACK_EDGE: EdgeStyle = SKIN_EDGE['solid'] ?? {
  stroke: 'var(--muted)',
  sw: 1.5,
  dash: '',
  marker: 'skArrow',
  err: false,
};

/** Legend wording per chip. */
const CHIP_LABEL: Record<string, string> = {
  CLIENT: 'client',
  SVC: 'service',
  DATA: 'data',
  DB: 'database',
  BUCKET: 'object store',
  WAREHOUSE: 'warehouse',
  QUEUE: 'queue',
  TOPIC: 'topic',
  BUS: 'stream',
  CACHE: 'cache',
  SEARCH: 'search index',
  REGISTRY: 'registry',
  GATEWAY: 'gateway',
  LB: 'load balancer',
  FN: 'function',
  EDGE: 'edge / CDN',
  EXT: 'external',
  PRODUCER: 'producer',
  CONSUMER: 'consumer',
  CONTEXT: 'bounded context',
  WAF: 'firewall',
  DNS: 'DNS',
  AUTH: 'identity',
  OBS: 'observability',
  CRON: 'scheduler',
  ANALYTICS: 'analytics',
  CI: 'pipeline',
  GIT: 'repository',
  EMAIL: 'messaging',
  CONFIG: 'config',
  AI: 'model / agent',
  HOST: 'host',
  SECRETS: 'secrets',
  WEBHOOK: 'webhook',
  REGION: 'region',
};

/** The single accent node id: the one node whose kind is an entry kind, else none. */
function accentNodeId(nodes: readonly { readonly id: string; readonly kind?: string | undefined }[], entry: readonly string[]): string | undefined {
  const hits = nodes.filter((n) => entry.includes((n.kind ?? '').toLowerCase()));
  return hits.length === 1 ? hits[0]?.id : undefined;
}

/**
 * Legend items for the kinds and edge styles a diagram used. Exported so the
 * other block-family renderers (cluster) list their kinds with the same words.
 */
export function blockLegend(
  nodes: readonly { readonly kind?: string | undefined }[],
  edgeKinds: ReadonlySet<string>,
  accent: boolean,
): string {
  const items: LegendItem[] = [];
  const seen = new Set<string>();
  for (const n of nodes) {
    const sk = nodeSkin(n.kind);
    if (sk.chip === '' || seen.has(sk.chip)) continue;
    seen.add(sk.chip);
    items.push({ swatch: 'chip', chip: sk.chip, label: CHIP_LABEL[sk.chip] ?? sk.chip.toLowerCase() });
  }
  if (edgeKinds.has('solid')) items.push({ swatch: 'edge', label: 'calls' });
  if (edgeKinds.has('dashed')) items.push({ swatch: 'edge-dashed', label: 'async / optional' });
  if (edgeKinds.has('forbidden')) items.push({ swatch: 'edge-error', label: 'forbidden' });
  if (edgeKinds.has('error')) items.push({ swatch: 'edge-error', label: 'error' });
  if (accent) items.push({ swatch: 'node-accent', label: 'entry point' });
  return renderLegend(items);
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
  /** Skin mode: type-role classes carry the colour (`nameFill`/`techFill` ignored). */
  readonly skin?: boolean;
  readonly accent?: boolean;
}): string {
  const nameLineH = 15;
  const techLineH = 12;
  const gap = 4;
  const anchorAttr = opts.anchor === 'middle' ? ' text-anchor="middle"' : '';
  const nameLines = wrapText(opts.name, Math.max(6, Math.floor(opts.textW / (opts.skin === true ? 7 : 6.6))), 2);
  const techLines =
    opts.tech !== undefined ? wrapText(opts.tech, Math.max(6, Math.floor(opts.textW / (opts.skin === true ? 6.2 : 5.8))), 2) : [];
  const nameAttrs =
    opts.skin === true ? ` class="blk-name t-name${opts.accent === true ? ' c-accent' : ''}"` : ` class="blk-name" fill="${opts.nameFill}"`;
  const techAttrs = opts.skin === true ? ' class="blk-tech t-sub"' : ` class="blk-tech" fill="${opts.techFill}"`;
  const blockH = nameLines.length * nameLineH + (techLines.length > 0 ? gap + techLines.length * techLineH : 0);
  let y = opts.boxY + (opts.boxH - blockH) / 2 + nameLineH - 4;
  let s = '';
  for (const ln of nameLines) {
    s += `<text x="${opts.x}" y="${y.toFixed(1)}"${nameAttrs}${anchorAttr}>${escapeHtml(ln)}</text>`;
    y += nameLineH;
  }
  if (techLines.length > 0) {
    y += gap - nameLineH + techLineH;
    for (const ln of techLines) {
      s += `<text x="${opts.x}" y="${y.toFixed(1)}"${techAttrs}${anchorAttr}>${escapeHtml(ln)}</text>`;
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
type Shape =
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
  | 'card';

function shapeFor(kind: string | undefined): Shape {
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

/** A node's outline / fill / text colours, plus the skin's stroke attributes. */
interface Paint extends NodeColors {
  /** Legacy palette mode (pre-skin renderers): shadows on, hex palette, no chip. */
  readonly legacy: boolean;
  /** Outline stroke width. */
  readonly sw: number;
  /** Dashed outline (external / boundary kinds). */
  readonly dashed: boolean;
  /** The node carries the diagram's accent (`accent` itself is the outline colour, a legacy field name). */
  readonly focal: boolean;
}

function skinPaint(sk: NodeSkin, focal: boolean): Paint {
  return {
    accent: focal ? 'var(--accent)' : sk.primary ? 'var(--ink)' : 'var(--rule-solid)',
    fill: skinFill(sk, focal),
    text: 'var(--ink)',
    legacy: false,
    sw: focal || sk.primary ? 1.5 : 1,
    dashed: sk.dashed,
    focal,
  };
}

/** Where a kind's eyebrow chip sits: boxy shapes top-left, stores under the rim, the rest top-right. */
function chipFor(shape: Shape, sk: NodeSkin, r: Rect): string {
  if (sk.chip === '') return '';
  const cx = r.x + r.w / 2;
  let x: number;
  let y: number;
  let anchor = '';
  switch (shape) {
    case 'cylinder':
    case 'tiered':
    case 'pail': {
      const ry = shape === 'pail' ? Math.min(11, r.h * 0.13) : Math.min(13, r.h * 0.16);
      x = cx;
      y = r.y + ry * 2 + 8;
      anchor = ' text-anchor="middle"';
      break;
    }
    case 'pipe':
      x = r.x + Math.min(15, r.w * 0.11) + 6;
      y = r.y + 12;
      break;
    case 'hex':
      x = r.x + Math.min(26, r.w * 0.16) + 4;
      y = r.y + 12;
      break;
    case 'octagon':
      x = r.x + Math.min(24, r.w * 0.15) + 4;
      y = r.y + 12;
      break;
    case 'fn': {
      const rad = Math.min(r.h / 2, r.w * 0.32);
      x = cx;
      y = r.y + r.h / 2 - rad * 0.62;
      anchor = ' text-anchor="middle"';
      break;
    }
    case 'vault':
      x = cx;
      y = r.y + r.h * 0.3 + 11;
      anchor = ' text-anchor="middle"';
      break;
    case 'card':
    case 'stack':
    case 'rack':
    case 'window':
    case 'phone':
    case 'clock':
      x = r.x + 10;
      y = r.y + (shape === 'clock' ? Math.min(18, r.h * 0.22) + 14 : 12);
      break;
    default:
      x = r.x + r.w - 4;
      y = r.y + 12;
      anchor = ' text-anchor="end"';
  }
  return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" class="blk-chip t-eyebrow"${anchor}>${escapeHtml(sk.chip)}</text>`;
}

/**
 * Renders one node — shaped by kind — inside its grid rect. Exported so other
 * architecture renderers (felogic/belogic, …) can reuse the shape language for
 * their data/queue/cache/external nodes: passing `legacy` colours keeps the
 * pre-skin look (shadow, palette hue, no chip); without it the skin applies.
 */
export function renderShapedNode(
  n: {
    readonly kind?: string | undefined;
    readonly name: string;
    readonly tech?: string | undefined;
  },
  r: Rect,
  legacy?: NodeColors,
  accent = false,
): string {
  const sk = nodeSkin(n.kind);
  const st: Paint =
    legacy !== undefined
      ? { ...legacy, legacy: true, sw: 1.2, dashed: false, focal: false }
      : skinPaint(sk, accent);
  const shape = shapeFor(n.kind);
  const body = shapedBody(n, r, st, shape);
  if (st.legacy) return body;
  const chip = chipFor(shape, sk, r);
  return chip.length > 0 ? body.replace(/<\/g>$/, `${chip}</g>`) : body;
}

function shapedBody(
  n: {
    readonly kind?: string | undefined;
    readonly name: string;
    readonly tech?: string | undefined;
  },
  r: Rect,
  st: Paint,
  shape: Shape,
): string {
  const cx = r.x + r.w / 2;
  const tech = n.tech !== undefined ? { tech: n.tech } : {};
  const shadow = st.legacy ? ' filter="url(#gshadow)"' : '';
  const sw = st.sw;
  const dashA = st.dashed ? ' stroke-dasharray="4 3"' : '';
  const gc = st.legacy ? st.accent : 'var(--muted)';
  const techTok = st.legacy ? st.accent : 'var(--muted)';
  const skinOpts = st.legacy ? {} : { skin: true, accent: st.focal };

  if (shape === 'cylinder') {
    const ry = Math.min(13, r.h * 0.16);
    const rx = r.w / 2;
    return (
      `<g${shadow}>` +
      `<path d="M${r.x} ${r.y + ry} A ${rx} ${ry} 0 0 1 ${r.x + r.w} ${r.y + ry} V ${r.y + r.h - ry} A ${rx} ${ry} 0 0 1 ${r.x} ${r.y + r.h - ry} Z" fill="${st.fill}" stroke="${st.accent}" stroke-width="${sw}"${dashA}/>` +
      `<path d="M${r.x} ${r.y + ry} A ${rx} ${ry} 0 0 0 ${r.x + r.w} ${r.y + ry}" fill="none" stroke="${st.accent}" stroke-width="${sw}"${dashA}/>` +
      nodeLabels({
        name: n.name,
        ...tech,
        x: cx,
        boxY: r.y + ry * 2,
        boxH: r.h - ry * 2.6,
        textW: r.w - 30,
        nameFill: st.text,
        techFill: techTok,
        ...skinOpts,
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
      `<g${shadow}>` +
      `<path d="M${r.x + ex} ${r.y} H ${r.x + r.w - ex} A ${ex} ${ry} 0 0 1 ${r.x + r.w - ex} ${r.y + r.h} H ${r.x + ex} A ${ex} ${ry} 0 0 1 ${r.x + ex} ${r.y} Z" fill="${st.fill}" stroke="${st.accent}" stroke-width="${sw}"${dashA}/>` +
      `<ellipse cx="${r.x + r.w - ex}" cy="${cy}" rx="${ex}" ry="${ry}" fill="none" stroke="${st.accent}" stroke-width="1.1" stroke-opacity="0.7"/>` +
      nodeLabels({
        name: n.name,
        ...tech,
        x: r.x + (r.w - ex) / 2,
        boxY: r.y,
        boxH: r.h,
        textW: r.w - ex * 3.2,
        nameFill: st.text,
        techFill: techTok,
        ...skinOpts,
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
    const gl = nodeGlyph(n.kind, r.x + 14, r.y + r.h / 2 - 8, gc);
    const nx = gl.length > 0 ? r.x + 40 : r.x + 16;
    return (
      `<g${shadow}>` +
      back(2, 0.45) +
      back(1, 0.7) +
      `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="10" fill="${st.fill}" stroke="${st.accent}" stroke-width="${sw}"${dashA}/>` +
      gl +
      nodeLabels({
        name: n.name,
        ...tech,
        x: nx,
        boxY: r.y,
        boxH: r.h,
        textW: r.x + r.w - nx - 14,
        nameFill: st.text,
        techFill: techTok,
        ...skinOpts,
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
      `<g${shadow}>` +
      `<path d="${p}" fill="${st.fill}" stroke="${st.accent}" stroke-width="${sw}"${dashA} stroke-linejoin="round"/>` +
      nodeLabels({
        name: n.name,
        ...tech,
        x: r.x + r.w * 0.48,
        boxY: r.y + r.h * 0.34,
        boxH: r.h * 0.58,
        textW: r.w * 0.52,
        nameFill: st.text,
        techFill: techTok,
        ...skinOpts,
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
      `<g${shadow}>` +
      `<path d="${p}" fill="${st.fill}" stroke="${st.accent}" stroke-width="${sw}"${dashA} stroke-linejoin="round"/>` +
      nodeLabels({
        name: n.name,
        ...tech,
        x: cx,
        boxY: r.y,
        boxH: r.h,
        textW: r.w - inset * 2 - 6,
        nameFill: st.text,
        techFill: techTok,
        ...skinOpts,
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
      `<g${shadow}>` +
      `<path d="M${r.x} ${r.y + ry} A ${r.w / 2} ${ry} 0 0 1 ${r.x + r.w} ${r.y + ry} L ${r.x + r.w - tp} ${r.y + r.h - 6} A ${(r.w - tp * 2) / 2} 6 0 0 1 ${r.x + tp} ${r.y + r.h - 6} Z" fill="${st.fill}" stroke="${st.accent}" stroke-width="${sw}"${dashA}/>` +
      `<path d="M${r.x} ${r.y + ry} A ${r.w / 2} ${ry} 0 0 0 ${r.x + r.w} ${r.y + ry}" fill="none" stroke="${st.accent}" stroke-width="${sw}"${dashA}/>` +
      nodeLabels({
        name: n.name,
        ...tech,
        x: cx,
        boxY: r.y + ry * 2,
        boxH: r.h - ry * 2.6,
        textW: r.w - tp * 2 - 16,
        nameFill: st.text,
        techFill: techTok,
        ...skinOpts,
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
      `<g${shadow}>` +
      `<path d="M${r.x} ${r.y + ry} A ${rx} ${ry} 0 0 1 ${r.x + r.w} ${r.y + ry} V ${r.y + r.h - ry} A ${rx} ${ry} 0 0 1 ${r.x} ${r.y + r.h - ry} Z" fill="${st.fill}" stroke="${st.accent}" stroke-width="${sw}"${dashA}/>` +
      `<path d="M${r.x} ${r.y + ry} A ${rx} ${ry} 0 0 0 ${r.x + r.w} ${r.y + ry}" fill="none" stroke="${st.accent}" stroke-width="${sw}"${dashA}/>` +
      rim(ry + (r.h - ry * 2) * 0.42) +
      nodeLabels({
        name: n.name,
        ...tech,
        x: cx,
        boxY: r.y + ry * 2 + (r.h - ry * 2) * 0.3,
        boxH: r.h - ry * 2.6 - (r.h - ry * 2) * 0.3,
        textW: r.w - 30,
        nameFill: st.text,
        techFill: techTok,
        ...skinOpts,
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
        `<rect x="${r.x}" y="${sy.toFixed(1)}" width="${r.w}" height="${slabH.toFixed(1)}" rx="6" fill="${st.fill}" stroke="${st.accent}" stroke-width="${sw}"${dashA}/>` +
        `<circle cx="${r.x + 12}" cy="${(sy + slabH / 2).toFixed(1)}" r="2.4" fill="${gc}" opacity="0.8"/>` +
        `<path d="M${r.x + 20} ${(sy + slabH / 2).toFixed(1)} H ${r.x + 32}" stroke="${st.accent}" stroke-width="1.4" stroke-opacity="0.5"/>`;
    }
    return (
      `<g${shadow}>` +
      slabs +
      nodeLabels({
        name: n.name,
        ...tech,
        x: r.x + r.w / 2 + 10,
        boxY: r.y,
        boxH: r.h,
        textW: r.w - 84,
        nameFill: st.text,
        techFill: techTok,
        ...skinOpts,
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
      `<g${shadow}>` +
      `<path d="${p}" fill="${st.fill}" stroke="${st.accent}" stroke-width="${sw}"${dashA} stroke-linejoin="round"/>` +
      nodeLabels({
        name: n.name,
        ...tech,
        x: cx,
        boxY: r.y + r.h * 0.14,
        boxH: r.h * 0.62,
        textW: r.w * 0.6,
        nameFill: st.text,
        techFill: techTok,
        ...skinOpts,
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
      `<circle cx="${cx}" cy="${headCy.toFixed(1)}" r="${headR}" fill="${gc}"/>` +
      `<path d="M ${cx - headR * 1.8} ${shoulderY.toFixed(1)} a ${headR * 1.8} ${headR * 2} 0 0 1 ${headR * 3.6} 0 z" fill="${gc}"/>` +
      nodeLabels({
        name: n.name,
        ...tech,
        x: cx,
        boxY: shoulderY + 2,
        boxH: r.y + r.h - shoulderY - 2,
        textW: r.w - 12,
        nameFill: st.text,
        techFill: techTok,
        ...skinOpts,
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
      `<g${shadow}>` +
      `<path d="${p}" fill="${st.fill}" stroke="${st.accent}" stroke-width="${sw}"${dashA} stroke-linejoin="round"/>` +
      nodeLabels({
        name: n.name,
        ...tech,
        x: cx,
        boxY: r.y,
        boxH: r.h,
        textW: r.w - ic * 2 - 6,
        nameFill: st.text,
        techFill: techTok,
        ...skinOpts,
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
      `<g${shadow}>` +
      `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="${st.fill}" stroke="${st.accent}" stroke-width="${sw}"${dashA}/>` +
      `<text x="${cx}" y="${(cy - rad * 0.25).toFixed(1)}" font-family="Georgia, serif" font-size="${Math.max(15, rad * 0.42).toFixed(0)}" font-style="italic" font-weight="700" fill="${gc}" text-anchor="middle">ƒ</text>` +
      nodeLabels({
        name: n.name,
        ...tech,
        x: cx,
        boxY: cy - rad * 0.1,
        boxH: rad,
        textW: rad * 1.7,
        nameFill: st.text,
        techFill: techTok,
        ...skinOpts,
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
      `<g${shadow}>` +
      `<rect x="${r.x}" y="${r.y + 3}" width="${r.w}" height="${r.h - 3}" rx="9" fill="${st.fill}" stroke="${st.accent}" stroke-width="${sw}"${dashA}/>` +
      `<path d="M${r.x} ${r.y + 12} a 9 9 0 0 1 9 -9 H ${r.x + r.w - 9} a 9 9 0 0 1 9 9 V ${r.y + 3 + hh} H ${r.x} Z" fill="${gc}" fill-opacity="0.16"/>` +
      `<path d="M${r.x} ${r.y + 3 + hh} H ${r.x + r.w}" stroke="${st.accent}" stroke-width="1" stroke-opacity="0.5"/>` +
      ring(r.x + r.w * 0.3) +
      ring(r.x + r.w * 0.7) +
      `<circle cx="${ccx}" cy="${ccy}" r="${cr}" fill="var(--paper)" stroke="${st.accent}" stroke-width="1.4"/>` +
      `<path d="M${ccx} ${(ccy - cr * 0.55).toFixed(1)} V ${ccy} L ${(ccx + cr * 0.45).toFixed(1)} ${(ccy + cr * 0.3).toFixed(1)}" stroke="${st.accent}" stroke-width="1.4" fill="none" stroke-linecap="round"/>` +
      nodeLabels({
        name: n.name,
        ...tech,
        x: cx,
        boxY: r.y + 3 + hh,
        boxH: r.h - 3 - hh,
        textW: r.w - 40,
        nameFill: st.text,
        techFill: techTok,
        ...skinOpts,
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
      `<g${shadow}>` +
      `<path d="M${(cx - shR).toFixed(1)} ${(bodyY + 4).toFixed(1)} V ${(r.y + shR * 0.9 + 4).toFixed(1)} A ${shR.toFixed(1)} ${(shR * 0.95).toFixed(1)} 0 0 1 ${(cx + shR).toFixed(1)} ${(r.y + shR * 0.9 + 4).toFixed(1)} V ${(bodyY + 4).toFixed(1)}" fill="none" stroke="${st.accent}" stroke-width="4" stroke-linecap="round"/>` +
      `<rect x="${bx.toFixed(1)}" y="${bodyY.toFixed(1)}" width="${bw.toFixed(1)}" height="${bodyH.toFixed(1)}" rx="10" fill="${st.fill}" stroke="${st.accent}" stroke-width="${sw}"${dashA}/>` +
      nodeLabels({
        name: n.name,
        ...tech,
        x: cx,
        boxY: bodyY,
        boxH: bodyH,
        textW: bw - 18,
        nameFill: st.text,
        techFill: techTok,
        ...skinOpts,
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
      `<g${shadow}>` +
      cyls +
      nodeLabels({
        name: n.name,
        ...tech,
        x: cx,
        boxY: r.y + ch + 2,
        boxH: r.h - ch - 2,
        textW: r.w - 16,
        nameFill: st.text,
        techFill: techTok,
        ...skinOpts,
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
      `<g${shadow}>` +
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
        techFill: techTok,
        ...skinOpts,
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
        `<circle cx="${fx}" cy="${(fy + rr).toFixed(1)}" r="${rr.toFixed(1)}" fill="${gc}"/>` +
        `<path d="M ${(fx - rr * 1.7).toFixed(1)} ${(fy + rr * 2 + rr * 1.9).toFixed(1)} a ${(rr * 1.7).toFixed(1)} ${(rr * 1.9).toFixed(1)} 0 0 1 ${(rr * 3.4).toFixed(1)} 0 z" fill="${gc}"/>` +
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
        nameFill: st.text,
        techFill: techTok,
        ...skinOpts,
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
      `<circle cx="${cx}" cy="${gcy.toFixed(1)}" r="${rad}" fill="${st.fill}" stroke="${st.accent}" stroke-width="${sw}"${dashA}/>` +
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
        nameFill: st.text,
        techFill: techTok,
        ...skinOpts,
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
      `<g${shadow}>` +
      `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="10" fill="${st.fill}" stroke="${st.accent}" stroke-width="${sw}"${dashA}/>` +
      `<rect x="${px2}" y="${py}" width="${pw}" height="${ph}" rx="7" fill="var(--paper)" stroke="${st.accent}" stroke-width="${sw}"${dashA}/>` +
      `<path d="M${px2 + pw / 2 - 5} ${py + 6} H ${px2 + pw / 2 + 5}" stroke="${st.accent}" stroke-width="1.4" stroke-linecap="round"/>` +
      `<circle cx="${px2 + pw / 2}" cy="${py + ph - 7}" r="2" fill="${gc}"/>` +
      nodeLabels({
        name: n.name,
        ...tech,
        x: nx,
        boxY: r.y,
        boxH: r.h,
        textW: r.x + r.w - nx - 12,
        nameFill: st.text,
        techFill: techTok,
        ...skinOpts,
      }) +
      `</g>`
    );
  }
  if (shape === 'window') {
    // A browser window: rounded frame, header band with traffic dots.
    const hh = 18;
    const dot = (i: number): string =>
      `<circle cx="${r.x + 12 + i * 10}" cy="${r.y + hh / 2}" r="2.6" fill="${gc}" opacity="${0.85 - i * 0.2}"/>`;
    return (
      `<g${shadow}>` +
      `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="9" fill="${st.fill}" stroke="${st.accent}" stroke-width="${sw}"${dashA}/>` +
      `<path d="M${r.x} ${r.y + 9} a 9 9 0 0 1 9 -9 H ${r.x + r.w - 9} a 9 9 0 0 1 9 9 V ${r.y + hh} H ${r.x} Z" fill="${gc}" fill-opacity="0.14"/>` +
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
        techFill: techTok,
        ...skinOpts,
        anchor: 'middle',
      }) +
      `</g>`
    );
  }

  return cardBody(n, r, st);
}

/**
 * The clean card alone (rounded, glyph, no left bar). The layered band layout
 * uses this directly: its short bands crowd the taller kind silhouettes, so
 * every node stays a calm box there.
 */
function renderCardNode(
  n: {
    readonly kind?: string | undefined;
    readonly name: string;
    readonly tech?: string | undefined;
  },
  r: Rect,
  accent = false,
): string {
  const sk = nodeSkin(n.kind);
  const body = cardBody(n, r, skinPaint(sk, accent));
  const chip = chipFor('card', sk, r);
  return chip.length > 0 ? body.replace(/<\/g>$/, `${chip}</g>`) : body;
}

function cardBody(
  n: {
    readonly kind?: string | undefined;
    readonly name: string;
    readonly tech?: string | undefined;
  },
  r: Rect,
  st: Paint,
): string {
  const gc = st.legacy ? st.accent : 'var(--muted)';
  const gl = nodeGlyph(n.kind, r.x + 14, r.y + r.h / 2 - 8, gc);
  const nx = gl.length > 0 ? r.x + 40 : r.x + 16;
  const shadow = st.legacy ? ' filter="url(#gshadow)"' : '';
  const dashA = st.dashed ? ' stroke-dasharray="4 3"' : '';
  // With a chip in the top-left corner the label block centres in the space below it.
  const hasChip = !st.legacy && nodeSkin(n.kind).chip !== '';
  const boxY = hasChip ? r.y + 10 : r.y;
  const boxH = hasChip ? r.h - 10 : r.h;
  return (
    `<g${shadow}>` +
    `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="${st.legacy ? 10 : 6}" fill="${st.fill}" stroke="${st.accent}" stroke-width="${st.sw}"${dashA}/>` +
    gl +
    nodeLabels({
      name: n.name,
      ...(n.tech !== undefined ? { tech: n.tech } : {}),
      x: nx,
      boxY,
      boxH,
      textW: r.x + r.w - nx - 14,
      nameFill: st.text,
      techFill: st.legacy ? st.accent : 'var(--muted)',
      ...(st.legacy ? {} : { skin: true, accent: st.focal }),
    }) +
    `</g>`
  );
}

function renderGrid(data: Data, entry: readonly string[]): { svg: string; legend: string } {
  const groups = data.groups ?? [];
  const edges = data.edges ?? [];
  const rawNodes = data.nodes ?? [];
  // Quick mode: with no coordinate-anchored groups, nodes missing `col`/`row`
  // trigger auto-layout of the whole graph from the edges (left-to-right).
  // Groups are positioned by explicit grid ranges, so they require coordinates.
  const quick =
    groups.length === 0 &&
    !(rawNodes.length > 0 && rawNodes.every((n) => n.col !== undefined && n.row !== undefined));
  const nodes =
    groups.length === 0
      ? ensureGrid(rawNodes, edges, data.dir ?? 'LR')
      : rawNodes.map((n) => ({ ...n, col: n.col ?? 1, row: n.row ?? 1 }));
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
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const width = padX * 2 + cols * cellW + (cols - 1) * gapX;
  const height = padTop + rows * cellH + (rows - 1) * gapY + padBot;

  // Grid metadata for editors (Avodado Studio drag-to-move / drag-to-connect):
  // inert attributes mirroring the layout constants above plus each node's
  // EFFECTIVE cell — crucial in quick mode, where the placements only exist
  // post-auto-layout.
  const gridMeta = gridMetaAttrs({ quick, cols, rows, cellW, cellH, gapX, gapY, padX, padTop });

  let s = `<svg viewBox="0 0 ${width} ${height}" role="img"${gridMeta}><title>Block diagram</title>`;

  // Group panels (shared drawing across the grid diagrams).
  s += gridGroupsSvg(groups, { xOf, yOf, cellW, cellH, gapX, gapY, skin: true });

  const accentId = accentNodeId(nodes, entry);
  const edgeKinds = new Set<string>();
  const pending: EdgeLabelPoint[] = [];
  s += `<g${bl('edges')}>`;
  const lanes = edgeLanes(edges);
  const entries = entryPortOffsets(edges, (id) => {
    const n = byId.get(id);
    return n !== undefined ? edgeAnchorRect(n.kind, rectFor(n)) : undefined;
  });
  edges.forEach((e, ei) => {
    const A = byId.get(e.from);
    const B = byId.get(e.to);
    if (!A || !B) return;
    const p = ortho(edgeAnchorRect(A.kind, rectFor(A)), edgeAnchorRect(B.kind, rectFor(B)), lanes[ei] ?? 0, entries[ei] ?? 0);
    const kind = e.kind ?? 'solid';
    edgeKinds.add(kind in SKIN_EDGE ? kind : 'solid');
    const st = SKIN_EDGE[kind] ?? FALLBACK_EDGE;
    s += `<path d="${p.d}" fill="none" stroke="${st.stroke}" stroke-width="${st.sw}" stroke-dasharray="${st.dash}" marker-end="url(#${st.marker})"${bp(`edges.${ei}`)}/>`;
    pending.push({ lx: p.lx, ly: p.ly, ...(e.label !== undefined ? { label: e.label } : {}), err: st.err, path: `edges.${ei}` });
  });
  s += `</g>`; // close the edges list container

  s += `<g${bl('nodes')}>`;
  nodes.forEach((n, ni) => {
    const place = nodeCellAttrs(n.col ?? 1, n.row ?? 1, n.w ?? 1);
    s += `<g${bp(`nodes.${ni}`)}${place}>${renderShapedNode(n, rectFor(n), undefined, n.id === accentId)}</g>`;
  });
  s += `</g>`; // close the nodes list container

  const { overlay, legend } = edgeLabelLayer(pending, nodes.map((n) => rectFor(n)), { skin: true });
  s += overlay; // labels on top, never crossed by a line
  s += `</svg>`;
  return { svg: s + legend, legend: blockLegend(nodes, edgeKinds, accentId !== undefined) };
}

function renderLayered(data: Data, entry: readonly string[]): { svg: string; legend: string } {
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
    // The system boundary: a dashed hairline, the label as an eyebrow.
    `<rect x="${outerPad}" y="${outerPad}" width="${width - outerPad * 2}" height="${height - outerPad * 2}" rx="8" fill="none" stroke="var(--rule-solid)" stroke-width="1" stroke-dasharray="4 3"/>`;
  if (data.systemLabel !== undefined) {
    s += `<text x="${outerPad + 14}" y="${outerPad + 18}" class="grp-label t-eyebrow c-muted"${bp('systemLabel')}>${escapeHtml(data.systemLabel)}</text>`;
  }
  const accentId = accentNodeId(nodes, entry);
  const edgeKinds = new Set<string>();
  s += `<g${bl('layers')}>`;
  for (let i = 0; i < layers.length; i++) {
    const L = layers[i];
    if (L === undefined) continue;
    // An explicit layer colour is the author's data and tints the label and
    // outline; otherwise the band is the skin's paper-2 panel.
    const tint = safeColor(L.color, '');
    const stroke = tint.length > 0 ? tint : 'var(--rule-solid)';
    const text = tint.length > 0 ? tint : 'var(--soft)';
    // Wrap the band label (≤3 lines) so long names stay inside the label column.
    const lblLines = wrapText(L.label, Math.max(8, Math.floor((labelW - 24) / 6.8)), 3);
    const lblText = lblLines
      .map(
        (ln, j) =>
          `<text x="${innerX + 12}" y="${(bandY(i) + 16 + j * 12).toFixed(1)}" class="layer-label t-eyebrow" fill="${text}">${escapeHtml(ln)}</text>`,
      )
      .join('');
    s +=
      `<g${bp(`layers.${i}`)}>` +
      `<rect x="${innerX}" y="${bandY(i)}" width="${labelW + bandInnerW}" height="${bandH}" rx="6" fill="var(--paper-2)" fill-opacity="0.6" stroke="${stroke}" stroke-width="1"/>` +
      lblText +
      `</g>`;
  }
  s += `</g>`; // close the layers list container

  const pending: EdgeLabelPoint[] = [];
  s += `<g${bl('edges')}>`;
  const lanes = edgeLanes(edges);
  const entries = entryPortOffsets(edges, (id) => rects.get(id));
  edges.forEach((e, ei) => {
    const A = rects.get(e.from);
    const B = rects.get(e.to);
    if (!A || !B) return;
    const p = ortho(A, B, lanes[ei] ?? 0, entries[ei] ?? 0);
    const kind = e.kind ?? 'solid';
    edgeKinds.add(kind in SKIN_EDGE ? kind : 'solid');
    const st = SKIN_EDGE[kind] ?? FALLBACK_EDGE;
    s += `<path d="${p.d}" fill="none" stroke="${st.stroke}" stroke-width="${st.sw}" stroke-dasharray="${st.dash}" marker-end="url(#${st.marker})"${bp(`edges.${ei}`)}/>`;
    pending.push({ lx: p.lx, ly: p.ly, ...(e.label !== undefined ? { label: e.label } : {}), err: st.err, path: `edges.${ei}` });
  });
  s += `</g>`; // close the edges list container

  s += `<g${bl('nodes')}>`;
  nodes.forEach((n, ni) => {
    const r = rects.get(n.id);
    if (r === undefined) return;
    s += `<g${bp(`nodes.${ni}`)}>${renderCardNode(n, r, n.id === accentId)}</g>`;
  });
  s += `</g>`; // close the nodes list container

  const { overlay, legend } = edgeLabelLayer(pending, [...rects.values()], { skin: true });
  s += overlay; // labels on top, never crossed by a line
  s += `</svg>`;
  return { svg: s + legend, legend: blockLegend(nodes, edgeKinds, accentId !== undefined) };
}

function renderBlockGraph(data: Data, frame: FrameOpts): string {
  const { svg, legend } =
    data.layers !== undefined && data.layers.length > 0 ? renderLayered(data, frame.entry) : renderGrid(data, frame.entry);
  const opts: Parameters<typeof diagramFrame>[0] = {
    tag: frame.tag,
    ...(data.title !== undefined ? { title: data.title } : {}),
    ...(data.description !== undefined ? { desc: data.description } : {}),
    ...(legend.length > 0 ? { legendHtml: legend } : {}),
  };
  return diagramFrame(opts, svg);
}

/**
 * Eyebrow word + entry kinds per `preset` — the ONLY things that ever differed
 * between the former `block` / `infra` / `event` / `ddd` / `network` types.
 * No preset = the generic architecture look (the old bare `block`). The
 * presets keep their meaning through chips and dash, never hue.
 */
const PRESET_FRAME: Record<'arch' | NonNullable<Data['preset']>, FrameOpts> = {
  arch: { tag: 'ARCH', entry: ['gateway'] },
  infra: { tag: 'INFRA', entry: ['gateway'] },
  event: { tag: 'EVENT', entry: ['producer'] },
  ddd: { tag: 'DDD', entry: [] },
  network: { tag: 'ZONES', entry: ['gateway', 'firewall', 'waf', 'shield'] },
};

/** `block` block — generic architecture (grid or layered); `preset` picks the eyebrow + entry kind. */
export function renderBlock(data: BlockDataMap['block']): string {
  return renderBlockGraph(data, PRESET_FRAME[data.preset ?? 'arch']);
}
