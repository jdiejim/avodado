/**
 * Renders a data-flow diagram — process bubbles, external rectangles, and
 * three-sided data-store boxes, with orthogonal edges.
 *
 * Skin (`DESIGN.md`): a process is a paper bubble with an ink outline; an
 * external entity is a dashed rectangle with an `EXT` chip; a data store is
 * the three-sided box on the inactive fill (`paper-2`, hairline) with a `DB`
 * chip. Flows are `muted` arrows with `.t-arrow` labels on a paper mask.
 *
 * Accent rule: when the diagram has exactly one external entity, it takes the
 * accent — the one actor the system talks to. Two or more externals, or none,
 * means no accent.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { edgeLanes, entryPortOffsets, ortho } from '../svg/ortho.js';
import { wrapText } from '../svg/wrapText.js';
import { edgeLabelLayer, type EdgeLabelPoint } from '../svg/edgeSteps.js';
import { GROUP_PADS, gridGroupsSvg, groupExtent, nestingPads } from '../svg/gridGroups.js';
import { gridMetaAttrs, nodeCellAttrs } from '../svg/gridMeta.js';
import { nodeSkin } from '../svg/blockStyle.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { countPhrase, svgName } from '../svg/svgTitle.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';
import { ensureGrid } from './autoLayout.js';

type Kind = 'process' | 'external' | 'store';

function kindOf(kind: string | undefined): Kind {
  const k = (kind ?? 'process').toLowerCase();
  if (k === 'external') return 'external';
  if (k === 'store' || k === 'datastore') return 'store';
  return 'process';
}

export function renderDfd(data: BlockDataMap['dfd']): string {
  const edges = data.edges ?? [];
  const rawNodes = data.nodes ?? [];
  const quick = !(rawNodes.length > 0 && rawNodes.every((n) => n.col !== undefined && n.row !== undefined));
  const nodes = ensureGrid(rawNodes, edges, data.dir ?? 'LR');
  const cellW = 148;
  // Long names wrap (word-aware, ≤3 lines) inside the shape; the cell grows
  // uniformly per extra line so wrapped labels never spill or collide.
  const nameLines = nodes.map((n) => wrapText(n.name, 20, 3));
  const maxLines = Math.max(1, ...nameLines.map((ls) => ls.length));
  const cellH = 66 + (maxLines - 1) * 14;
  const gapX = 104;
  const gapY = 54;
  const groups = data.groups ?? [];
  // Group outlines overshoot their cells (label headroom): grow the padding
  // to fit them ONLY when groups exist, so group-less docs stay byte-identical.
  // Declared group nesting (`parent`) grows the outermost panels outward; the
  // pads grow with them so a nested group never clips at the viewBox edge.
  const nestPad = nestingPads(groups);
  const padX = (groups.length > 0 ? GROUP_PADS.padX : 26) + nestPad.padX;
  const padTop = (groups.length > 0 ? GROUP_PADS.padTop : 26) + nestPad.padTop;
  const padBot = (groups.length > 0 ? GROUP_PADS.padBot : 20) + nestPad.padBot;
  const gx = groupExtent(groups);
  const cols = Math.max(1, ...nodes.map((n) => n.col), gx.cols);
  const rows = Math.max(1, ...nodes.map((n) => n.row), gx.rows);
  const xOf = (c: number): number => padX + (c - 1) * (cellW + gapX);
  const yOf = (r: number): number => padTop + (r - 1) * (cellH + gapY);
  const rectFor = (n: { col: number; row: number }): {
    x: number;
    y: number;
    w: number;
    h: number;
  } => ({ x: xOf(n.col), y: yOf(n.row), w: cellW, h: cellH });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const width = padX * 2 + cols * cellW + (cols - 1) * gapX;
  const height = padTop + rows * cellH + (rows - 1) * gapY + padBot;

  // The accent: the single external entity (see the header comment).
  const externals = nodes.filter((n) => kindOf(n.kind) === 'external');
  const accentId = externals.length === 1 ? externals[0]?.id : undefined;

  // Grid metadata for editors (Avodado Studio drag-to-connect): inert attrs
  // mirroring the layout constants plus each node's effective cell below.
  const gridMeta = gridMetaAttrs({ quick, cols, rows, cellW, cellH, gapX, gapY, padX, padTop });
  const a11y = svgName('Data-flow diagram', data.title, [
    countPhrase(nodes.length, 'node'),
    countPhrase(edges.length, 'flow'),
  ]);
  let s = `<svg viewBox="0 0 ${width} ${height}"${a11y.attrs}${gridMeta}>${a11y.title}`;

  // Group panels — beneath edges and nodes. Only emitted when present.
  if (groups.length > 0) s += gridGroupsSvg(groups, { xOf, yOf, cellW, cellH, gapX, gapY, skin: true });

  const pending: EdgeLabelPoint[] = [];
  const lanes = edgeLanes(edges);
  const entries = entryPortOffsets(edges, (id) => {
    const n = byId.get(id);
    return n !== undefined ? rectFor(n) : undefined;
  });
  s += `<g${bl('edges')}>`;
  edges.forEach((e, ei) => {
    const A = byId.get(e.from);
    const B = byId.get(e.to);
    if (!A || !B) return;
    const p = ortho(rectFor(A), rectFor(B), lanes[ei] ?? 0, entries[ei] ?? 0);
    s += `<path d="${p.d}" fill="none" stroke="var(--muted)" stroke-width="1.5" marker-end="url(#skArrow)"${bp(`edges.${ei}`)}/>`;
    pending.push({ lx: p.lx, ly: p.ly, ...(e.label !== undefined ? { label: e.label } : {}), path: `edges.${ei}` });
  });
  s += `</g>`; // close the edges list container (editors add via its chip)

  const kindsUsed = new Set<Kind>();
  s += `<g${bl('nodes')}>`;
  nodes.forEach((n, ni) => {
    const r = rectFor(n);
    const k = kindOf(n.kind);
    kindsUsed.add(k);
    const accent = n.id === accentId;
    const sk = nodeSkin(k === 'process' ? undefined : k);
    const stroke = accent ? 'var(--accent)' : sk.primary ? 'var(--ink)' : 'var(--rule-solid)';
    const sw = accent || sk.primary ? 1.5 : 1;
    const fill = accent ? 'var(--accent-tint)' : sk.fill === 'paper-2' ? 'var(--paper-2)' : 'var(--paper)';
    const dash = sk.dashed ? ' stroke-dasharray="4 3"' : '';
    let shape: string;
    if (k === 'process') {
      shape = `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="16" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
    } else if (k === 'store') {
      shape =
        `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${fill}" stroke="none"/>` +
        `<path d="M${r.x + r.w} ${r.y} H ${r.x} V ${r.y + r.h} H ${r.x + r.w}" fill="none" stroke="${stroke}" stroke-width="${sw}"/>`;
    } else {
      shape = `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dash}/>`;
    }
    // The kind chip (top-right) — `muted` on the inactive fill, where `soft`
    // would sit under the small-text floor.
    const chipTone = accent ? ' c-accent' : sk.fill === 'paper-2' ? ' c-muted' : '';
    const chip =
      sk.chip !== ''
        ? `<text x="${r.x + r.w - 10}" y="${r.y + 14}" class="t-eyebrow${chipTone}" text-anchor="end">${escapeHtml(sk.chip)}</text>`
        : '';
    const num =
      n.num !== undefined && k === 'process'
        ? `<text x="${r.x + 12}" y="${r.y + 16}" class="t-badge"${bp(`nodes.${ni}.num`)}>${escapeHtml(n.num)}</text>`
        : '';
    const lines = nameLines[ni] ?? [];
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const tone = accent ? ' c-accent' : '';
    const name =
      lines.length <= 1
        ? `<text x="${cx}" y="${cy + 4}" class="t-name${tone}" text-anchor="middle"${bp(`nodes.${ni}.name`)}>${escapeHtml(n.name)}</text>`
        : `<g${bp(`nodes.${ni}.name`)}>` +
          lines
            .map(
              (ln, j) =>
                `<text x="${cx}" y="${cy + 4 - (lines.length - 1) * 7 + j * 14}" class="t-name${tone}" text-anchor="middle">${escapeHtml(ln)}</text>`,
            )
            .join('') +
          `</g>`;
    s += `<g${bp(`nodes.${ni}`)}${nodeCellAttrs(n.col, n.row)}>${shape}${chip}${num}${name}</g>`;
  });
  s += `</g>`; // close the nodes list container

  const { overlay, legend: steps } = edgeLabelLayer(pending, nodes.map((n) => rectFor(n)), { skin: true });
  s += overlay; // labels on top, never crossed by a line
  s += `</svg>`;

  const items: LegendItem[] = [];
  if (kindsUsed.has('process')) items.push({ swatch: 'node', label: 'process' });
  if (kindsUsed.has('external') && accentId === undefined) items.push({ swatch: 'node-dashed', label: 'external entity' });
  if (kindsUsed.has('store')) items.push({ swatch: 'node-store', label: 'data store' });
  if (edges.length > 0) items.push({ swatch: 'edge', label: 'data flow' });
  if (accentId !== undefined) items.push({ swatch: 'node-accent', label: 'external entity' });
  const legend = renderLegend(items);

  return diagramFrame(
    {
      tag: 'DFD',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legend.length > 0 ? { legendHtml: legend } : {}),
    },
    s + steps,
  );
}
