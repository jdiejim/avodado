/**
 * Frontend / backend module-graph rendering — design-pattern nodes (engine,
 * interface, strategy, controller, service, repo, worker, middleware, model,
 * db, cache, queue, hook, store, external) with kind-specific styling and
 * UML stereotype banners on interface nodes.
 *
 * Backs `felogic` and `belogic` (same shape, different frame colour).
 *
 * Ported from doc-studio.jsx `FrontendLogic` + `feStyle` + `feEdge`.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { ortho } from '../svg/ortho.js';
import { edgePill } from '../svg/edgePill.js';
import { nodeGlyph } from '../svg/blockStyle.js';
import { rectRoundRight } from '../svg/shapes.js';
import { safeColor } from '../sanitize.js';
import { diagramFrame } from './frame.js';

type Data = BlockDataMap['felogic'];
type Group = NonNullable<Data['groups']>[number];
type Node = NonNullable<Data['nodes']>[number];

interface FeStyle {
  accent: string;
  fill: string;
  text: string;
  solid?: boolean;
  dash?: string;
  stereo?: string;
  cloud?: boolean;
}

function feStyle(kind: string | undefined): FeStyle {
  switch ((kind ?? 'component').toLowerCase()) {
    case 'engine':
    case 'core':
      return { accent: '#0e54a1', fill: '#0e54a1', text: '#fff', solid: true };
    case 'interface':
      return { accent: '#6b21a8', fill: '#fff', text: '#4a1772', dash: '5 4', stereo: 'interface' };
    case 'strategy':
    case 'adapter':
    case 'impl':
      return { accent: '#7c3aed', fill: '#ede9fe', text: '#4a1772' };
    case 'controller':
    case 'handler':
    case 'route':
      return { accent: '#0e54a1', fill: '#cfe0f3', text: '#0a3a6e' };
    case 'service':
    case 'usecase':
    case 'apiclient':
    case 'client':
      return { accent: '#1a6dbe', fill: '#e5eff8', text: '#0a3a6e' };
    case 'repository':
    case 'repo':
    case 'dao':
      return { accent: '#0f766e', fill: '#ccfbf1', text: '#0f4f49' };
    case 'worker':
    case 'consumer':
      return { accent: '#1f9747', fill: '#dcf1e2', text: '#0f3d22' };
    case 'middleware':
      return { accent: '#6b7280', fill: '#f3f4f6', text: '#374151' };
    case 'model':
    case 'entity':
      return { accent: '#6b21a8', fill: '#ede9fe', text: '#4a1772' };
    case 'db':
    case 'store':
    case 'database':
      return { accent: '#f7952c', fill: '#fde7cd', text: '#7a3d00' };
    case 'cache':
      return { accent: '#0891b2', fill: '#cffafe', text: '#0e4f5c' };
    case 'queue':
    case 'bus':
    case 'broker':
      return { accent: '#0f766e', fill: '#ccfbf1', text: '#0f4f49' };
    case 'state':
    case 'store_state':
      return { accent: '#f7952c', fill: '#fde7cd', text: '#7a3d00' };
    case 'hook':
      return { accent: '#7c3aed', fill: '#ede9fe', text: '#4a1772' };
    case 'external':
    case 'backend':
    case 'egress':
    case 'api':
    case 'thirdparty':
      return { accent: '#6b7280', fill: '#f3f4f6', text: '#374151', cloud: true };
    default:
      return { accent: '#1f9747', fill: '#dcf1e2', text: '#0f3d22' };
  }
}

interface FeEdgeStyle {
  stroke: string;
  sw: number;
  dash: string;
  marker: string;
}

function feEdge(kind: string | undefined): FeEdgeStyle {
  switch ((kind ?? 'uses').toLowerCase()) {
    case 'implements':
      return { stroke: '#6b21a8', sw: 1.4, dash: '5 4', marker: 'gTri' };
    case 'egress':
    case 'https':
    case 'api':
      return { stroke: '#0e54a1', sw: 2, dash: '', marker: 'gArrow' };
    case 'reads':
    case 'dashed':
    case 'async':
      return { stroke: '#6b7280', sw: 1.4, dash: '5 4', marker: 'gSoft' };
    default:
      return { stroke: '#1a1a2e', sw: 1.4, dash: '', marker: 'gArrow' };
  }
}

const GLYPH_KINDS = new Set([
  'db',
  'store',
  'database',
  'bucket',
  'blob',
  'object',
  'queue',
  'bus',
  'broker',
  'cache',
  'external',
  'backend',
  'api',
  'thirdparty',
  'function',
]);
const GLYPH_REMAP: Record<string, string> = {
  database: 'db',
  store: 'db',
  bus: 'queue',
  broker: 'queue',
  backend: 'external',
  api: 'external',
  thirdparty: 'external',
};

interface FrameOpts {
  readonly tag: string;
  readonly tagBg?: string;
}

function renderFelogicGraph(data: Data, frame: FrameOpts): string {
  const groups = data.groups ?? [];
  const nodes = data.nodes ?? [];
  const edges = data.edges ?? [];
  const cellW = 178;
  const cellH = 80;
  const gapX = 54;
  const gapY = 60;
  const padX = 26;
  const padTop = 30;
  const padBot = 20;
  const cols = Math.max(
    1,
    ...nodes.map((n) => n.col + ((n.w ?? 1) - 1)),
    ...groups.map((g) => g.col + (g.cols ?? 1) - 1),
  );
  const rows = Math.max(
    1,
    ...nodes.map((n) => n.row),
    ...groups.map((g) => g.row + (g.rows ?? 1) - 1),
  );
  const xOf = (c: number): number => padX + (c - 1) * (cellW + gapX);
  const yOf = (r: number): number => padTop + (r - 1) * (cellH + gapY);
  const rectFor = (n: Node): { x: number; y: number; w: number; h: number } => ({
    x: xOf(n.col),
    y: yOf(n.row),
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
  const sortedGroups = [...groups].sort(
    (a, b) => (b.cols ?? 1) * (b.rows ?? 1) - (a.cols ?? 1) * (a.rows ?? 1),
  );

  let s = `<svg viewBox="0 0 ${width} ${height}" role="img"><title>Module graph</title>`;

  for (const g of sortedGroups) {
    const r = groupRect(g);
    const col = safeColor(g.color, '#0e54a1');
    s +=
      `<g>` +
      `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="10" fill="${col}" fill-opacity="0.05" stroke="${col}" stroke-opacity="0.5" stroke-width="1.2" stroke-dasharray="7 5"/>` +
      `<text x="${r.x + 14}" y="${r.y + 15}" class="grp-label" fill="${col}">${escapeHtml(g.label)}</text>` +
      `</g>`;
  }

  const labels: string[] = [];
  for (const e of edges) {
    const A = byId.get(e.from);
    const B = byId.get(e.to);
    if (!A || !B) continue;
    const p = ortho(rectFor(A), rectFor(B));
    const st = feEdge(e.kind);
    s += `<path d="${p.d}" fill="none" stroke="${st.stroke}" stroke-width="${st.sw}" stroke-dasharray="${st.dash}" marker-end="url(#${st.marker})"/>`;
    labels.push(edgePill(p, e.label));
  }

  for (const n of nodes) {
    const r = rectFor(n);
    const st = feStyle(n.kind);
    const k = (n.kind ?? '').toLowerCase();
    const gl = GLYPH_KINDS.has(k) ? nodeGlyph(GLYPH_REMAP[k] ?? k, r.x + 16, r.y + 16, st.accent) : '';
    const nx = st.solid === true ? r.x + r.w / 2 : gl.length > 0 ? r.x + 42 : r.x + 16;
    const anchor = st.solid === true ? 'middle' : 'start';
    const nameY = r.y + (st.stereo !== undefined ? 38 : n.note !== undefined ? 36 : 44);
    const noteY = r.y + (st.stereo !== undefined ? 56 : 52);
    const stroke = st.solid === true ? 'none' : st.accent;
    const dashAttr = st.dash !== undefined ? ` stroke-dasharray="${st.dash}"` : '';
    const stripe =
      st.solid === true
        ? ''
        : `<rect x="${r.x}" y="${r.y}" width="5" height="${r.h}" fill="${st.accent}"/>`;
    // Striped cards get a square left edge so the stripe sits flush (no notch).
    const card =
      st.solid === true
        ? `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="9" fill="${st.fill}" stroke="${stroke}" stroke-width="1.2"${dashAttr}/>`
        : `<path d="${rectRoundRight(r.x, r.y, r.w, r.h, 9)}" fill="${st.fill}" stroke="${stroke}" stroke-width="1.2"${dashAttr}/>`;
    const stereo =
      st.stereo !== undefined
        ? `<text x="${r.x + r.w / 2}" y="${r.y + 20}" class="uml-stereo">«${escapeHtml(st.stereo)}»</text>`
        : '';
    const note =
      n.note !== undefined
        ? `<text x="${nx}" y="${noteY}" class="blk-tech" fill="${st.solid === true ? '#cfe0f3' : st.accent}" text-anchor="${anchor}">${escapeHtml(n.note)}</text>`
        : '';
    s +=
      `<g filter="url(#gshadow)">` +
      card +
      stripe +
      gl +
      stereo +
      `<text x="${nx}" y="${nameY}" class="blk-name" fill="${st.text}" text-anchor="${anchor}">${escapeHtml(n.name)}</text>` +
      note +
      `</g>`;
  }

  s += labels.join(''); // labels on top, never crossed by a line
  s += `</svg>`;
  return diagramFrame(
    {
      tag: frame.tag,
      ...(frame.tagBg !== undefined ? { tagBg: frame.tagBg } : {}),
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
    },
    s,
  );
}

/** `felogic` — frontend module graph (purple LOGIC tag). */
export function renderFelogic(data: BlockDataMap['felogic']): string {
  return renderFelogicGraph(data, { tag: 'LOGIC', tagBg: '#6b21a8' });
}
/** `belogic` — backend module graph (navy LOGIC tag). */
export function renderBelogic(data: BlockDataMap['belogic']): string {
  return renderFelogicGraph(data, { tag: 'LOGIC', tagBg: '#0e54a1' });
}
