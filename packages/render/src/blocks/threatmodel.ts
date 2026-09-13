/**
 * Renders a `threatmodel` block — the data-flow shapes of `dfd` (process
 * bubble, dashed external, three-sided store) inside dashed trust boundaries,
 * with each hop's channel drawn on the edge, and a STRIDE table under the
 * drawing keyed to the nodes and edges it annotates.
 *
 * Skin (`DESIGN.md`): the shapes come from `svg/dfdShapes.ts`, the same
 * helper `dfd` draws with. A trust boundary is the grid group panel restyled
 * as a dashed `negative` outline on the negative tint, its label a small mono
 * tag. Channels: `tls` is the default muted arrow with a tiny lock at its
 * label; `plain` — an unencrypted hop — is dashed `negative` with a `PLAIN`
 * chip; `internal` and unmarked hops are the plain muted arrow.
 *
 * No accent: the story of a threat model is what is exposed, and that is
 * drawn in `negative` (plain hops, open threats). Nothing else is coloured.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { edgeLanes, entryPortOffsets, ortho } from '../svg/ortho.js';
import { wrapText } from '../svg/wrapText.js';
import { dodge, type AvoidRect } from '../svg/edgeSteps.js';
import { GROUP_PADS, gridGroupsSvg, groupExtent, nestingPads } from '../svg/gridGroups.js';
import { gridMetaAttrs, nodeCellAttrs } from '../svg/gridMeta.js';
import { dfdChip, dfdKindOf, dfdName, dfdPaint, dfdShape, type DfdKind } from '../svg/dfdShapes.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { countPhrase, svgName } from '../svg/svgTitle.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';
import { ensureGrid } from './autoLayout.js';

type ThreatData = BlockDataMap['threatmodel'];
type Threat = NonNullable<ThreatData['threats']>[number];
type Channel = 'tls' | 'plain' | 'internal' | 'none';

/** The STRIDE letters and the words they stand for. */
export const STRIDE: Readonly<Record<Threat['category'], string>> = {
  S: 'Spoofing',
  T: 'Tampering',
  R: 'Repudiation',
  I: 'Information disclosure',
  D: 'Denial of service',
  E: 'Elevation of privilege',
};

/** Approximate width of one `.t-arrow` character (9.5px mono). */
const ARROW_CH = 6;
/** The lock glyph's footprint (width) at the head of a `tls` label. */
const LOCK_W = 11;
/** The `PLAIN` chip's footprint after a `plain` label. */
const CHIP_W = 34;

/** A tiny padlock — two paths, no emoji — drawn in `muted` at (x, y) top-left, 8×10. */
function lockGlyph(x: number, y: number): string {
  return (
    `<g class="tm-lock" fill="none" stroke="var(--muted)" stroke-width="1.2">` +
    `<path d="M${x + 1.5} ${y + 4.5} V ${y + 2.5} a 2.5 2.5 0 0 1 5 0 V ${y + 4.5}"/>` +
    `<path d="M${x} ${y + 4.5} h 8 v 5.5 h -8 z"/>` +
    `</g>`
  );
}

/** The mask height of a label: one text line, plus a second line for the `PLAIN` chip. */
function labelHeight(ch: Channel): number {
  return ch === 'plain' ? 32 : 16;
}

/**
 * One edge label on a paper mask: the lock (tls) before the text; for a plain
 * hop the text reads `negative` like its edge and a `PLAIN` chip sits on a
 * second line under it, so the mask stays narrower than the gap it rides in.
 */
function channelLabel(lx: number, ly: number, label: string, ch: Channel, w: number): string {
  const h = labelHeight(ch);
  const x0 = lx - w / 2;
  const y0 = ly - h / 2;
  const cls = ch === 'plain' ? ' c-negative' : '';
  let s = `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="var(--paper)"/>`;
  const lockW = ch === 'tls' ? LOCK_W : 0;
  const textW = label !== '' ? label.length * ARROW_CH : 0;
  const tx = lx - (lockW + textW) / 2;
  const ty = y0 + 11.5;
  if (ch === 'tls') s += lockGlyph(tx, ty - 8.5);
  if (label !== '') s += `<text x="${tx + lockW}" y="${ty}" class="t-arrow${cls}">${escapeHtml(label)}</text>`;
  if (ch === 'plain') {
    const cw = CHIP_W - 4;
    const cy = y0 + 16 + 1.5;
    s +=
      `<rect x="${lx - cw / 2}" y="${cy}" width="${cw}" height="13" rx="2" fill="var(--negative-tint)" stroke="var(--negative)" stroke-width="1"/>` +
      `<text x="${lx}" y="${cy + 9.5}" class="t-eyebrow c-negative" text-anchor="middle">plain</text>`;
  }
  return s;
}

