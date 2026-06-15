/**
 * Renders an indented hierarchy of nodes, like a folder tree.
 *
 * Nodes are linked via `parent` id. Roots are nodes without a `parent` (or
 * whose parent id is unknown). Children are indented based on depth.
 *
 * Ported from doc-studio.jsx `Tree`.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';

type Node = NonNullable<BlockDataMap['tree']['nodes']>[number];

export function renderTree(data: BlockDataMap['tree']): string {
  const nodes = data.nodes ?? [];
  const byId = new Map<string, Node>();
  const children = new Map<string, string[]>();
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

  type Out = { node: Node; depth: number; branch: boolean };
  const out: Out[] = [];
  const seen = new Set<string>();
  const walk = (id: string, depth: number): void => {
    if (seen.has(id)) return;
    seen.add(id);
    const node = byId.get(id);
    if (node === undefined) return;
    const kids = children.get(id) ?? [];
    out.push({ node, depth, branch: kids.length > 0 });
    for (const c of kids) walk(c, depth + 1);
  };
  for (const r of roots) walk(r, 0);

  const rows = out
    .map((row) => {
      const branchCls = row.branch ? ' branch' : '';
      const glyph = row.branch ? '▸' : '—';
      const note =
        row.node.note !== undefined
          ? `<span class="tnote">${escapeHtml(row.node.note)}</span>`
          : '';
      return (
        `<div class="tree-row${branchCls}" style="padding-left:${row.depth * 22}px">` +
        `<span class="tw">${glyph}</span>` +
        `<span class="tlabel">${escapeHtml(row.node.label)}</span>` +
        note +
        `</div>`
      );
    })
    .join('');
  return `<div class="tree-list">${rows}</div>`;
}
