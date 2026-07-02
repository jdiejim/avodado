/**
 * Renders a MECE (Mutually Exclusive, Collectively Exhaustive) issue tree —
 * a left-to-right hierarchical tree with depth-based colour stripes.
 *
 * Layout uses DFS positioning: leaves stack vertically, branches center over
 * their first/last child.
 *
 * Ported from doc-studio.jsx `MECETree` + `meceStyle`.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { wrapText } from '../svg/wrapText.js';
import { diagramFrame } from './frame.js';

type Node = NonNullable<BlockDataMap['mece']['nodes']>[number];

const CHART_COLORS = ['#0e54a1', '#1a6dbe', '#0f766e', '#1f9747', '#6b21a8', '#f7952c'];

interface MeceStyle {
  fill: string;
  text: string;
  accent: string;
  solid?: boolean;
}

function meceStyle(d: number): MeceStyle {
  if (d === 0) return { fill: '#0e54a1', text: '#fff', accent: '#0e54a1', solid: true };
  const c = CHART_COLORS[d % CHART_COLORS.length] ?? '#0e54a1';
  return { fill: '#fff', text: c, accent: c };
}

export function renderMece(data: BlockDataMap['mece']): string {
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

  const nodeW = 168;
  const nodeH = 50;
  const gapY = 16;
  const colGap = 56;
  const padX = 24;
  const padTop = 18;
  const padBot = 18;
  const xOf = (id: string): number => padX + (depth.get(id) ?? 0) * (nodeW + colGap);
  const yOf = (id: string): number => padTop + (pos.get(id) ?? 0) * (nodeH + gapY);
  const width = padX * 2 + (maxDepth + 1) * nodeW + maxDepth * colGap;
  const height = padTop + Math.max(leaf, 1) * (nodeH + gapY) - gapY + padBot;

  let s = `<svg viewBox="0 0 ${width} ${height}" role="img"><title>Issue tree</title>`;

  // links
  for (const n of nodes) {
    if (n.parent === undefined || !byId.has(n.parent) || !pos.has(n.id)) continue;
    const px = xOf(n.parent) + nodeW;
    const pcy = yOf(n.parent) + nodeH / 2;
    const cx = xOf(n.id);
    const ccy = yOf(n.id) + nodeH / 2;
    const midX = (px + cx) / 2;
    s += `<path class="tree-link" d="M ${px} ${pcy} H ${midX} V ${ccy} H ${cx}"/>`;
  }

  // nodes — wrap label to fit inside the box (max width ~150px, ~20 chars per line).
  // If a note is present, the label is single-line; otherwise allow up to two lines.
  for (const n of nodes) {
    if (!pos.has(n.id)) continue;
    const x = xOf(n.id);
    const y = yOf(n.id);
    const st = meceStyle(depth.get(n.id) ?? 0);
    const stroke = st.solid === true ? 'none' : st.accent;
    // Clean card (the agent-card language): rounded, no left accent bar.
    const stripe = '';
    const card = `<rect x="${x}" y="${y}" width="${nodeW}" height="${nodeH}" rx="6" fill="${st.fill}" stroke="${stroke}" stroke-width="1.3"/>`;
    const labelX = x + (st.solid === true ? nodeW / 2 : 14);
    const anchor = st.solid === true ? 'middle' : 'start';
    const lines = wrapText(n.label, st.solid === true ? 22 : 20, n.note !== undefined ? 1 : 2);
    const startY =
      lines.length === 2
        ? y + 22
        : y + (n.note !== undefined ? 22 : 30);
    const labelTexts = lines
      .map(
        (ln, j) =>
          `<text x="${labelX}" y="${startY + j * 14}" class="blk-name" fill="${st.text}" text-anchor="${anchor}">${escapeHtml(ln)}</text>`,
      )
      .join('');
    const note =
      n.note !== undefined
        ? `<text x="${labelX}" y="${y + 38}" class="ft-note" fill="${st.solid === true ? '#cfe0f3' : st.accent}" text-anchor="${anchor}">${escapeHtml(n.note)}</text>`
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
      tag: 'MECE',
      tagBg: '#0f766e',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
    },
    s,
  );
}
