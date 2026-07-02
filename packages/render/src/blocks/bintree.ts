/**
 * Renders a `bintree` block — a binary tree in pure SVG inside the diagram
 * frame (tag TREE).
 *
 * Tidy-ish recursive layout: leaves take consecutive in-order slots, a parent
 * centres over its two children, and a single-child parent offsets half a
 * slot toward the occupied side (so unbalanced chains slant instead of
 * stacking). Levels are 64px apart; nodes are 36px circles; edges are plain
 * 1.4px lines drawn behind the nodes. Nodes without a parent are roots and
 * lay out side by side.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { dsTone } from '../svg/dsTone.js';
import { diagramFrame } from './frame.js';

type BintreeData = BlockDataMap['bintree'];
type Node = NonNullable<BintreeData['nodes']>[number];

const R = 18; // node radius (36px circles)
const UNIT = 52; // horizontal slot width
const LEVEL_H = 64;
const PAD_X = 10;
const PAD_TOP = 8;

/** Truncates a value so it fits a 36px circle at 12.5px mono. */
function fit(v: string): string {
  return v.length > 4 ? `${v.slice(0, 3)}…` : v;
}

interface Placed {
  readonly node: Node;
  readonly x: number; // in slot units (normalized later)
  readonly depth: number;
}

export function renderBintree(data: BintreeData): string {
  const nodes = data.nodes ?? [];

  if (nodes.length === 0) {
    const s = `<svg viewBox="0 0 220 44" width="220" height="44" role="img"><title>Binary tree</title><text x="${PAD_X}" y="26" class="ds-empty">(empty)</text></svg>`;
    return frame(data, s);
  }

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const children = new Map<string, { left?: Node; right?: Node }>();
  const roots: Node[] = [];
  for (const n of nodes) {
    if (n.parent === undefined || !byId.has(n.parent)) {
      roots.push(n);
      continue;
    }
    const slots = children.get(n.parent) ?? {};
    if (n.side === 'right') slots.right = n;
    else slots.left = n; // schema guarantees `side` when `parent` is set
    children.set(n.parent, slots);
  }

  // In-order layout: leaves consume slots; parents centre (or half-offset).
  const placed = new Map<string, Placed>();
  let cursor = 0;
  const place = (n: Node, depth: number): number => {
    if (placed.has(n.id)) return placed.get(n.id)?.x ?? 0; // cycle guard
    const kids = children.get(n.id) ?? {};
    let x: number;
    if (kids.left !== undefined && kids.right !== undefined) {
      const lx = place(kids.left, depth + 1);
      const rx = place(kids.right, depth + 1);
      x = (lx + rx) / 2;
    } else if (kids.left !== undefined) {
      x = place(kids.left, depth + 1) + 0.5;
    } else if (kids.right !== undefined) {
      x = place(kids.right, depth + 1) - 0.5;
    } else {
      x = cursor;
      cursor += 1;
    }
    placed.set(n.id, { node: n, x, depth });
    return x;
  };
  roots.forEach((root, i) => {
    if (i > 0) cursor += 0.8; // gap between side-by-side roots
    place(root, 0);
  });

  const all = [...placed.values()];
  const minX = Math.min(...all.map((p) => p.x));
  const maxX = Math.max(...all.map((p) => p.x));
  const maxDepth = Math.max(...all.map((p) => p.depth));
  const cxOf = (p: Placed): number => PAD_X + R + Math.round((p.x - minX) * UNIT);
  const cyOf = (p: Placed): number => PAD_TOP + R + p.depth * LEVEL_H;
  const width = PAD_X * 2 + 2 * R + Math.round((maxX - minX) * UNIT);
  const height = PAD_TOP + 2 * R + maxDepth * LEVEL_H + 8;

  let s = `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img"><title>Binary tree</title>`;

  // Edges behind the nodes.
  for (const p of all) {
    const parentId = p.node.parent;
    if (parentId === undefined) continue;
    const pp = placed.get(parentId);
    if (pp === undefined) continue;
    s += `<line x1="${cxOf(pp)}" y1="${cyOf(pp)}" x2="${cxOf(p)}" y2="${cyOf(p)}" class="bt-edge"/>`;
  }

  // Nodes (source order keeps the output deterministic).
  for (const n of nodes) {
    const p = placed.get(n.id);
    if (p === undefined) continue; // unreachable (cyclic parents)
    const t = dsTone(n.tone);
    s +=
      `<g filter="url(#gshadow)">` +
      `<circle cx="${cxOf(p)}" cy="${cyOf(p)}" r="${R}" fill="${t.fill}" stroke="${t.stroke}" stroke-width="1.4"/>` +
      `<text x="${cxOf(p)}" y="${cyOf(p) + 4}" class="bt-val" fill="${t.text}">${escapeHtml(fit(n.value))}</text>` +
      `</g>`;
  }

  s += `</svg>`;
  return frame(data, s);
}

function frame(data: BintreeData, inner: string): string {
  return diagramFrame(
    {
      tag: 'TREE',
      tagBg: '#374151',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
    },
    inner,
  );
}
