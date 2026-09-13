/**
 * Renders a `pkg` block — a UML package diagram: packages as tabbed folders
 * on a grid, members printed inside, dependencies as dashed arrows with an
 * optional «import» / «use» / «access» / «merge» stereotype.
 *
 * Layout: leaf packages take their `col` / `row`, or a dagre grid when any
 * is missing (`ensureGrid`). A package named as another's `parent` is drawn
 * as a larger folder around its children's cells — a group panel with a
 * tab — and nests to any depth; its bounds come from its children, never
 * from the author.
 *
 * Skin (`DESIGN.md`): a leaf folder is paper with an ink outline; a parent
 * folder is the inactive panel (`paper-2`, hairline) so the leaves read as
 * objects inside it. Members are `.t-sub` mono lines under a hairline, at
 * most five and then `+n more`. Dependencies are the dashed `muted` arrow
 * with the stereotype and label on a paper mask. Zero accent.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { edgeLanes, entryPortOffsets, ortho, type Box } from '../svg/ortho.js';
import { edgeLabelLayer, type EdgeLabelPoint } from '../svg/edgeSteps.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { countPhrase, svgName } from '../svg/svgTitle.js';
import { wrapText } from '../svg/wrapText.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';
import { ensureGrid } from './autoLayout.js';

type Pkg = BlockDataMap['pkg']['packages'][number];

const CELL_W = 168;
const GAP_X = 128;
const GAP_Y = 56;
const TAB_W = 54;
const TAB_H = 12;
const HEAD_H = 26;
const MEMBER_H = 13;
const MAX_MEMBERS = 5;
const NEST = { padX: 18, padTop: 42, padBot: 14 } as const;

/** The member lines a folder prints: up to five, then `+n more`. */
function memberLines(contains: readonly string[] | undefined): string[] {
  const all = contains ?? [];
  if (all.length <= MAX_MEMBERS) return [...all];
  return [...all.slice(0, MAX_MEMBERS), `+${all.length - MAX_MEMBERS} more`];
}

