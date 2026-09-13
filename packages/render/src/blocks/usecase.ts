/**
 * Renders a `usecase` block — a UML use-case diagram: actors outside the
 * system boundary, use cases as ellipses inside it, associations between
 * them, and `include` / `extend` / `generalize` relations between cases.
 *
 * Layout: cases stack in one column (two columns, filled column-major, past
 * six) inside the boundary; actors sit in a column to the left (`side:
 * right` moves one to the right), each placed at the mean height of the
 * cases it links to and then spread apart so no two overlap. That keeps the
 * association lines short and mostly uncrossed without any author geometry.
 *
 * Skin (`DESIGN.md`): a person is a stick figure in ink, a system actor a
 * dashed box (external), a time actor a clock glyph; the boundary is the
 * inactive panel with the system name as an eyebrow; associations are plain
 * `muted` lines, `include` / `extend` dashed with an open head and their
 * stereotype on a paper mask, `generalize` solid with a hollow triangle.
 * Zero accent.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { edgeLabelLayer, type EdgeLabelPoint } from '../svg/edgeSteps.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { countPhrase, svgName } from '../svg/svgTitle.js';
import { wrapText } from '../svg/wrapText.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';

type Actor = BlockDataMap['usecase']['actors'][number];
type ActorKind = NonNullable<Actor['kind']>;

const RX = 76;
const RY = 27;
const ROW_STEP = 2 * RY + 22;
const COL_STEP = 2 * RX + 44;
const BOUND_PAD = 26;
const BOUND_HEAD = 30;
const ACTOR_COL_W = 118;
const ACTOR_SLOT = 84;
const GUTTER = 44;
const PAD_Y = 22;

/** Where a ray from the ellipse centre toward (px, py) leaves the ellipse. */
function ellipseEdge(cx: number, cy: number, px: number, py: number): { x: number; y: number } {
  const dx = px - cx;
  const dy = py - cy;
  if (dx === 0 && dy === 0) return { x: cx + RX, y: cy };
  const t = 1 / Math.sqrt((dx * dx) / (RX * RX) + (dy * dy) / (RY * RY));
  return { x: cx + dx * t, y: cy + dy * t };
}

function actorGlyph(kind: ActorKind, x: number, y: number): string {
  const ink = 'fill="none" stroke="var(--ink)" stroke-width="1.5" stroke-linecap="round"';
  if (kind === 'system') {
    return (
      `<rect x="${x - 22}" y="${y - 20}" width="44" height="40" rx="3" fill="var(--paper)" stroke="var(--ink)" stroke-width="1.25" stroke-dasharray="4 3"/>` +
      `<text x="${x}" y="${y + 3.5}" class="t-eyebrow" text-anchor="middle">SYS</text>`
    );
  }
  if (kind === 'time') {
    return (
      `<circle cx="${x}" cy="${y}" r="15" fill="var(--paper)" stroke="var(--ink)" stroke-width="1.5"/>` +
      `<path d="M${x} ${y - 9} V${y} H${x + 7}" ${ink}/>`
    );
  }
  return (
    `<circle cx="${x}" cy="${y - 15}" r="6" fill="var(--paper)" stroke="var(--ink)" stroke-width="1.5"/>` +
    `<path d="M${x} ${y - 9} V${y + 6} M${x - 11} ${y - 3} H${x + 11} M${x} ${y + 6} L${x - 9} ${y + 20} M${x} ${y + 6} L${x + 9} ${y + 20}" ${ink}/>`
  );
}

