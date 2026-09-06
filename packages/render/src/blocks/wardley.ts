/**
 * Renders a `wardley` block — a value chain plotted against evolution.
 *
 * Two axes and nothing else: how visible a component is to the user (up) and
 * how evolved it is (right — genesis, custom, product, commodity). The value
 * of the map is that it forces both judgements to be stated as numbers, so
 * "we should stop building this ourselves" becomes a position rather than an
 * opinion. `movement` draws where a component is heading.
 *
 * Skin (`DESIGN.md`): a paper plot with hairline band separators and
 * `.t-eyebrow` axis titles; the chain in `muted`; components as ink-outlined
 * dots whose `kind` is told by fill and dash — `user` solid ink, `component`
 * paper, `commodity` `paper-2`, `buy` dashed — and `build`, the decision the
 * map argues for, takes the accent. Movement is a dashed `muted` arrow.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { wrapText } from '../svg/wrapText.js';
import { diagramFrame } from './frame.js';

type WardleyData = BlockDataMap['wardley'];
type Kind = 'user' | 'component' | 'commodity' | 'build' | 'buy';

const W = 880;
const H = 420;
const L = 96; // room for the visibility axis label
const R = 20;
const T = 18;
const B = 52; // the evolution band strip

/** The four evolution bands, as fractions of the x axis. */
const BANDS = [
  { at: 0, label: 'Genesis' },
  { at: 0.25, label: 'Custom-built' },
  { at: 0.5, label: 'Product' },
  { at: 0.75, label: 'Commodity' },
] as const;

const KIND_ATTRS: Record<Kind, string> = {
  user: 'fill="var(--ink)" stroke="var(--ink)" stroke-width="1.5"',
  component: 'fill="var(--paper)" stroke="var(--ink)" stroke-width="1.5"',
  commodity: 'fill="var(--paper-2)" stroke="var(--rule-solid)" stroke-width="1.5"',
  build: 'fill="var(--accent-tint)" stroke="var(--accent)" stroke-width="1.75"',
  buy: 'fill="var(--paper)" stroke="var(--ink)" stroke-width="1.25" stroke-dasharray="3 2"',
};

const KIND_LEGEND: Record<Kind, LegendItem> = {
  user: { swatch: 'fill', fill: 'var(--ink)', label: 'user' },
  component: { swatch: 'node', label: 'component' },
  commodity: { swatch: 'node-fill2', label: 'commodity' },
  build: { swatch: 'node-accent', label: 'build' },
  buy: { swatch: 'node-dashed', label: 'buy' },
};

export function renderWardley(data: WardleyData): string {
  const x0 = L;
  const x1 = W - R;
  const y0 = T;
  const y1 = H - B;
  const xAt = (v: number): number => x0 + (x1 - x0) * clamp(v);
  const yAt = (v: number): number => y1 - (y1 - y0) * clamp(v);

  let s = `<svg viewBox="0 0 ${W} ${H}" role="img"><title>${escapeHtml(data.title ?? 'Wardley map')}</title>`;

  // Plot area, evolution bands, and the two axis labels.
  s += `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="var(--paper)" stroke="var(--rule-solid)" stroke-width="1"/>`;
  BANDS.forEach((band, i) => {
    const bx = xAt(band.at);
    if (i > 0) {
      s += `<line x1="${r(bx)}" y1="${y0}" x2="${r(bx)}" y2="${y1}" stroke="var(--rule-solid)" stroke-width="1" stroke-dasharray="3 4"/>`;
    }
    const next = BANDS[i + 1]?.at ?? 1;
    s += `<text x="${r((bx + xAt(next)) / 2)}" y="${y1 + 20}" class="t-eyebrow" text-anchor="middle">${escapeHtml(band.label.toUpperCase())}</text>`;
  });
  s += `<text x="${r((x0 + x1) / 2)}" y="${y1 + 38}" class="t-eyebrow c-muted" text-anchor="middle">EVOLUTION →</text>`;
  s += `<text x="18" y="${r((y0 + y1) / 2)}" class="t-eyebrow c-muted" text-anchor="middle" transform="rotate(-90 18 ${r((y0 + y1) / 2)})">VISIBLE TO THE USER →</text>`;

  const at = new Map(
    data.components.map((c) => [c.id ?? c.label, { x: xAt(c.x), y: yAt(c.y) }]),
  );

  // The value chain, under the components.
  let hasLinks = false;
  s += `<g${bl('links')}>`;
  (data.links ?? []).forEach((l, li) => {
    const a = at.get(l.from);
    const b = at.get(l.to);
    if (a === undefined || b === undefined) return;
    hasLinks = true;
    s += `<line x1="${r(a.x)}" y1="${r(a.y)}" x2="${r(b.x)}" y2="${r(b.y)}" stroke="var(--muted)" stroke-width="1.25"${bp(`links.${li}`)}/>`;
    if (l.label !== undefined) {
      s += `<text x="${r((a.x + b.x) / 2)}" y="${r((a.y + b.y) / 2 - 5)}" class="t-arrow" text-anchor="middle">${escapeHtml(l.label)}</text>`;
    }
  });
  s += `</g>`;

  const kinds = new Set<Kind>();
  let hasMovement = false;
  s += `<g${bl('components')}>`;
  data.components.forEach((c, ci) => {
    const p = at.get(c.id ?? c.label);
    if (p === undefined) return;
    const kind: Kind = c.kind ?? 'component';
    kinds.add(kind);
    s += `<g${bp(`components.${ci}`)}>`;
    // Movement first, so the dot sits on top of its own arrow.
    if (c.movement !== undefined && c.movement !== 0) {
      hasMovement = true;
      const to = xAt(clamp(c.x) + c.movement);
      s += `<line x1="${r(p.x)}" y1="${r(p.y)}" x2="${r(to)}" y2="${r(p.y)}" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="4 3" marker-end="url(#skOpen)"/>`;
    }
    s += `<circle cx="${r(p.x)}" cy="${r(p.y)}" r="7" ${KIND_ATTRS[kind]}/>`;
    // Labels go above the dot, flipping below near the top edge.
    const above = p.y - 14 > y0 + 12;
    const lines = wrapText(c.label, 18, 2);
    const cls = kind === 'build' ? 't-name c-accent' : 't-name';
    lines.forEach((line, li) => {
      const y = above ? p.y - 14 - (lines.length - 1 - li) * 14 : p.y + 22 + li * 14;
      s += `<text x="${r(p.x)}" y="${r(y)}" class="${cls}" text-anchor="middle">${escapeHtml(line)}</text>`;
    });
    s += `</g>`;
  });
  s += `</g></svg>`;

  const items: LegendItem[] = (['user', 'component', 'commodity', 'build', 'buy'] as const)
    .filter((k) => kinds.has(k))
    .map((k) => KIND_LEGEND[k]);
  if (hasLinks) items.push({ swatch: 'edge', label: 'depends on' });
  if (hasMovement) items.push({ swatch: 'edge-dashed', label: 'movement' });
  const legendHtml = renderLegend(items);

  return diagramFrame(
    {
      tag: 'WARDLEY',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legendHtml.length > 0 ? { legendHtml } : {}),
    },
    s,
  );
}

function clamp(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function r(v: number): number {
  return Math.round(v * 10) / 10;
}