export function renderPkg(data: BlockDataMap['pkg']): string {
  const packages = data.packages;
  const deps = data.deps ?? [];
  const ids = new Set(packages.map((p) => p.id));
  const parents = new Set(packages.map((p) => p.parent).filter((p): p is string => p !== undefined && ids.has(p)));
  const leaves = packages.filter((p) => !parents.has(p.id));
  const leafIds = new Set(leaves.map((p) => p.id));
  const placed = ensureGrid(
    leaves,
    deps.filter((d) => leafIds.has(d.from) && leafIds.has(d.to)),
    data.dir ?? 'LR',
  );
  const cellOf = new Map(placed.map((p) => [p.id, p]));

  // Nesting depth of a package (0 = top level); the deepest sets the outer pads.
  const byId = new Map(packages.map((p) => [p.id, p]));
  const depthOf = (p: Pkg, hops = 0): number => {
    const parent = p.parent !== undefined ? byId.get(p.parent) : undefined;
    return parent === undefined || hops > packages.length ? 0 : 1 + depthOf(parent, hops + 1);
  };
  const maxDepth = Math.max(0, ...packages.map((p) => depthOf(p)));

  const lines = leaves.map((p) => memberLines(p.contains));
  const maxLines = Math.max(0, ...lines.map((ls) => ls.length));
  const cellH = TAB_H + HEAD_H + (maxLines > 0 ? 6 + maxLines * MEMBER_H + 8 : 8);
  const padX = 26 + maxDepth * NEST.padX;
  const padTop = 26 + maxDepth * NEST.padTop;
  const padBot = 20 + maxDepth * NEST.padBot;
  const cols = Math.max(1, ...placed.map((p) => p.col));
  const rows = Math.max(1, ...placed.map((p) => p.row));
  const xOf = (c: number): number => padX + (c - 1) * (CELL_W + GAP_X);
  const yOf = (r: number): number => padTop + (r - 1) * (cellH + GAP_Y);
  const width = padX * 2 + cols * CELL_W + (cols - 1) * GAP_X;
  const height = padTop + rows * cellH + (rows - 1) * GAP_Y + padBot;

  // A parent's box is the union of its children's boxes, padded per level.
  const boxCache = new Map<string, Box>();
  const boxOf = (id: string, hops = 0): Box | undefined => {
    const hit = boxCache.get(id);
    if (hit !== undefined) return hit;
    const leaf = cellOf.get(id);
    if (leaf !== undefined) {
      const b = { x: xOf(leaf.col), y: yOf(leaf.row), w: CELL_W, h: cellH };
      boxCache.set(id, b);
      return b;
    }
    if (hops > packages.length) return undefined;
    const kids = packages.filter((p) => p.parent === id).map((p) => boxOf(p.id, hops + 1));
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const k of kids) {
      if (k === undefined) continue;
      x0 = Math.min(x0, k.x);
      y0 = Math.min(y0, k.y);
      x1 = Math.max(x1, k.x + k.w);
      y1 = Math.max(y1, k.y + k.h);
    }
    if (!Number.isFinite(x0)) return undefined;
    const b = { x: x0 - NEST.padX, y: y0 - NEST.padTop, w: x1 - x0 + 2 * NEST.padX, h: y1 - y0 + NEST.padTop + NEST.padBot };
    boxCache.set(id, b);
    return b;
  };

  const a11y = svgName('Package diagram', data.title, [
    countPhrase(packages.length, 'package'),
    countPhrase(deps.length, 'dependency', 'dependencies'),
  ]);
  let s = `<svg viewBox="0 0 ${width} ${height}"${a11y.attrs}>${a11y.title}`;

  const folder = (b: Box, primary: boolean): string => {
    const stroke = primary ? 'var(--ink)' : 'var(--rule-solid)';
    const sw = primary ? 1.5 : 1;
    const fill = primary ? 'var(--paper)' : 'var(--paper-2)';
    const tabW = Math.min(TAB_W, b.w / 2);
    return (
      `<path d="M${b.x} ${b.y + TAB_H} V${b.y + 2} Q${b.x} ${b.y} ${b.x + 2} ${b.y} H${b.x + tabW - 2} Q${b.x + tabW} ${b.y} ${b.x + tabW} ${b.y + 2} V${b.y + TAB_H}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>` +
      `<rect x="${b.x}" y="${b.y + TAB_H}" width="${b.w}" height="${b.h - TAB_H}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`
    );
  };

  // Parent folders first (shallowest outermost), beneath everything.
  const parentList = packages
    .map((p, pi) => ({ p, pi, depth: depthOf(p) }))
    .filter(({ p }) => parents.has(p.id))
    .sort((a, b) => a.depth - b.depth || a.pi - b.pi);
  let anyParent = false;
  s += `<g${bl('packages')}>`;
  for (const { p, pi } of parentList) {
    const b = boxOf(p.id);
    if (b === undefined) continue;
    anyParent = true;
    const stereo =
      p.stereotype !== undefined
        ? `<text x="${b.x + b.w - 10}" y="${b.y + TAB_H + 16}" class="t-eyebrow" text-anchor="end"${bp(`packages.${pi}.stereotype`)}>«${escapeHtml(p.stereotype)}»</text>`
        : '';
    s +=
      `<g${bp(`packages.${pi}`)}>` +
      folder(b, false) +
      `<text x="${b.x + 10}" y="${b.y + TAB_H + 17}" class="t-name c-muted"${bp(`packages.${pi}.name`)}>${escapeHtml(p.name)}</text>` +
      stereo +
      `</g>`;
  }

  // Dependencies: dashed orthogonal arrows between boxes (leaf or parent).
  const pending: EdgeLabelPoint[] = [];
  const kindsUsed = new Set<string>();
  const lanes = edgeLanes(deps);
  const entries = entryPortOffsets(deps, (id) => boxOf(id));
  let edges = `<g${bl('deps')}>`;
  deps.forEach((d, di) => {
    const A = boxOf(d.from);
    const B = boxOf(d.to);
    if (A === undefined || B === undefined || d.from === d.to) return;
    if (d.kind !== undefined) kindsUsed.add(d.kind);
    const p = ortho(A, B, lanes[di] ?? 0, entries[di] ?? 0);
    edges += `<path d="${p.d}" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="5 4" marker-end="url(#skArrow)"${bp(`deps.${di}`)}/>`;
    const label = [d.kind !== undefined ? `«${d.kind}»` : undefined, d.label].filter((t) => t !== undefined).join(' ');
    pending.push({ lx: p.lx, ly: p.ly, ...(label.length > 0 ? { label } : {}), path: `deps.${di}` });
  });
  edges += `</g>`;

  // Leaf folders, on top of the edges.
  let leafSvg = '';
  const avoid: Box[] = [];
  packages.forEach((p, pi) => {
    const cell = cellOf.get(p.id);
    if (cell === undefined) return;
    const b = boxOf(p.id);
    if (b === undefined) return;
    avoid.push(b);
    const ls = memberLines(p.contains);
    const nameMax = p.stereotype !== undefined ? 12 : 20;
    const name = wrapText(p.name, nameMax, 1)[0] ?? '';
    const title = name !== p.name ? `<title>${escapeHtml(p.name)}</title>` : '';
    let g = `<g${bp(`packages.${pi}`)}>${folder(b, true)}`;
    g += `<text x="${b.x + 10}" y="${b.y + TAB_H + 17}" class="t-name"${bp(`packages.${pi}.name`)}>${title}${escapeHtml(name)}</text>`;
    if (p.stereotype !== undefined) {
      g += `<text x="${b.x + b.w - 10}" y="${b.y + TAB_H + 16}" class="t-eyebrow" text-anchor="end"${bp(`packages.${pi}.stereotype`)}>«${escapeHtml(p.stereotype)}»</text>`;
    }
    if (ls.length > 0) {
      const ruleY = b.y + TAB_H + HEAD_H;
      g += `<line x1="${b.x}" y1="${ruleY}" x2="${b.x + b.w}" y2="${ruleY}" stroke="var(--rule-solid)" stroke-width="1"/>`;
      g += `<g${bl(`packages.${pi}.contains`)}>`;
      ls.forEach((m, mi) => {
        const more = mi >= MAX_MEMBERS;
        const path = more ? '' : bp(`packages.${pi}.contains.${mi}`);
        g += `<text x="${b.x + 10}" y="${ruleY + 6 + (mi + 1) * MEMBER_H - 2}" class="t-sub${more ? ' c-soft' : ' c-ink'}"${path}>${escapeHtml(m)}</text>`;
      });
      g += `</g>`;
    }
    g += `</g>`;
    leafSvg += g;
  });
  s += leafSvg + `</g>` + edges;

  const { overlay, legend: steps } = edgeLabelLayer(pending, avoid, { skin: true });
  s += overlay + `</svg>`;

  const items: LegendItem[] = [{ swatch: 'node', label: 'package' }];
  if (anyParent) items.push({ swatch: 'node-fill2', label: 'parent package' });
  if (deps.length > 0) items.push({ swatch: 'edge-dashed', label: 'dependency' });
  for (const k of ['import', 'use', 'access', 'merge'] as const) {
    if (kindsUsed.has(k)) items.push({ swatch: 'chip', chip: `«${k}»`, label: k });
  }
  const legend = renderLegend(items);

  return diagramFrame(
    {
      tag: 'PACKAGES',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legend.length > 0 ? { legendHtml: legend } : {}),
    },
    s + steps,
  );
}