/** The label's mask width: the wider of the text line and the chip. */
function labelWidth(label: string, ch: Channel): number {
  const line = (ch === 'tls' ? LOCK_W : 0) + (label !== '' ? label.length * ARROW_CH : 0);
  return 6 + Math.max(line, ch === 'plain' ? CHIP_W : 0);
}

function channelOf(c: string | undefined): Channel {
  if (c === 'tls' || c === 'plain' || c === 'internal') return c;
  return 'none';
}

/** `from->to` / `from -> to` / `from → to` — an edge reference in a threat's `target`. */
const EDGE_REF = /^\s*(.+?)\s*(?:->|→)\s*(.+?)\s*$/;

/** Renders the STRIDE table under the drawing (`''` when there are no threats). */
function threatsTable(threats: readonly Threat[], nameOf: (id: string) => string | undefined): string {
  if (threats.length === 0) return '';
  const target = (t: string): string => {
    const m = EDGE_REF.exec(t);
    if (m !== null && m[1] !== undefined && m[2] !== undefined) {
      return `${escapeHtml(nameOf(m[1]) ?? m[1])} → ${escapeHtml(nameOf(m[2]) ?? m[2])}`;
    }
    return escapeHtml(nameOf(t.trim()) ?? t);
  };
  const rows = threats
    .map((t, i) => {
      const id = t.id !== undefined ? `<td class="tm-id"${bp(`threats.${i}.id`)}>${escapeHtml(t.id)}</td>` : `<td class="tm-id"></td>`;
      const cat = `<td><abbr class="tm-cat" title="${escapeHtml(STRIDE[t.category])}"${bp(`threats.${i}.category`)}>${t.category}</abbr></td>`;
      const tgt = `<td class="tm-target"${bp(`threats.${i}.target`)}>${target(t.target)}</td>`;
      const threat = `<td class="tm-threat"${bp(`threats.${i}.threat`)}>${escapeHtml(t.threat)}</td>`;
      const mit = `<td class="tm-mit"${t.mitigation !== undefined ? bp(`threats.${i}.mitigation`) : ''}>${t.mitigation !== undefined ? escapeHtml(t.mitigation) : '<span class="tm-none">—</span>'}</td>`;
      const sev =
        t.severity !== undefined
          ? `<td><span class="rk-sev rk-sev-${t.severity}"${bp(`threats.${i}.severity`)}>${escapeHtml(t.severity)}</span></td>`
          : `<td></td>`;
      const st =
        t.status !== undefined
          ? `<td><span class="rk-status tm-st-${t.status}"${bp(`threats.${i}.status`)}>${escapeHtml(t.status)}</span></td>`
          : `<td></td>`;
      return `<tr class="tm-row"${bp(`threats.${i}`)}>${id}${cat}${tgt}${threat}${mit}${sev}${st}</tr>`;
    })
    .join('');
  return (
    `<div class="tm-scroll"><table class="trk tm-table">` +
    `<thead><tr><th>ID</th><th>STRIDE</th><th>Target</th><th>Threat</th><th>Mitigation</th><th>Severity</th><th>Status</th></tr></thead>` +
    `<tbody${bl('threats')}>${rows}</tbody></table></div>`
  );
}

