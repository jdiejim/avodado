/**
 * Renders a `linkedlist` block — a pointer-chain diagram (singly or doubly),
 * in pure SVG inside the diagram frame (tag LIST).
 *
 * Each node is a 56×40 rounded box split into a value cell and a narrow
 * pointer cell (the dot); arrows run from the pointer cell to the next node.
 * `kind: doubly` adds a second, lower back-arrow per link; `nullEnd` (default
 * true) terminates the chain in a ∅ ground symbol. `label` markers ("head",
 * "curr") render above their node with a ▼ tick.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { dsTone } from '../svg/dsTone.js';
import { diagramFrame } from './frame.js';

type LinkedlistData = BlockDataMap['linkedlist'];

const NODE_W = 56;
const NODE_H = 40;
const VALUE_W = 38; // value cell; the remaining 18px is the pointer cell
const GAP = 34; // arrow run between nodes
const PAD_X = 8;

/** Truncates a value so it fits the 38px value cell at 13px mono. */
function fit(v: string): string {
  return v.length > 4 ? `${v.slice(0, 3)}…` : v;
}

export function renderLinkedlist(data: LinkedlistData): string {
  const nodes = data.nodes ?? [];
  const doubly = (data.kind ?? 'singly') === 'doubly';
  const nullEnd = data.nullEnd ?? true;
  const n = nodes.length;
  const hasLabels = nodes.some((nd) => nd.label !== undefined && nd.label.length > 0);

  const topPad = hasLabels ? 30 : 8;
  const cy = topPad + NODE_H / 2;
  const height = topPad + NODE_H + 10;
  const tailW = nullEnd ? GAP + 18 : 0;
  const width = PAD_X * 2 + Math.max(n, 1) * NODE_W + Math.max(n - 1, 0) * GAP + tailW;

  let s = `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img"><title>Linked list</title>`;

  if (n === 0) {
    s += `<text x="${PAD_X}" y="${cy + 4}" class="ds-empty">(empty)</text></svg>`;
    return frame(data, s);
  }

  const xOf = (i: number): number => PAD_X + i * (NODE_W + GAP);

  // Link arrows first, so node boxes sit on top of the line ends.
  for (let i = 0; i < n - 1; i += 1) {
    const dotX = xOf(i) + VALUE_W + (NODE_W - VALUE_W) / 2;
    const nextX = xOf(i + 1);
    if (doubly) {
      s += `<path d="M${dotX},${cy - 7} L${nextX - 2},${cy - 7}" class="ll-link" marker-end="url(#gArrow)"/>`;
      s += `<path d="M${nextX},${cy + 7} L${xOf(i) + NODE_W + 2},${cy + 7}" class="ll-link" marker-end="url(#gArrow)"/>`;
    } else {
      s += `<path d="M${dotX},${cy} L${nextX - 2},${cy}" class="ll-link" marker-end="url(#gArrow)"/>`;
    }
  }

  // Null terminator: arrow from the last pointer cell to a ∅ ground symbol.
  if (nullEnd) {
    const dotX = xOf(n - 1) + VALUE_W + (NODE_W - VALUE_W) / 2;
    const endX = xOf(n - 1) + NODE_W + GAP;
    const y = doubly ? cy - 7 : cy;
    s += `<path d="M${dotX},${y} L${endX - 2},${y}" class="ll-link" marker-end="url(#gArrow)"/>`;
    s += `<text x="${endX + 8}" y="${y + 5}" class="ll-null">∅</text>`;
  }

  // Node boxes: value cell + pointer cell (separator + dot).
  nodes.forEach((nd, i) => {
    const t = dsTone(nd.tone);
    const x = xOf(i);
    s +=
      `<g filter="url(#gshadow)">` +
      `<rect x="${x}" y="${topPad}" width="${NODE_W}" height="${NODE_H}" rx="8" fill="${t.fill}" stroke="${t.stroke}" stroke-width="1.4"/>` +
      `<line x1="${x + VALUE_W}" y1="${topPad + 5}" x2="${x + VALUE_W}" y2="${topPad + NODE_H - 5}" stroke="${t.stroke}" stroke-width="1"/>` +
      `<circle cx="${x + VALUE_W + (NODE_W - VALUE_W) / 2}" cy="${cy}" r="3" fill="${t.text}"/>` +
      `<text x="${x + VALUE_W / 2}" y="${cy + 5}" class="ds-val" fill="${t.text}">${escapeHtml(fit(nd.value))}</text>` +
      `</g>`;
  });

  // Marker labels above their node, with a ▼ tick pointing down at it.
  nodes.forEach((nd, i) => {
    if (nd.label === undefined || nd.label.length === 0) return;
    const cx = xOf(i) + NODE_W / 2;
    s += `<text x="${cx}" y="${topPad - 14}" class="ds-ptr">${escapeHtml(nd.label)}</text>`;
    s += `<path d="M${cx - 4},${topPad - 10} L${cx + 4},${topPad - 10} L${cx},${topPad - 4} z" fill="var(--navy)"/>`;
  });

  s += `</svg>`;
  return frame(data, s);
}

function frame(data: LinkedlistData, inner: string): string {
  return diagramFrame(
    {
      tag: 'LIST',
      tagBg: '#374151',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
    },
    inner,
  );
}
