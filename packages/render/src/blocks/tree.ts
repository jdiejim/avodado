/**
 * Renders a `tree` block — an indented hierarchy of nodes, like a folder
 * tree. Nodes are linked via `parent` id. Roots are nodes without a `parent`
 * (or whose parent id is unknown). Children are indented based on depth.
 *
 * `variant: issue` (the former `mece` type) renders a MECE issue tree
 * instead — a left-to-right hierarchical SVG tree with depth-based colour
 * stripes, inside the diagram frame. Layout uses DFS positioning: leaves
 * stack vertically, branches center over their first/last child.
 *
 * `variant: org` renders a top-down org chart — tidy subtree-width packing,
 * parents centered over their children, node `role` muted under the label.
 *
 * Ported from doc-studio.jsx `Tree` + `MECETree`/`meceStyle`.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { wrapText } from '../svg/wrapText.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';

type TreeData = BlockDataMap['tree'];
type Node = NonNullable<TreeData['nodes']>[number];

// ─── variant: issue (MECE issue tree — the former `mece` type) ───────────────

const ISSUE_COLORS = ['#0e54a1', '#1a6dbe', '#0f766e', '#1f9747', '#6b21a8', '#f7952c'];

interface IssueStyle {
  fill: string;
  text: string;
  accent: string;
  solid?: boolean;
}

function issueStyle(d: number): IssueStyle {
  if (d === 0) return { fill: '#0e54a1', text: '#fff', accent: '#0e54a1', solid: true };
  const c = ISSUE_COLORS[d % ISSUE_COLORS.length] ?? '#0e54a1';
  return { fill: '#fff', text: c, accent: c };
}

function renderIssueTree(data: TreeData): string {
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
  s += `<g${bl('nodes')}>`;
  nodes.forEach((n, ni) => {
    if (!pos.has(n.id)) return;
    const x = xOf(n.id);
    const y = yOf(n.id);
    const st = issueStyle(depth.get(n.id) ?? 0);
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
      `<g filter="url(#gshadow)"${bp(`nodes.${ni}`)}>` +
      card +
      stripe +
      labelTexts +
      note +
      `</g>`;
  });
  s += `</g>`; // close the nodes list container

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

// ─── variant: org (top-down org chart) ───────────────────────────────────────
// Tidy top-down layout: a leaf takes one slot, a branch takes the sum of its
// children's slots, and every parent is centered over its children — so a
// wide level packs without overlap and the viewBox simply grows. Nodes are
// rounded cards: label bold (wrapped to two lines, ellipsized past that, the
// full text in <title>), `role` muted underneath. Links are vertical elbows.
// The root card is solid navy; every other card stays a calm white — an org
// chart is not the place for the bright issue-tree stripes.

const ORG_W = 148;
const ORG_H = 58;
const ORG_HGAP = 18;
const ORG_VGAP = 34;
const ORG_SLOT = ORG_W + ORG_HGAP;
const ORG_LABEL_CHARS = 20;
const ORG_ROLE_CHARS = 24;
// A parent with more than this many LEAF children stacks those leaves in up
// to two columns under itself — a wide rank stays readable instead of
// stretching the viewBox until every name scales away.
const ORG_STACK_MAX = 6;
const ORG_STACK_GAP = 26; // corridor between the two stacked columns (trunk)
const ORG_STACK_VGAP = 10; // vertical gap between stacked rows

/**
 * Caps one wrapped line so an unbroken word can never overflow the card —
 * cutting at the last word boundary when one exists past the halfway mark.
 */
function orgClip(line: string, max: number): string {
  if (line.length <= max) return line;
  const head = line.slice(0, max - 1);
  const sp = head.lastIndexOf(' ');
  return `${sp > max / 2 ? head.slice(0, sp) : head}…`;
}

