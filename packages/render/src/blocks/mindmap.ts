/**
 * Renders a `mindmap` block — a radial idea map: the `center` as a pill in
 * the middle, depth-1 branches fanning out right and left in turn, deeper
 * nodes hanging off their branch toward the outside.
 *
 * Layout is a tidy tree per side: every subtree takes as many rows as it
 * has leaves, so branches never overlap; a parent sits at the middle of its
 * first and last child. Columns are sized per depth from the longest label
 * in that column, so a long branch name never runs into its children.
 *
 * Skin (`DESIGN.md`): the centre is a paper pill with an ink outline; branch
 * lines are `muted` curves and a node's label sits on a hairline in the
 * branch's tone. A branch `accent` is the author's colour-coding: `red` is
 * `negative`; one flagged branch takes the accent; two or more take the
 * series ramp in branch order, the way a chart tells its series apart.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { seriesColor } from '../svg/dsTone.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { countPhrase, svgName } from '../svg/svgTitle.js';
import { wrapText } from '../svg/wrapText.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';

type Node = BlockDataMap['mindmap']['nodes'][number];

const CHARS_PER_LINE = 24;
const CHAR_W = 7;
const LINE_H = 15;
const NOTE_H = 14;
const ROW_GAP = 10;
const BRANCH_GAP = 12;
const COL_GAP = 40;
const CENTER_H = 36;
const PAD = 24;

interface Laid {
  readonly node: Node;
  readonly index: number;
  readonly depth: number;
  readonly side: 1 | -1;
  readonly branch: number;
  readonly lines: string[];
  readonly w: number;
  y: number;
}

/** The tone of branch `k` (0-based among the flagged branches). */
function branchTone(accent: string | undefined, flaggedIndex: number, flagged: number): string {
  if (accent === 'red') return 'var(--negative)';
  if (accent === undefined) return 'var(--muted)';
  if (flagged === 1) return 'var(--accent)';
  return seriesColor(flaggedIndex, flagged);
}