export function renderUsecase(data: BlockDataMap['usecase']): string {
  const actors = data.actors;
  const cases = data.cases;
  const links = data.links ?? [];
  const relations = data.relations ?? [];
  const caseIdx = new Map(cases.map((c, i) => [c.id, i]));
  const actorIdx = new Map(actors.map((a, i) => [a.id, i]));

  // Cases: one column up to six, then two columns filled column-major.
  const cols = cases.length > 6 ? 2 : 1;
  const rows = Math.ceil(cases.length / cols);
  const hasNote = cases.some((c) => c.note !== undefined);
  const rowStep = ROW_STEP + (hasNote ? 12 : 0);
  const boundW = BOUND_PAD * 2 + cols * COL_STEP - (COL_STEP - 2 * RX);
  const boundH = BOUND_HEAD + BOUND_PAD + rows * rowStep - (rowStep - 2 * RY) + BOUND_PAD;

  const leftActors = actors.filter((a) => a.side !== 'right');
  const rightActors = actors.filter((a) => a.side === 'right');
  const leftW = leftActors.length > 0 ? ACTOR_COL_W + GUTTER : 0;
  const rightW = rightActors.length > 0 ? ACTOR_COL_W + GUTTER : 0;
  const boundX = 20 + leftW;
  const boundY = PAD_Y;

  const caseCenter = (i: number): { x: number; y: number } => {
    const col = Math.floor(i / rows);
    const row = i % rows;
    return {
      x: boundX + BOUND_PAD + RX + col * COL_STEP,
      y: boundY + BOUND_HEAD + BOUND_PAD + RY + row * rowStep,
    };
  };

  // Actors: each at the mean y of its cases, then spread so slots never overlap.
  const place = (list: Actor[]): Map<string, number> => {
    const want = list.map((a) => {
      const ys = links
        .filter((l) => l.from === a.id && caseIdx.has(l.to))
        .map((l) => caseCenter(caseIdx.get(l.to) ?? 0).y);
      return { id: a.id, y: ys.length > 0 ? ys.reduce((p, q) => p + q, 0) / ys.length : boundY + boundH / 2 };
    });
    const order = want.map((_, i) => i).sort((p, q) => (want[p]?.y ?? 0) - (want[q]?.y ?? 0) || p - q);
    const ys: number[] = [];
    const minY = boundY + ACTOR_SLOT / 2;
    order.forEach((oi, k) => {
      const prev = ys[k - 1];
      const y = Math.max(want[oi]?.y ?? 0, minY, prev !== undefined ? prev + ACTOR_SLOT : -Infinity);
      ys.push(y);
    });
    const out = new Map<string, number>();
    order.forEach((oi, k) => out.set(want[oi]?.id ?? '', ys[k] ?? 0));
    return out;
  };
  const leftY = place(leftActors);
  const rightY = place(rightActors);
  const actorPos = (a: Actor): { x: number; y: number } =>
    a.side === 'right'
      ? { x: boundX + boundW + GUTTER + ACTOR_COL_W / 2, y: rightY.get(a.id) ?? 0 }
      : { x: 20 + ACTOR_COL_W / 2, y: leftY.get(a.id) ?? 0 };

  const lowest = Math.max(boundY + boundH, ...actors.map((a) => actorPos(a).y + ACTOR_SLOT / 2));
  const width = 20 + leftW + boundW + rightW + 20;
  const height = lowest + PAD_Y;
  const r = (v: number): number => Math.round(v * 10) / 10;

  const a11y = svgName('Use-case diagram', data.system ?? data.title, [
    countPhrase(actors.length, 'actor'),
    countPhrase(cases.length, 'use case'),
  ]);
  let s = `<svg viewBox="0 0 ${r(width)} ${r(height)}"${a11y.attrs}>${a11y.title}`;
  s +=
    `<defs><marker id="ucTri" viewBox="0 0 14 14" refX="13" refY="7" markerWidth="13" markerHeight="13" markerUnits="userSpaceOnUse" orient="auto-start-reverse">` +
    `<path d="M1,1 L13,7 L1,13 z" fill="var(--paper)" stroke="var(--ink)" stroke-width="1.2"/></marker></defs>`;

  // The system boundary.
  s += `<g${bp('system')}><rect x="${boundX}" y="${boundY}" width="${r(boundW)}" height="${r(boundH)}" rx="8" fill="var(--paper-2)" stroke="var(--rule-solid)" stroke-width="1"/>`;
  if (data.system !== undefined) {
    s += `<text x="${boundX + 14}" y="${boundY + 19}" class="t-eyebrow">${escapeHtml(data.system)}</text>`;
  }
  s += `</g>`;

  // Associations, beneath the shapes.
  const pending: EdgeLabelPoint[] = [];
  s += `<g${bl('links')}>`;
  links.forEach((l, li) => {
    const a = actors[actorIdx.get(l.from) ?? -1];
    const ci = caseIdx.get(l.to);
    if (a === undefined || ci === undefined) return;
    const ap = actorPos(a);
    const cc = caseCenter(ci);
    const e = ellipseEdge(cc.x, cc.y, ap.x, ap.y);
    const sx = ap.x + (a.side === 'right' ? -24 : 24);
    s += `<line x1="${r(sx)}" y1="${r(ap.y)}" x2="${r(e.x)}" y2="${r(e.y)}" stroke="var(--muted)" stroke-width="1.25"${bp(`links.${li}`)}/>`;
    if (l.label !== undefined) pending.push({ lx: (sx + e.x) / 2, ly: (ap.y + e.y) / 2, label: l.label, path: `links.${li}` });
  });
  s += `</g>`;

  // Relations between cases.
  const relKinds = new Set<string>();
  s += `<g${bl('relations')}>`;
  relations.forEach((rel, ri) => {
    const fi = caseIdx.get(rel.from);
    const ti = caseIdx.get(rel.to);
    if (fi === undefined || ti === undefined || fi === ti) return;
    relKinds.add(rel.kind);
    const A = caseCenter(fi);
    const B = caseCenter(ti);
    const sameCol = Math.floor(fi / rows) === Math.floor(ti / rows);
    const adjacent = sameCol && Math.abs(fi - ti) === 1;
    const stroke = 'stroke="var(--muted)" stroke-width="1.25"';
    const head = rel.kind === 'generalize' ? 'url(#ucTri)' : 'url(#skOpen)';
    const dash = rel.kind === 'generalize' ? '' : ' stroke-dasharray="5 4"';
    const stereo = rel.kind === 'generalize' ? undefined : `«${rel.kind}»`;
    const label = [stereo, rel.label].filter((t) => t !== undefined).join(' ');
    let d: string;
    let lx: number;
    let ly: number;
    if (sameCol && !adjacent) {
      // Bow past the neighbours in between, on the side away from the actors.
      const col = Math.floor(fi / rows);
      const bow = cols === 2 ? (col === 0 ? -1 : 1) : rightActors.length > 0 && leftActors.length === 0 ? -1 : 1;
      const p = ellipseEdge(A.x, A.y, A.x + bow * RX * 2, A.y + (B.y - A.y) * 0.3);
      const q = ellipseEdge(B.x, B.y, B.x + bow * RX * 2, B.y - (B.y - A.y) * 0.3);
      const qx = A.x + bow * (RX + 34);
      const qy = (A.y + B.y) / 2;
      d = `M${r(p.x)} ${r(p.y)} Q${r(qx)} ${r(qy)} ${r(q.x)} ${r(q.y)}`;
      lx = (p.x + 2 * qx + q.x) / 4;
      ly = qy;
    } else {
      const p = ellipseEdge(A.x, A.y, B.x, B.y);
      const q = ellipseEdge(B.x, B.y, A.x, A.y);
      d = `M${r(p.x)} ${r(p.y)} L${r(q.x)} ${r(q.y)}`;
      lx = (p.x + q.x) / 2;
      ly = (p.y + q.y) / 2;
    }
    s += `<path d="${d}" fill="none" ${stroke}${dash} marker-end="${head}"${bp(`relations.${ri}`)}/>`;
    if (label.length > 0) pending.push({ lx, ly, label, path: `relations.${ri}` });
  });
  s += `</g>`;

  // Use cases.
  const avoid: Array<{ x: number; y: number; w: number; h: number }> = [];
  s += `<g${bl('cases')}>`;
  cases.forEach((c, ci) => {
    const p = caseCenter(ci);
    avoid.push({ x: p.x - RX, y: p.y - RY, w: 2 * RX, h: 2 * RY });
    const lines = wrapText(c.name, 18, 2);
    const noteLine = c.note !== undefined ? (wrapText(c.note, 22, 1)[0] ?? '') : undefined;
    const blockH = lines.length * 14 + (noteLine !== undefined ? 12 : 0);
    const y0 = p.y + 4.5 - blockH / 2 + 7;
    let g = `<g${bp(`cases.${ci}`)}><ellipse cx="${r(p.x)}" cy="${r(p.y)}" rx="${RX}" ry="${RY}" fill="var(--paper)" stroke="var(--ink)" stroke-width="1.5"/>`;
    g += `<g${bp(`cases.${ci}.name`)}>`;
    lines.forEach((ln, li) => {
      g += `<text x="${r(p.x)}" y="${r(y0 + li * 14)}" class="t-name" text-anchor="middle">${escapeHtml(ln)}</text>`;
    });
    g += `</g>`;
    if (noteLine !== undefined) {
      const title = noteLine !== c.note ? `<title>${escapeHtml(c.note)}</title>` : '';
      g += `<text x="${r(p.x)}" y="${r(y0 + lines.length * 14 - 1)}" class="t-sub" text-anchor="middle"${bp(`cases.${ci}.note`)}>${title}${escapeHtml(noteLine)}</text>`;
    }
    g += `</g>`;
    s += g;
  });
  s += `</g>`;

  // Actors.
  const actorKinds = new Set<ActorKind>();
  s += `<g${bl('actors')}>`;
  actors.forEach((a, ai) => {
    const kind: ActorKind = a.kind ?? 'person';
    actorKinds.add(kind);
    const p = actorPos(a);
    avoid.push({ x: p.x - ACTOR_COL_W / 2, y: p.y - ACTOR_SLOT / 2, w: ACTOR_COL_W, h: ACTOR_SLOT });
    const lines = wrapText(a.name, 16, 2);
    let g = `<g${bp(`actors.${ai}`)}>${actorGlyph(kind, p.x, p.y)}`;
    g += `<g${bp(`actors.${ai}.name`)}>`;
    lines.forEach((ln, li) => {
      g += `<text x="${r(p.x)}" y="${r(p.y + 34 + li * 14)}" class="t-name" text-anchor="middle">${escapeHtml(ln)}</text>`;
    });
    g += `</g></g>`;
    s += g;
  });
  s += `</g>`;

  const { overlay, legend: steps } = edgeLabelLayer(pending, avoid, { skin: true });
  s += overlay;
  s += `</svg>`;

  const items: LegendItem[] = [{ swatch: 'node-stadium', label: 'use case' }];
  if (actorKinds.has('system')) items.push({ swatch: 'node-dashed', label: 'external system' });
  if (links.length > 0) items.push({ swatch: 'line', label: 'association' });
  if (relKinds.has('include')) items.push({ swatch: 'edge-dashed', label: '«include»' });
  if (relKinds.has('extend')) items.push({ swatch: 'edge-dashed', label: '«extend»' });
  if (relKinds.has('generalize')) items.push({ swatch: 'edge-implements', label: 'generalizes' });
  const legend = renderLegend(items);

  return diagramFrame(
    {
      tag: 'USE CASE',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legend.length > 0 ? { legendHtml: legend } : {}),
    },
    s + steps,
  );
}