function renderOrgTree(data: TreeData): string {
  const nodes = data.nodes ?? [];
  const byId = new Map<string, Node>();
  const children = new Map<string, string[]>();
  for (const n of nodes) {
    byId.set(n.id, n);
    children.set(n.id, []);
  }
  // A node whose parent id is unknown renders as a root — never a throw.
  const roots: string[] = [];
  for (const n of nodes) {
    if (n.parent !== undefined && byId.has(n.parent)) children.get(n.parent)?.push(n.id);
    else roots.push(n.id);
  }

  // The stacking rule: a parent with more than ORG_STACK_MAX leaf children
  // (leaf = no children of its own) stacks those leaves in up to two columns
  // under itself. Branch children keep their normal recursive slots.
  const isLeaf = (id: string): boolean => (children.get(id) ?? []).length === 0;
  const stackOf = (id: string): { leaves: string[]; branches: string[] } | undefined => {
    const ch = children.get(id) ?? [];
    const leaves = ch.filter((c) => isLeaf(c));
    if (leaves.length <= ORG_STACK_MAX) return undefined;
    return { leaves, branches: ch.filter((c) => !isLeaf(c)) };
  };
  const STACK_W = ORG_W * 2 + ORG_STACK_GAP + ORG_HGAP;

  // Pass 1 — subtree widths (in px, each including its trailing gap).
  const widths = new Map<string, number>();
  const measuring = new Set<string>();
  const widthOf = (id: string): number => {
    const known = widths.get(id);
    if (known !== undefined) return known;
    if (measuring.has(id)) return ORG_SLOT; // cycle guard
    measuring.add(id);
    const stack = stackOf(id);
    const ch = children.get(id) ?? [];
    const w =
      stack !== undefined
        ? Math.max(ORG_SLOT, stack.branches.reduce((a, c) => a + widthOf(c), 0) + STACK_W)
        : ch.length === 0
          ? ORG_SLOT
          : Math.max(ORG_SLOT, ch.reduce((a, c) => a + widthOf(c), 0));
    measuring.delete(id);
    widths.set(id, w);
    return w;
  };

  // Pass 2 — x centers (parents centered over first/last child) + y tops.
  const cx = new Map<string, number>();
  const yTop = new Map<string, number>();
  const depth = new Map<string, number>();
  const seen = new Set<string>();
  const stackedLeaf = new Set<string>();
  const trunks: Array<{ parent: string; trunkX: number }> = [];
  let maxBottom = 0;
  const place = (id: string, left: number, y: number, d: number): void => {
    if (seen.has(id)) return;
    seen.add(id);
    depth.set(id, d);
    yTop.set(id, y);
    if (y + ORG_H > maxBottom) maxBottom = y + ORG_H;
    const ch = children.get(id) ?? [];
    if (ch.length === 0) {
      cx.set(id, left + ORG_SLOT / 2);
      return;
    }
    const rowY = y + ORG_H + ORG_VGAP;
    const stack = stackOf(id);
    if (stack !== undefined) {
      const totalW = stack.branches.reduce((a, c) => a + widthOf(c), 0) + STACK_W;
      let cur = left + (widthOf(id) - totalW) / 2;
      for (const c of stack.branches) {
        place(c, cur, rowY, d + 1);
        cur += widthOf(c);
      }
      // Two columns astride the trunk corridor, rows growing downward.
      const trunkX = cur + (STACK_W - ORG_HGAP) / 2;
      stack.leaves.forEach((leaf, i) => {
        if (seen.has(leaf)) return;
        seen.add(leaf);
        depth.set(leaf, d + 1);
        stackedLeaf.add(leaf);
        const col = i % 2;
        const row = Math.floor(i / 2);
        const ly = rowY + row * (ORG_H + ORG_STACK_VGAP);
        yTop.set(leaf, ly);
        if (ly + ORG_H > maxBottom) maxBottom = ly + ORG_H;
        cx.set(
          leaf,
          col === 0
            ? trunkX - ORG_STACK_GAP / 2 - ORG_W / 2
            : trunkX + ORG_STACK_GAP / 2 + ORG_W / 2,
        );
      });
      trunks.push({ parent: id, trunkX });
      const first = stack.branches.length > 0 ? (cx.get(stack.branches[0] ?? '') ?? trunkX) : trunkX;
      cx.set(id, (first + trunkX) / 2);
      return;
    }
    // Children of a narrow parent still center under it.
    const kidsW = ch.reduce((a, c) => a + widthOf(c), 0);
    let cur = left + (widthOf(id) - kidsW) / 2;
    for (const c of ch) {
      place(c, cur, rowY, d + 1);
      cur += widthOf(c);
    }
    const first = cx.get(ch[0] ?? '') ?? 0;
    const last = cx.get(ch[ch.length - 1] ?? '') ?? 0;
    cx.set(id, (first + last) / 2);
  };
  const padX = 16;
  const padY = 16;
  let cursor = padX;
  for (const r of roots) {
    place(r, cursor, padY, 0);
    cursor += widthOf(r);
  }

  const width = Math.max(cursor - ORG_HGAP + padX, padX * 2 + ORG_W);
  const height = maxBottom + padY;
  const xOf = (id: string): number => Math.round(((cx.get(id) ?? 0) - ORG_W / 2) * 10) / 10;
  const yOf = (id: string): number => yTop.get(id) ?? padY;

  let s = `<svg viewBox="0 0 ${width} ${height}" role="img"><title>Org chart</title>`;

  // Vertical parent→child elbows, drawn under the cards. Stacked leaves get
  // their trunk-and-stub connectors below instead.
  for (const n of nodes) {
    if (n.parent === undefined || !byId.has(n.parent) || !cx.has(n.id) || stackedLeaf.has(n.id))
      continue;
    const px = Math.round(((cx.get(n.parent) ?? 0)) * 10) / 10;
    const py = yOf(n.parent) + ORG_H;
    const chx = Math.round(((cx.get(n.id) ?? 0)) * 10) / 10;
    const chy = yOf(n.id);
    const midY = py + ORG_VGAP / 2;
    s += `<path class="tree-link" d="M ${px} ${py} V ${midY} H ${chx} V ${chy}"/>`;
  }

  // Stacked groups: one trunk down the corridor, a short stub to each card.
  for (const t of trunks) {
    const kids = (children.get(t.parent) ?? []).filter((c) => stackedLeaf.has(c));
    const py = yOf(t.parent) + ORG_H;
    const tx = Math.round(t.trunkX * 10) / 10;
    let bottom = py;
    let stubs = '';
    for (const c of kids) {
      const cyMid = yOf(c) + ORG_H / 2;
      if (cyMid > bottom) bottom = cyMid;
      const ccx = cx.get(c) ?? 0;
      const edgeX = Math.round((ccx < t.trunkX ? ccx + ORG_W / 2 : ccx - ORG_W / 2) * 10) / 10;
      stubs += `<path class="tree-link" d="M ${tx} ${cyMid} H ${edgeX}"/>`;
    }
    const pcx = Math.round((cx.get(t.parent) ?? 0) * 10) / 10;
    s += `<path class="tree-link" d="M ${pcx} ${py} V ${py + ORG_VGAP / 2} H ${tx} V ${bottom}"/>` + stubs;
  }

  s += `<g${bl('nodes')}>`;
  nodes.forEach((n, ni) => {
    if (!cx.has(n.id)) return;
    const x = xOf(n.id);
    const y = yOf(n.id);
    const solid = (depth.get(n.id) ?? 0) === 0;
    const fill = solid ? '#0e54a1' : '#fff';
    const stroke = solid ? 'none' : '#b8c4d4';
    const labelFill = solid ? '#fff' : 'var(--charcoal)';
    const roleFill = solid ? '#cfe0f3' : 'var(--gray)';
    const hasRole = n.role !== undefined && n.role !== '';
    const rawLines = wrapText(n.label, ORG_LABEL_CHARS, 2);
    const lines = rawLines.map((ln) => orgClip(ln, ORG_LABEL_CHARS + 2));
    const truncated =
      lines.join(' ').length < String(n.label).trim().replace(/\s+/g, ' ').length;
    if (truncated && lines.length > 0) {
      // The cut is visible on the card, not only in the <title>.
      const last = lines[lines.length - 1] ?? '';
      lines[lines.length - 1] = last.endsWith('…') ? last : orgClip(`${last}…`, ORG_LABEL_CHARS + 2);
    }
    const two = lines.length === 2;
    const labelStart = hasRole ? (two ? y + 19 : y + 25) : two ? y + 25 : y + 33;
    const roleY = two ? y + 49 : y + 43;
    const midX = x + ORG_W / 2;
    const labelSvg = lines
      .map(
        (ln, j) =>
          `<text x="${midX}" y="${labelStart + j * 14}" class="blk-name" fill="${labelFill}" text-anchor="middle"${j === 0 ? bp(`nodes.${ni}.label`) : ''}>${escapeHtml(ln)}</text>`,
      )
      .join('');
    const role = hasRole
      ? `<text x="${midX}" y="${roleY}" class="ft-note" fill="${roleFill}" text-anchor="middle"${bp(`nodes.${ni}.role`)}>${escapeHtml(orgClip(String(n.role), ORG_ROLE_CHARS))}</text>`
      : '';
    const roleTruncated = hasRole && String(n.role).length > ORG_ROLE_CHARS;
    const tip =
      truncated || roleTruncated
        ? `<title>${escapeHtml(hasRole ? `${n.label} — ${String(n.role)}` : n.label)}</title>`
        : '';
    s +=
      `<g filter="url(#gshadow)"${bp(`nodes.${ni}`)}>` +
      `<rect x="${x}" y="${y}" width="${ORG_W}" height="${ORG_H}" rx="7" fill="${fill}" stroke="${stroke}" stroke-width="1.3"/>` +
      tip +
      labelSvg +
      role +
      `</g>`;
  });
  s += `</g>`;

  s += `</svg>`;
  return diagramFrame(
    {
      tag: 'ORG',
      tagBg: '#0e54a1',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
    },
    s,
  );
}