export function renderMindmap(data: BlockDataMap['mindmap']): string {
  const nodes = data.nodes;
  const byId = new Map<string, number>();
  nodes.forEach((n, i) => byId.set(n.id, i));
  const children = new Map<number, number[]>();
  const roots: number[] = [];
  nodes.forEach((n, i) => {
    const p = n.parent !== undefined ? byId.get(n.parent) : undefined;
    if (p === undefined || p === i) roots.push(i);
    else children.set(p, [...(children.get(p) ?? []), i]);
  });

  // Tones: the author's per-branch colour-coding, resolved once per root.
  const flaggedRoots = roots.filter((r) => nodes[r]?.accent !== undefined && nodes[r]?.accent !== 'red');
  const toneOf = new Map<number, string>();
  roots.forEach((r) => {
    const a = nodes[r]?.accent;
    toneOf.set(r, branchTone(a, flaggedRoots.indexOf(r), flaggedRoots.length));
  });

  const laid: Laid[] = [];
  const seen = new Set<number>();
  const rowH = (l: Laid): number => l.lines.length * LINE_H + (l.node.note !== undefined ? NOTE_H : 0) + ROW_GAP;
  /** Lays a subtree out from row `y0` (px); returns the rows it consumed. */
  const layout = (i: number, depth: number, side: 1 | -1, branch: number, y0: number): number => {
    if (seen.has(i)) return 0;
    seen.add(i);
    const node = nodes[i];
    if (node === undefined) return 0;
    const lines = wrapText(node.label, CHARS_PER_LINE, 2);
    const w = Math.max(24, ...lines.map((ln) => ln.length * CHAR_W), (node.note !== undefined ? Math.min(node.note.length, CHARS_PER_LINE + 4) * 5.6 : 0));
    const me: Laid = { node, index: i, depth, side, branch, lines, w, y: y0 };
    laid.push(me);
    const kids = children.get(i) ?? [];
    if (kids.length === 0) return rowH(me);
    let used = 0;
    const kidLaid: Laid[] = [];
    for (const k of kids) {
      const at = laid.length;
      used += layout(k, depth + 1, side, branch, y0 + used);
      const kl = laid[at];
      if (kl !== undefined && kl.index === k) kidLaid.push(kl);
    }
    const own = rowH(me);
    if (used < own) used = own;
    const first = kidLaid[0];
    const last = kidLaid[kidLaid.length - 1];
    me.y = first !== undefined && last !== undefined ? (first.y + last.y) / 2 : y0;
    return used;
  };

  // Branches alternate right / left; each side stacks its subtrees.
  let hRight = 0;
  let hLeft = 0;
  roots.forEach((r, bi) => {
    const side: 1 | -1 = bi % 2 === 0 ? 1 : -1;
    const start = side === 1 ? hRight : hLeft;
    const used = layout(r, 1, side, bi, start + (start > 0 ? BRANCH_GAP : 0));
    if (side === 1) hRight += used + (start > 0 ? BRANCH_GAP : 0);
    else hLeft += used + (start > 0 ? BRANCH_GAP : 0);
  });

  // Column widths per depth and side, from the longest label in the column.
  const colW = (side: 1 | -1, depth: number): number =>
    Math.max(0, ...laid.filter((l) => l.side === side && l.depth === depth).map((l) => l.w));
  const maxDepth = Math.max(1, ...laid.map((l) => l.depth));
  const extent = (side: 1 | -1): number => {
    let x = 0;
    for (let d = 1; d <= maxDepth; d++) {
      const w = colW(side, d);
      if (w > 0) x += COL_GAP + w;
    }
    return x;
  };
  const centerLines = wrapText(data.center, CHARS_PER_LINE, 2);
  const centerW = Math.max(60, ...centerLines.map((ln) => ln.length * 7.5)) + 28;
  const centerH = centerLines.length > 1 ? CENTER_H + LINE_H : CENTER_H;
  const leftW = extent(-1);
  const rightW = extent(1);
  const bodyH = Math.max(hRight, hLeft, centerH);
  const width = PAD * 2 + leftW + centerW + rightW;
  const height = PAD * 2 + bodyH;
  const cx = PAD + leftW + centerW / 2;
  const cy = PAD + bodyH / 2;
  // Each side's stack is centred on the centre pill.
  const yOff = (side: 1 | -1): number => cy - (side === 1 ? hRight : hLeft) / 2;

  /** The x where a node's label starts (right side) or ends (left side). */
  const anchorX = (l: Laid): number => {
    let x = centerW / 2;
    for (let d = 1; d < l.depth; d++) {
      const w = colW(l.side, d);
      if (w > 0) x += COL_GAP + w;
    }
    x += COL_GAP;
    return cx + l.side * x;
  };
  const rowMid = (l: Laid): number => yOff(l.side) + l.y + (l.lines.length * LINE_H) / 2;
  const r = (v: number): number => Math.round(v * 10) / 10;

  const a11y = svgName('Mind map', data.center, [countPhrase(roots.length, 'branch'), countPhrase(nodes.length, 'node')]);
  let s = `<svg viewBox="0 0 ${r(width)} ${r(height)}"${a11y.attrs}>${a11y.title}`;

  // Connectors, beneath the labels.
  s += `<g fill="none" stroke-width="1.5" data-decorative="1">`;
  for (const l of laid) {
    const tone = toneOf.get(l.branch) ?? 'var(--muted)';
    const x1 = anchorX(l) - l.side * 6;
    const y1 = rowMid(l) + (l.lines.length * LINE_H) / 2 + 2;
    let x0: number;
    let y0: number;
    if (l.depth === 1) {
      x0 = cx + l.side * (centerW / 2);
      y0 = cy;
    } else {
      const p = laid.find((q) => q.index === byId.get(l.node.parent ?? ''));
      if (p === undefined) continue;
      x0 = anchorX(p) + l.side * (p.w + 6);
      y0 = rowMid(p) + (p.lines.length * LINE_H) / 2 + 2;
    }
    const qx = x0 + (x1 - x0) * 0.5;
    s += `<path d="M${r(x0)} ${r(y0)} Q${r(qx)} ${r(y1)} ${r(x1)} ${r(y1)}" stroke="${tone}"/>`;
    // The label sits on a hairline in the branch tone.
    s += `<line x1="${r(x1)}" y1="${r(y1)}" x2="${r(x1 + l.side * (l.w + 12))}" y2="${r(y1)}" stroke="${tone}" stroke-width="${l.depth === 1 ? 1.5 : 1}"/>`;
  }
  s += `</g>`;

  // The centre pill.
  s += `<g${bp('center')}><rect x="${r(cx - centerW / 2)}" y="${r(cy - centerH / 2)}" width="${r(centerW)}" height="${centerH}" rx="${centerH / 2}" fill="var(--paper)" stroke="var(--ink)" stroke-width="1.5"/>`;
  centerLines.forEach((ln, li) => {
    s += `<text x="${r(cx)}" y="${r(cy + 4.5 - ((centerLines.length - 1) * LINE_H) / 2 + li * LINE_H)}" class="t-name" text-anchor="middle">${escapeHtml(ln)}</text>`;
  });
  s += `</g>`;

  // Labels.
  s += `<g${bl('nodes')}>`;
  for (const l of laid) {
    const tone = toneOf.get(l.branch) ?? 'var(--muted)';
    const x = anchorX(l);
    const top = yOff(l.side) + l.y;
    const anchor = l.side === 1 ? 'start' : 'end';
    const fill = tone !== 'var(--muted)' ? ` style="fill:${tone}"` : '';
    let g = `<g${bp(`nodes.${l.index}`)}>`;
    l.lines.forEach((ln, li) => {
      g += `<text x="${r(x)}" y="${r(top + 11 + li * LINE_H)}" class="t-name" text-anchor="${anchor}"${fill}>${escapeHtml(ln)}</text>`;
    });
    if (l.node.note !== undefined) {
      const note = wrapText(l.node.note, CHARS_PER_LINE + 4, 1)[0] ?? '';
      const title = note !== l.node.note ? `<title>${escapeHtml(l.node.note)}</title>` : '';
      g += `<text x="${r(x)}" y="${r(top + l.lines.length * LINE_H + 13)}" class="t-sub c-soft" text-anchor="${anchor}"${bp(`nodes.${l.index}.note`)}>${title}${escapeHtml(note)}</text>`;
    }
    g += `</g>`;
    s += g;
  }
  s += `</g></svg>`;

  // A legend only when the branches are colour-coded: one entry per tone.
  const items: LegendItem[] = [];
  const tones = new Set<string>();
  for (const rt of roots) {
    const tone = toneOf.get(rt) ?? 'var(--muted)';
    if (tone === 'var(--muted)' || tones.has(tone)) continue;
    tones.add(tone);
    items.push({ swatch: 'line', stroke: tone, label: nodes[rt]?.label ?? '', path: `nodes.${rt}` });
  }
  const legend = renderLegend(items);

  return diagramFrame(
    {
      tag: 'MIND MAP',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legend.length > 0 ? { legendHtml: legend } : {}),
    },
    s,
  );
}
