/**
 * Renders a top-down component tree — typical React/Vue hierarchy. Each node
 * has a `kind` (root, layout, page, component, leaf, provider, hook, store)
 * shown as an eyebrow chip.
 *
 * Layout uses DFS positioning, children laid out left-to-right, parents
 * centered above their first/last child.
 *
 * Skin (`DESIGN.md`): a component is a paper card with an ink outline; a
 * `provider` / `context` is dashed (a boundary wrapping its subtree); `leaf`
 * and `store` / `state` sit on the inactive fill (nothing beneath them).
 * Tree links are `muted` hairlines.
 *
 * Accent rule: the tree's single root takes the accent. A forest (two or
 * more roots) has no accent.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { wrapText } from '../svg/wrapText.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';

type Node = NonNullable<BlockDataMap['frontend']['nodes']>[number];

interface FtSkin {
  readonly chip: string;
  readonly primary: boolean;
  readonly fill: 'paper' | 'paper-2';
  readonly dashed: boolean;
}

function ftSkin(kind: string | undefined): FtSkin {
  switch ((kind ?? 'component').toLowerCase()) {
    case 'root':
      return { chip: 'ROOT', primary: true, fill: 'paper', dashed: false };
    case 'layout':
      return { chip: 'LAYOUT', primary: true, fill: 'paper', dashed: false };
    case 'page':
      return { chip: 'PAGE', primary: true, fill: 'paper', dashed: false };
    case 'leaf':
      return { chip: 'LEAF', primary: false, fill: 'paper-2', dashed: false };
    case 'provider':
    case 'context':
      return { chip: 'PROVIDER', primary: true, fill: 'paper', dashed: true };
    case 'hook':
      return { chip: 'HOOK', primary: true, fill: 'paper', dashed: false };
    case 'store':
    case 'state':
      return { chip: 'STORE', primary: false, fill: 'paper-2', dashed: false };
    default:
      return { chip: '', primary: true, fill: 'paper', dashed: false };
  }
}

const CHIP_LABEL: Record<string, string> = {
  ROOT: 'root',
  LAYOUT: 'layout',
  PAGE: 'page',
  LEAF: 'leaf',
  PROVIDER: 'provider / context',
  HOOK: 'hook',
  STORE: 'store / state',
};

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
  const accentId = roots.length === 1 ? roots[0] : undefined;

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
    s += `<path d="M ${pcx} ${pby} V ${midY} H ${ccx} V ${cty}" fill="none" stroke="var(--muted)" stroke-width="1.25"/>`;
  }

  // nodes — wrap name to fit inside the box (~158px, ~20 chars per line).
  // With a note: single-line name. Without a note: up to two lines.
  const chipsUsed = new Set<string>();
  let dashedUsed = false;
  let inactiveUsed = false;
  s += `<g${bl('nodes')}>`;
  nodes.forEach((n, ni) => {
    if (!pos.has(n.id)) return;
    const x = xOf(n.id);
    const y = yOf(n.id);
    const sk = ftSkin(n.kind);
    const accent = n.id === accentId;
    if (sk.chip !== '') chipsUsed.add(sk.chip);
    if (sk.dashed) dashedUsed = true;
    if (sk.fill === 'paper-2') inactiveUsed = true;
    const stroke = accent ? 'var(--accent)' : sk.primary ? 'var(--ink)' : 'var(--rule-solid)';
    const sw = accent || sk.primary ? 1.5 : 1;
    const fill = accent ? 'var(--accent-tint)' : sk.fill === 'paper-2' ? 'var(--paper-2)' : 'var(--paper)';
    const dash = sk.dashed ? ' stroke-dasharray="4 3"' : '';
    const cardSvg = `<rect x="${x}" y="${y}" width="${nodeW}" height="${nodeH}" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dash}/>`;
    const chipTone = accent ? ' c-accent' : sk.fill === 'paper-2' ? ' c-muted' : '';
    const chip =
      sk.chip !== ''
        ? `<text x="${x + 12}" y="${y + 13}" class="t-eyebrow${chipTone}">${sk.chip}</text>`
        : '';
    const labelX = x + 12;
    const lines = wrapText(n.name, 19, n.note !== undefined ? 1 : 2);
    // Centre the name (+ note) block in the room below the chip.
    const top = sk.chip !== '' ? 18 : 8;
    const blockH = lines.length * 14 + (n.note !== undefined ? 14 : 0);
    const startY = y + top + (nodeH - top - blockH) / 2 + 11;
    const labelTexts = lines
      .map(
        (ln, j) =>
          `<text x="${labelX}" y="${(startY + j * 14).toFixed(1)}" class="t-name${accent ? ' c-accent' : ''}">${escapeHtml(ln)}</text>`,
      )
      .join('');
    const note =
      n.note !== undefined
        ? `<text x="${labelX}" y="${(startY + lines.length * 14).toFixed(1)}" class="t-sub">${escapeHtml(n.note)}</text>`
        : '';
    s += `<g${bp(`nodes.${ni}`)}>` + cardSvg + chip + labelTexts + note + `</g>`;
  });
  s += `</g>`; // close the nodes list container

  s += `</svg>`;

  const items: LegendItem[] = [];
  if (nodes.some((n) => ftSkin(n.kind).chip === '')) items.push({ swatch: 'node', label: 'component' });
  for (const chip of chipsUsed) items.push({ swatch: 'chip', chip, label: CHIP_LABEL[chip] ?? chip.toLowerCase() });
  if (dashedUsed) items.push({ swatch: 'node-dashed', label: 'wraps its subtree' });
  if (inactiveUsed) items.push({ swatch: 'node-fill2', label: 'leaf / store' });
  if (accentId !== undefined) items.push({ swatch: 'node-accent', label: 'tree root' });
  const legend = renderLegend(items);

  return diagramFrame(
    {
      tag: 'FE',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legend.length > 0 ? { legendHtml: legend } : {}),
    },
    s,
  );
}