export function renderThreatmodel(data: ThreatData): string {
  const edges = data.edges ?? [];
  const rawNodes = data.nodes;
  const quick = !(rawNodes.length > 0 && rawNodes.every((n) => n.col !== undefined && n.row !== undefined));
  const nodes = ensureGrid(rawNodes, edges, data.dir ?? 'LR');
  const cellW = 148;
  const nameLines = nodes.map((n) => wrapText(n.name, 20, 3));
  const maxLines = Math.max(1, ...nameLines.map((ls) => ls.length));
  const cellH = 66 + (maxLines - 1) * 14;
  const gapX = 104;
  const gapY = 54;
  const groups = data.boundaries ?? [];
  const nestPad = nestingPads(groups);
  const padX = (groups.length > 0 ? GROUP_PADS.padX : 26) + nestPad.padX;
  const padTop = (groups.length > 0 ? GROUP_PADS.padTop : 26) + nestPad.padTop;
  const padBot = (groups.length > 0 ? GROUP_PADS.padBot : 20) + nestPad.padBot;
  const gx = groupExtent(groups);
  const cols = Math.max(1, ...nodes.map((n) => n.col), gx.cols);
  const rows = Math.max(1, ...nodes.map((n) => n.row), gx.rows);
  const xOf = (c: number): number => padX + (c - 1) * (cellW + gapX);
  const yOf = (r: number): number => padTop + (r - 1) * (cellH + gapY);
  const rectFor = (n: { col: number; row: number }): AvoidRect => ({ x: xOf(n.col), y: yOf(n.row), w: cellW, h: cellH });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const width = padX * 2 + cols * cellW + (cols - 1) * gapX;
  const height = padTop + rows * cellH + (rows - 1) * gapY + padBot;

  const gridMeta = gridMetaAttrs({ quick, cols, rows, cellW, cellH, gapX, gapY, padX, padTop });
  const a11y = svgName('Threat model', data.title, [
    countPhrase(nodes.length, 'node'),
    countPhrase(edges.length, 'flow'),
    countPhrase((data.threats ?? []).length, 'threat'),
  ]);
  let s = `<svg viewBox="0 0 ${width} ${height}"${a11y.attrs}${gridMeta}>${a11y.title}`;

  // Trust boundaries: the shared group panel, restyled by `.tm-bounds` (css.ts)
  // as a dashed negative outline with a small mono tag.
  if (groups.length > 0) {
    // The shared group painter names its list `groups`; here the field is
    // `boundaries`, so Studio's add chips and click mapping must see that.
    const painted = gridGroupsSvg(groups, { xOf, yOf, cellW, cellH, gapX, gapY, skin: true })
      .replace(/data-bl="groups"/g, 'data-bl="boundaries"')
      .replace(/data-bp="groups\./g, 'data-bp="boundaries.');
    s += `<g class="tm-bounds">${painted}</g>`;
  }

  const channelsUsed = new Set<Channel>();
  const lanes = edgeLanes(edges);
  const entries = entryPortOffsets(edges, (id) => {
    const n = byId.get(id);
    return n !== undefined ? rectFor(n) : undefined;
  });
  const labels: string[] = [];
  const avoid: AvoidRect[] = nodes.map((n) => rectFor(n));
  s += `<g${bl('edges')}>`;
  edges.forEach((e, ei) => {
    const A = byId.get(e.from);
    const B = byId.get(e.to);
    if (!A || !B) return;
    const ch = channelOf(e.channel);
    channelsUsed.add(ch);
    const p = ortho(rectFor(A), rectFor(B), lanes[ei] ?? 0, entries[ei] ?? 0);
    const plain = ch === 'plain';
    const stroke = plain ? 'var(--negative)' : 'var(--muted)';
    const dash = plain ? ' stroke-dasharray="4 3"' : '';
    const marker = plain ? 'skErr' : 'skArrow';
    s += `<path d="${p.d}" fill="none" stroke="${stroke}" stroke-width="1.5"${dash} marker-end="url(#${marker})"${bp(`edges.${ei}`)}${plain ? ' data-channel="plain"' : ''}/>`;
    const label = e.label ?? '';
    if (label === '' && ch !== 'tls' && ch !== 'plain') return;
    const w = labelWidth(label, ch);
    // The label keeps clear of every node and of every label placed before it.
    const at = dodge(p.lx, p.ly, avoid);
    const h = labelHeight(ch);
    avoid.push({ x: at.lx - w / 2, y: at.ly - h / 2, w, h });
    labels.push(`<g${bp(`edges.${ei}`)}>${channelLabel(at.lx, at.ly, label, ch, w)}</g>`);
  });
  s += `</g>`;

  const kindsUsed = new Set<DfdKind>();
  s += `<g${bl('nodes')}>`;
  nodes.forEach((n, ni) => {
    const r = rectFor(n);
    const k = dfdKindOf(n.kind);
    kindsUsed.add(k);
    const paint = dfdPaint(k, false);
    const name = dfdName(nameLines[ni] ?? [], n.name, r, false, `nodes.${ni}.name`);
    s += `<g${bp(`nodes.${ni}`)}${nodeCellAttrs(n.col, n.row)}>${dfdShape(k, r, paint)}${dfdChip(r, paint)}${name}</g>`;
  });
  s += `</g>`;
  s += labels.join(''); // labels on top, never crossed by a line
  s += `</svg>`;

  const items: LegendItem[] = [];
  if (kindsUsed.has('process')) items.push({ swatch: 'node', label: 'process' });
  if (kindsUsed.has('external')) items.push({ swatch: 'node-dashed', label: 'external entity' });
  if (kindsUsed.has('store')) items.push({ swatch: 'node-store', label: 'data store' });
  if (groups.length > 0) items.push({ swatch: 'line-dashed', stroke: 'var(--negative)', label: 'trust boundary' });
  if (channelsUsed.has('none')) items.push({ swatch: 'edge', label: 'data flow' });
  if (channelsUsed.has('tls')) items.push({ swatch: 'edge', label: 'tls (lock)' });
  if (channelsUsed.has('internal')) items.push({ swatch: 'edge', label: 'internal' });
  if (channelsUsed.has('plain')) items.push({ swatch: 'edge-negative-dashed', label: 'plain — unencrypted' });
  const legend = renderLegend(items);
  const table = threatsTable(data.threats ?? [], (id) => byId.get(id)?.name);

  return diagramFrame(
    {
      tag: 'THREAT MODEL',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legend.length > 0 ? { legendHtml: legend } : {}),
      ...(table.length > 0 ? { footerHtml: table } : {}),
    },
    s,
  );
}
