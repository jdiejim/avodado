/**
 * Renders a C4 model diagram (context / container / component levels).
 *
 * Skin (`DESIGN.md`): every element is a paper card with an ink outline and
 * the C4 typography stacked in the centre — kind chip, name, technology,
 * description. Kinds travel through chip, dash and fill: `PERSON` (with the
 * figure glyph), `SYSTEM`, `EXT` (dashed — outside the boundary), `DB`
 * (cylinder on the inactive fill), `CONTAINER`, `COMPONENT`; a `family` of
 * `external` dashes a container / component, a data family (`store` /
 * `data`) puts it on the inactive fill. Boundaries are the skin's `paper-2`
 * panels with the boundary name as an eyebrow and the level it encloses
 * top-right. Relations follow the shared stroke table.
 *
 * Accent rule: at the top level (no `level`, or `level: context`) the single
 * `system` node — the system the diagram is about — takes the accent. Two or
 * more systems, none, or a deeper level means no accent.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { edgeLanes, entryPortOffsets, ortho } from '../svg/ortho.js';
import { wrapText } from '../svg/wrapText.js';
import { edgeLabelLayer, type EdgeLabelPoint } from '../svg/edgeSteps.js';
import { nodeGlyph, nodeSkin, SKIN_EDGE, type NodeSkin } from '../svg/blockStyle.js';
import { GROUP_PADS, gridGroupsSvg, groupExtent } from '../svg/gridGroups.js';
import { gridMetaAttrs, nodeCellAttrs } from '../svg/gridMeta.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { safeColor } from '../sanitize.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';
import { ensureGrid } from './autoLayout.js';

type Node = NonNullable<BlockDataMap['c4']['nodes']>[number];

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

const CHIP_LABEL: Record<string, string> = {
  PERSON: 'person',
  SYSTEM: 'software system',
  EXT: 'external system',
  DB: 'database',
  CONTAINER: 'container',
  COMPONENT: 'component',
};

/** The skin of one C4 element: kind first, then the family refinements. */
function c4Skin(n: Node): NodeSkin {
  const f = (n.family ?? '').toLowerCase();
  switch (n.kind) {
    case 'person':
      return { chip: 'PERSON', primary: true, fill: 'paper', dashed: false };
    case 'system':
      return { chip: 'SYSTEM', primary: true, fill: 'paper', dashed: false };
    case 'external':
      return nodeSkin('external');
    case 'store':
      return nodeSkin('store');
    case 'container':
    case 'component': {
      const chip = n.kind === 'container' ? 'CONTAINER' : 'COMPONENT';
      if (f === 'external') return { chip, primary: true, fill: 'paper', dashed: true };
      if (f === 'store' || f === 'data') return { chip, primary: false, fill: 'paper-2', dashed: false };
      return { chip, primary: true, fill: 'paper', dashed: false };
    }
    default:
      return nodeSkin(n.kind);
  }
}

/** The word for what a boundary encloses at the given level. */
function boundaryLevel(level: string | undefined): string {
  if (level === 'component') return 'CONTAINER';
  if (level === 'container') return 'SYSTEM';
  return 'BOUNDARY';
}