// ─── default: indented folder tree ───────────────────────────────────────────

/** A node's value with the block's unit — integers stay integers. */
function fmtValue(v: number, unit: string | undefined): string {
  const rounded = Math.round(v * 100) / 100;
  const text = Number.isInteger(rounded) ? String(rounded) : String(rounded);
  return unit !== undefined ? `${text}${unit}` : text;
}

export function renderTree(data: TreeData): string {
  if (data.variant === 'issue') return renderIssueTree(data);
  if (data.variant === 'org') return renderOrgTree(data);
  const nodes = data.nodes ?? [];
  const byId = new Map<string, Node>();
  const children = new Map<string, string[]>();
  // Original array index per node — rows render in DFS order, but data paths
  // must address the node's position in the YAML `nodes` array.
  const indexOf = new Map<Node, number>();
  nodes.forEach((n, i) => indexOf.set(n, i));
  for (const n of nodes) {
    byId.set(n.id, n);
    children.set(n.id, []);
  }
  const roots: string[] = [];
  for (const n of nodes) {
    if (n.parent !== undefined && byId.has(n.parent)) {
      children.get(n.parent)?.push(n.id);
    } else {
      roots.push(n.id);
    }
  }

  type Out = { node: Node; depth: number; branch: boolean; parent?: Node };
  const out: Out[] = [];
  const seen = new Set<string>();
  const walk = (id: string, depth: number, parent?: Node): void => {
    if (seen.has(id)) return;
    seen.add(id);
    const node = byId.get(id);
    if (node === undefined) return;
    const kids = children.get(id) ?? [];
    out.push({ node, depth, branch: kids.length > 0, ...(parent !== undefined ? { parent } : {}) });
    for (const c of kids) walk(c, depth + 1, node);
  };
  for (const r of roots) walk(r, 0);

  const rows = out
    .map((row) => {
      const ni = indexOf.get(row.node) ?? 0;
      const branchCls = row.branch ? ' branch' : '';
      const glyph = row.branch ? '▸' : '—';
      const note =
        row.node.note !== undefined
          ? `<span class="tnote"${bp(`nodes.${ni}.note`)}>${escapeHtml(row.node.note)}</span>`
          : '';
      // Values turn the hierarchy into a DRIVER TREE: the number itself, plus
      // its share of the parent — which is the figure that says where the
      // total actually comes from.
      let value = '';
      if (typeof row.node.value === 'number') {
        const own = fmtValue(row.node.value, data.unit);
        const parentValue = row.parent?.value;
        const share =
          typeof parentValue === 'number' && parentValue > 0
            ? `<span class="tshare">${Math.round((row.node.value / parentValue) * 100)}%</span>`
            : '';
        value = `<span class="tvalue"${bp(`nodes.${ni}.value`)}>${escapeHtml(own)}</span>${share}`;
      }
      return (
        `<div class="tree-row${branchCls}" style="padding-left:${row.depth * 22}px"${bp(`nodes.${ni}`)}>` +
        `<span class="tw">${glyph}</span>` +
        `<span class="tlabel"${bp(`nodes.${ni}.label`)}>${escapeHtml(row.node.label)}</span>` +
        note +
        value +
        `</div>`
      );
    })
    .join('');
  return `<div class="tree-list"${bl('nodes')}>${rows}</div>`;
}
