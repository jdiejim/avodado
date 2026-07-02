/**
 * Renders a top-down component tree — typical React/Vue hierarchy. Each node
 * has a `kind` (root, layout, page, component, leaf, provider, hook, store)
 * that drives its colour.
 *
 * Layout uses DFS positioning, children laid out left-to-right, parents
 * centered above their first/last child.
 *
 * Ported from doc-studio.jsx `ComponentTree` + `ftStyle`.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { wrapText } from '../svg/wrapText.js';
import { diagramFrame } from './frame.js';

type Node = NonNullable<BlockDataMap['frontend']['nodes']>[number];

interface FtStyle {
  accent: string;
  fill: string;
  text: string;
  solid?: boolean;
}

function ftStyle(kind: string | undefined): FtStyle {
  switch ((kind ?? 'component').toLowerCase()) {
    case 'root':
      return { accent: '#0e54a1', fill: '#0e54a1', text: '#fff', solid: true };
    case 'layout':
      return { accent: '#0f766e', fill: '#ccfbf1', text: '#0f4f49' };
    case 'page':
      return { accent: '#0e54a1', fill: '#e5eff8', text: '#0a3a6e' };
    case 'component':
      return { accent: '#1f9747', fill: '#dcf1e2', text: '#0f3d22' };
    case 'leaf':
      return { accent: '#6b7280', fill: '#f3f4f6', text: '#374151' };
    case 'provider':
    case 'context':
      return { accent: '#6b21a8', fill: '#ede9fe', text: '#4a1772' };
    case 'hook':
      return { accent: '#7c3aed', fill: '#ede9fe', text: '#4a1772' };
    case 'store':
    case 'state':
      return { accent: '#f7952c', fill: '#fde7cd', text: '#7a3d00' };
    default:
      return { accent: '#1f9747', fill: '#dcf1e2', text: '#0f3d22' };
  }
}

export function renderFrontend(data: BlockDataMap['frontend']): string {
  const nodes = data.nodes ?? [];
  const byId = new Map<string, Node>();
  const children = new Map<string, string[]>();
  for (const n of nodes) {
    byId.set(n.id, n);
    children.set(n.id, []);
  }
  const roots: string[] = [];
  for (const n of nodes) {
    if (n.parent !== undefined && byId.has(n.parent)) children.get(n.parent)?.push(n.id);
    else roots.push(n.id);
  }

  const pos = new Map<string, number>();
  const depth = new Map<string, number>();
  const seen = new Set<string>();
  let leaf = 0;
  let maxDepth = 0;
  const dfs = (id: string, d: number): void => {
    if (seen.has(id)) return;
    seen.add(id);
    depth.set(id, d);
    if (d > maxDepth) maxDepth = d;
    const ch = children.get(id) ?? [];
    if (ch.length === 0) {
      pos.set(id, leaf);
      leaf += 1;
    } else {
      for (const c of ch) dfs(c, d + 1);
      const first = pos.get(ch[0] ?? '') ?? 0;
      const last = pos.get(ch[ch.length - 1] ?? '') ?? 0;
      pos.set(id, (first + last) / 2);
    }
  };
  for (const r of roots) dfs(r, 0);

  const nodeW = 158;
  const nodeH = 56;
  const gapX = 24;
  const levelGap = 96;
  const padX = 24;
  const padTop = 18;
  const padBot = 18;
  const slot = Math.max(leaf, 1);
  const xOf = (id: string): number => padX + (pos.get(id) ?? 0) * (nodeW + gapX);
  const yOf = (id: string): number => padTop + (depth.get(id) ?? 0) * levelGap;
  const width = padX * 2 + slot * (nodeW + gapX) - gapX;
  const height = padTop + maxDepth * levelGap + nodeH + padBot;

  let s = `<svg viewBox="0 0 ${width} ${height}" role="img"><title>Component tree</title>`;

  // links
  for (const n of nodes) {
    if (n.parent === undefined || !byId.has(n.parent) || !pos.has(n.id)) continue;
    const pcx = xOf(n.parent) + nodeW / 2;
    const pby = yOf(n.parent) + nodeH;
    const ccx = xOf(n.id) + nodeW / 2;
    const cty = yOf(n.id);
    const midY = (pby + cty) / 2;
    s += `<path class="tree-link" d="M ${pcx} ${pby} V ${midY} H ${ccx} V ${cty}"/>`;
  }

  // nodes — wrap name to fit inside the box (~158px, ~20 chars per line).
  // With a note: single-line name. Without a note: up to two lines.
  for (const n of nodes) {
    if (!pos.has(n.id)) continue;
    const x = xOf(n.id);
    const y = yOf(n.id);
    const st = ftStyle(n.kind);
    const stroke = st.solid === true ? 'none' : st.accent;
    // Clean card (the agent-card language): rounded, no left accent bar.
    const stripe = '';
    const card = `<rect x="${x}" y="${y}" width="${nodeW}" height="${nodeH}" rx="8" fill="${st.fill}" stroke="${stroke}" stroke-width="1.2"/>`;
    const labelX = x + (st.solid === true ? nodeW / 2 : 14);
    const anchor = st.solid === true ? 'middle' : 'start';
    const lines = wrapText(n.name, st.solid === true ? 20 : 18, n.note !== undefined ? 1 : 2);
    const startY =
      lines.length === 2
        ? y + 25
        : y + (n.note !== undefined ? 25 : 33);
    const labelTexts = lines
      .map(
        (ln, j) =>
          `<text x="${labelX}" y="${startY + j * 14}" class="blk-name" fill="${st.text}" text-anchor="${anchor}">${escapeHtml(ln)}</text>`,
      )
      .join('');
    const note =
      n.note !== undefined
        ? `<text x="${labelX}" y="${y + 41}" class="ft-note" fill="${st.solid === true ? '#cfe0f3' : st.accent}" text-anchor="${anchor}">${escapeHtml(n.note)}</text>`
        : '';
    s +=
      `<g filter="url(#gshadow)">` +
      card +
      stripe +
      labelTexts +
      note +
      `</g>`;
  }

  s += `</svg>`;
  return diagramFrame(
    {
      tag: 'FE',
      tagBg: '#0f766e',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
    },
    s,
  );
}