export function renderC4(data: BlockDataMap['c4']): string {
  const edges = data.edges ?? [];
  const rawNodes = data.nodes ?? [];
  const quick = !(rawNodes.length > 0 && rawNodes.every((n) => n.col !== undefined && n.row !== undefined));
  const nodes = ensureGrid(rawNodes, edges, data.dir ?? 'LR');
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const cellW = 212;
  const cellH = 112;
  const gapX = 56;
  const gapY = 64;
  const groups = data.groups ?? [];
  // Group outlines overshoot their cells (label headroom): grow the padding
  // to fit them ONLY when groups exist, so group-less docs stay byte-identical.
  const padX = groups.length > 0 ? GROUP_PADS.padX : 26;
  const padTop = groups.length > 0 ? GROUP_PADS.padTop : 46;
  const padBot = groups.length > 0 ? GROUP_PADS.padBot : 24;
  const gx = groupExtent(groups);
  const cols = Math.max(1, ...nodes.map((n) => n.col + ((n.w ?? 1) - 1)), gx.cols);
  const rows = Math.max(1, ...nodes.map((n) => n.row), gx.rows);
  const rectFor = (n: Node & { col: number; row: number }): Rect => ({
    x: padX + (n.col - 1) * (cellW + gapX),
    y: padTop + (n.row - 1) * (cellH + gapY),
    w: (n.w ?? 1) * cellW + ((n.w ?? 1) - 1) * gapX,
    h: cellH,
  });
  const width = padX * 2 + cols * cellW + (cols - 1) * gapX;
  const height = padTop + rows * cellH + (rows - 1) * gapY + padBot;

  // The accent (see the header comment).
  const topLevel = data.level === undefined || data.level === 'context';
  const systems = nodes.filter((n) => n.kind === 'system');
  const accentId = topLevel && systems.length === 1 ? systems[0]?.id : undefined;

  // A boundary panel fitted around a set of node rects — the skin's group
  // panel (paper-2 wash, hairline, eyebrow label) with the enclosed level
  // named top-right. An explicit `color` still tints the outline and label.
  const levelWord = boundaryLevel(data.level);
  const boundaryPanel = (rs: readonly Rect[], label: string, color?: string): string => {
    if (rs.length === 0) return '';
    const minX = Math.min(...rs.map((r) => r.x)) - 16;
    const minY = Math.min(...rs.map((r) => r.y)) - 26;
    const maxX = Math.max(...rs.map((r) => r.x + r.w)) + 16;
    const maxY = Math.max(...rs.map((r) => r.y + r.h)) + 16;
    const tint = safeColor(color, '');
    const stroke = tint.length > 0 ? tint : 'var(--rule-solid)';
    const text = tint.length > 0 ? tint : 'var(--soft)';
    return (
      `<g>` +
      `<rect x="${minX}" y="${minY}" width="${maxX - minX}" height="${maxY - minY}" rx="6" fill="var(--paper-2)" fill-opacity="0.6" stroke="${stroke}" stroke-width="1"/>` +
      `<text x="${minX + 12}" y="${minY + 16}" class="grp-label t-eyebrow" fill="${text}">${escapeHtml(label)}</text>` +
      `<text x="${maxX - 12}" y="${minY + 16}" class="t-eyebrow" fill="${text}" text-anchor="end">${levelWord}</text>` +
      `</g>`
    );
  };

  // Boundary box around the "internal" nodes (container/component/store).
  let boundarySvg = '';
  if (data.boundary !== undefined) {
    const internals = nodes
      .filter((n) => n.kind === 'container' || n.kind === 'component' || n.kind === 'store')
      .map(rectFor);
    boundarySvg = boundaryPanel(internals, data.boundary.label);
  }

  // Named boundaries: each panel fits around its listed node ids — so one
  // diagram can show several systems / zones side by side.
  let namedBoundariesSvg = '';
  for (const b of data.boundaries ?? []) {
    const rs = b.nodes
      .map((id) => byId.get(id))
      .filter((n): n is NonNullable<typeof n> => n !== undefined)
      .map(rectFor);
    namedBoundariesSvg += boundaryPanel(rs, b.label, b.color);
  }

  // Grid metadata for editors (Avodado Studio drag-to-connect): inert attrs
  // mirroring the layout constants plus each node's effective cell below.
  const gridMeta = gridMetaAttrs({ quick, cols, rows, cellW, cellH, gapX, gapY, padX, padTop });
  // Group panels — beneath boundaries, edges, and nodes. Only emitted when present.
  const groupsSvg =
    groups.length > 0
      ? gridGroupsSvg(groups, {
          xOf: (c) => padX + (c - 1) * (cellW + gapX),
          yOf: (r) => padTop + (r - 1) * (cellH + gapY),
          cellW,
          cellH,
          gapX,
          gapY,
          skin: true,
        })
      : '';
  let s = `<svg viewBox="0 0 ${width} ${height}" role="img"${gridMeta}><title>C4 diagram</title>${groupsSvg}${boundarySvg}${namedBoundariesSvg}`;

  const pending: EdgeLabelPoint[] = [];
  const edgeKinds = new Set<string>();
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
    const kind = e.kind ?? 'solid';
    edgeKinds.add(kind);
    const st = SKIN_EDGE[kind] ?? SKIN_EDGE['solid'] ?? {
      stroke: 'var(--muted)',
      sw: 1.5,
      dash: '',
      marker: 'skArrow',
      err: false,
    };
    const dash = st.dash.length > 0 ? ` stroke-dasharray="${st.dash}"` : '';
    s += `<path d="${p.d}" fill="none" stroke="${st.stroke}" stroke-width="${st.sw}"${dash} marker-end="url(#${st.marker})"${bp(`edges.${ei}`)}/>`;
    // C4 convention: the relationship label plus its technology in brackets.
    const label =
      e.tech !== undefined
        ? `${e.label !== undefined ? `${e.label} ` : ''}[${e.tech}]`
        : e.label;
    pending.push({ lx: p.lx, ly: p.ly, ...(label !== undefined ? { label } : {}), err: st.err, path: `edges.${ei}` });
  });
  s += `</g>`; // close the edges list container (editors add via its chip)

  const chipsUsed = new Set<string>();
  let dashedUsed = false;
  let inactiveUsed = false;
  s += `<g${bl('nodes')}>`;
  nodes.forEach((n, ni) => {
    const r = rectFor(n);
    const sk = c4Skin(n);
    const accent = n.id === accentId;
    if (sk.chip !== '') chipsUsed.add(sk.chip);
    if (sk.dashed) dashedUsed = true;
    if (sk.fill === 'paper-2') inactiveUsed = true;
    const cxN = r.x + r.w / 2;
    const stroke = accent ? 'var(--accent)' : sk.primary ? 'var(--ink)' : 'var(--rule-solid)';
    const sw = accent || sk.primary ? 1.5 : 1;
    const fill = accent ? 'var(--accent-tint)' : sk.fill === 'paper-2' ? 'var(--paper-2)' : 'var(--paper)';
    const dashAttr = sk.dashed ? ' stroke-dasharray="4 3"' : '';
    // Stores render as the canonical database cylinder (content shifts down
    // past the rim); everything else is the rounded card.
    const isStore = n.kind === 'store';
    const dy = isStore ? 10 : 0;
    const desc = wrapText(n.desc, 32, isStore ? 1 : 2);
    const card = isStore
      ? `<path d="M${r.x} ${r.y + 12} A ${r.w / 2} 12 0 0 1 ${r.x + r.w} ${r.y + 12} V ${r.y + r.h - 12} A ${r.w / 2} 12 0 0 1 ${r.x} ${r.y + r.h - 12} Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dashAttr}/>` +
        `<path d="M${r.x} ${r.y + 12} A ${r.w / 2} 12 0 0 0 ${r.x + r.w} ${r.y + 12}" fill="none" stroke="${stroke}" stroke-width="${sw}"${dashAttr}/>`
      : `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dashAttr}/>`;
    // Person glyph sits in the top-right corner, clear of the centered text.
    const personGlyph = n.kind === 'person' ? nodeGlyph('person', r.x + r.w - 28, r.y + 10, 'var(--muted)') : '';
    // On the inactive fill small text steps up to `muted`; on paper, `soft`
    // carries the sublines and the chip.
    const onInactive = sk.fill === 'paper-2';
    const chipTone = accent ? ' c-accent' : onInactive ? ' c-muted' : '';
    const subTone = onInactive ? ' c-muted' : ' c-soft';
    const chip =
      sk.chip !== ''
        ? `<text x="${cxN}" y="${r.y + 18 + dy}" class="t-eyebrow${chipTone}" text-anchor="middle">${escapeHtml(sk.chip)}</text>`
        : '';
    // Structurizr-style centered typography: kind chip · name · tech · desc.
    const techLine =
      n.tech !== undefined
        ? `<text x="${cxN}" y="${r.y + 56 + dy}" class="t-sub${onInactive ? ' c-muted' : ''}" text-anchor="middle">${escapeHtml(n.tech)}</text>`
        : '';
    const descLines = desc
      .map(
        (ln, j) =>
          `<text x="${cxN}" y="${r.y + 76 + dy + j * 13}" class="t-sub${subTone}" text-anchor="middle">${escapeHtml(ln)}</text>`,
      )
      .join('');
    s +=
      `<g${bp(`nodes.${ni}`)}${nodeCellAttrs(n.col, n.row, n.w ?? 1)}>` +
      card +
      personGlyph +
      chip +
      `<text x="${cxN}" y="${r.y + 40 + dy}" class="t-name${accent ? ' c-accent' : ''}" text-anchor="middle">${escapeHtml(n.name)}</text>` +
      techLine +
      descLines +
      `</g>`;
  });
  s += `</g>`; // close the nodes list container

  const { overlay, legend: steps } = edgeLabelLayer(pending, nodes.map((n) => rectFor(n)), { skin: true });
  s += overlay; // labels on top, never crossed by a line
  s += `</svg>`;

  // Legend derives from the kinds and strokes actually present.
  const items: LegendItem[] = [];
  for (const chip of chipsUsed) items.push({ swatch: 'chip', chip, label: CHIP_LABEL[chip] ?? chip.toLowerCase() });
  if (dashedUsed) items.push({ swatch: 'node-dashed', label: 'outside the boundary' });
  if (inactiveUsed) items.push({ swatch: 'node-fill2', label: 'data store' });
  if (edgeKinds.has('solid')) items.push({ swatch: 'edge', label: 'uses' });
  if (edgeKinds.has('dashed')) items.push({ swatch: 'edge-dashed', label: 'async / optional' });
  if (edgeKinds.has('forbidden')) items.push({ swatch: 'edge-error', label: 'forbidden' });
  if (edgeKinds.has('error')) items.push({ swatch: 'edge-error', label: 'error' });
  if (accentId !== undefined) items.push({ swatch: 'node-accent', label: 'the system in scope' });
  const legend = renderLegend(items);

  return diagramFrame(
    {
      tag: data.level !== undefined ? `C4 · ${data.level.toUpperCase()}` : 'C4',
      tagClass: 'c4',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legend.length > 0 ? { legendHtml: legend } : {}),
    },
    s + steps,
  );
}
