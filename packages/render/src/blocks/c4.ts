/**
 * Renders a C4 model diagram (context / container / component levels).
 *
 * Per-node colour comes from a kind+family lookup (`c4Style`). Optional
 * boundary box wraps the internal nodes (container/component/store). A legend
 * sits below the SVG.
 *
 * Ported from doc-studio.jsx `C4Diagram` + `c4Style`.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { ortho } from '../svg/ortho.js';
import { wrapText } from '../svg/wrapText.js';
import { edgeStep, stepsLegend } from '../svg/edgeSteps.js';
import { GEDGE } from '../svg/blockStyle.js';
import { safeColor } from '../sanitize.js';
import { diagramFrame } from './frame.js';
import { ensureGrid } from './autoLayout.js';

type Node = NonNullable<BlockDataMap['c4']['nodes']>[number];

interface C4Style {
  accent: string;
  fill: string;
  text: string;
  sub: string;
  chip: string;
  solid?: boolean;
  dash?: string;
}

function c4Style(n: Node): C4Style {
  const f = (n.family ?? '').toLowerCase();
  switch (n.kind) {
    case 'person':
      return {
        accent: '#0e54a1',
        fill: '#0e54a1',
        text: '#fff',
        sub: '#cfe0f3',
        chip: 'Person',
        solid: true,
      };
    case 'system':
      return {
        accent: '#1f9747',
        fill: '#dcf1e2',
        text: '#0f3d22',
        sub: '#356b49',
        chip: 'Software System',
      };
    case 'external':
      return {
        accent: '#6b7280',
        fill: '#f3f4f6',
        text: '#374151',
        sub: '#6b7280',
        chip: 'External System',
        dash: '5 4',
      };
    case 'store':
      return {
        accent: '#f7952c',
        fill: '#fde7cd',
        text: '#7a3d00',
        sub: '#9a5a12',
        chip: 'Database',
      };
    case 'component':
      if (f === 'repo')
        return {
          accent: '#374151',
          fill: '#f3f4f6',
          text: 'var(--charcoal)',
          sub: '#374151',
          chip: 'Component',
        };
      if (f === 'external')
        return {
          accent: '#6b7280',
          fill: '#fff',
          text: '#374151',
          sub: '#6b7280',
          chip: 'External',
          dash: '4 3',
        };
      if (f === 'controller')
        return {
          accent: '#0e54a1',
          fill: '#e5eff8',
          text: '#0a3a6e',
          sub: '#365f86',
          chip: 'Component',
        };
      return {
        accent: '#1f9747',
        fill: '#dcf1e2',
        text: '#0f3d22',
        sub: '#356b49',
        chip: 'Component',
      };
    default:
      if (f === 'data')
        return {
          accent: '#6b21a8',
          fill: '#ede9fe',
          text: '#4a1772',
          sub: '#6b21a8',
          chip: 'Container',
        };
      if (f === 'service')
        return {
          accent: '#1f9747',
          fill: '#dcf1e2',
          text: '#0f3d22',
          sub: '#356b49',
          chip: 'Container',
        };
      if (f === 'client')
        return {
          accent: '#0e54a1',
          fill: '#e5eff8',
          text: '#0a3a6e',
          sub: '#365f86',
          chip: 'Container',
        };
      if (f === 'store')
        return {
          accent: '#f7952c',
          fill: '#fde7cd',
          text: '#7a3d00',
          sub: '#9a5a12',
          chip: 'Database',
        };
      return {
        accent: '#0e54a1',
        fill: '#e5eff8',
        text: '#0a3a6e',
        sub: '#365f86',
        chip: 'Container',
      };
  }
}

export function renderC4(data: BlockDataMap['c4']): string {
  const edges = data.edges ?? [];
  const nodes = ensureGrid(data.nodes ?? [], edges, 'TB');
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const cellW = 212;
  const cellH = 112;
  const gapX = 56;
  const gapY = 64;
  const padX = 26;
  const padTop = 46;
  const padBot = 24;
  const cols = Math.max(1, ...nodes.map((n) => n.col + ((n.w ?? 1) - 1)));
  const rows = Math.max(1, ...nodes.map((n) => n.row));
  const rectFor = (n: Node & { col: number; row: number }): {
    x: number;
    y: number;
    w: number;
    h: number;
  } => ({
    x: padX + (n.col - 1) * (cellW + gapX),
    y: padTop + (n.row - 1) * (cellH + gapY),
    w: (n.w ?? 1) * cellW + ((n.w ?? 1) - 1) * gapX,
    h: cellH,
  });
  const width = padX * 2 + cols * cellW + (cols - 1) * gapX;
  const height = padTop + rows * cellH + (rows - 1) * gapY + padBot;

  // Boundary box around the "internal" nodes (container/component/store)
  let boundarySvg = '';
  if (data.boundary !== undefined) {
    const internals = nodes
      .filter((n) => n.kind === 'container' || n.kind === 'component' || n.kind === 'store')
      .map(rectFor);
    if (internals.length > 0) {
      const minX = Math.min(...internals.map((r) => r.x)) - 16;
      const minY = Math.min(...internals.map((r) => r.y)) - 26;
      const maxX = Math.max(...internals.map((r) => r.x + r.w)) + 16;
      const maxY = Math.max(...internals.map((r) => r.y + r.h)) + 16;
      const w = Math.max(120, data.boundary.label.length * 6.2);
      boundarySvg =
        `<g>` +
        `<rect x="${minX}" y="${minY}" width="${maxX - minX}" height="${maxY - minY}" rx="12" class="c4-boundary"/>` +
        `<rect x="${minX + 12}" y="${minY - 8}" width="${w}" height="16" fill="#fff"/>` +
        `<text x="${minX + 16}" y="${minY + 4}" class="c4-boundary-label">${escapeHtml(data.boundary.label)}</text>` +
        `</g>`;
    }
  }

  // Named boundaries: each draws a dashed box fitted around its listed node
  // ids — so one diagram can show several systems / zones side by side.
  let namedBoundariesSvg = '';
  for (const b of data.boundaries ?? []) {
    const rs = b.nodes
      .map((id) => byId.get(id))
      .filter((n): n is NonNullable<typeof n> => n !== undefined)
      .map(rectFor);
    if (rs.length === 0) continue;
    const minX = Math.min(...rs.map((r) => r.x)) - 16;
    const minY = Math.min(...rs.map((r) => r.y)) - 26;
    const maxX = Math.max(...rs.map((r) => r.x + r.w)) + 16;
    const maxY = Math.max(...rs.map((r) => r.y + r.h)) + 16;
    const col = safeColor(b.color, '#64748b');
    const lw = Math.max(120, b.label.length * 6.2);
    namedBoundariesSvg +=
      `<g>` +
      `<rect x="${minX}" y="${minY}" width="${maxX - minX}" height="${maxY - minY}" rx="12" fill="none" stroke="${col}" stroke-opacity="0.7" stroke-width="1.3" stroke-dasharray="7 5"/>` +
      `<rect x="${minX + 12}" y="${minY - 8}" width="${lw}" height="16" fill="#fff"/>` +
      `<text x="${minX + 16}" y="${minY + 4}" class="c4-boundary-label" style="fill:${col}">${escapeHtml(b.label)}</text>` +
      `</g>`;
  }

  let s = `<svg viewBox="0 0 ${width} ${height}" role="img"><title>C4 diagram</title>${boundarySvg}${namedBoundariesSvg}`;

  // Labelled edges render as circled step numerals (the agent-loop language) —
  // the label text moves to a legend under the SVG, so dense diagrams stay clean.
  const labels: string[] = [];
  const steps: Array<{ label: string; err?: boolean }> = [];
  for (const e of edges) {
    const A = byId.get(e.from);
    const B = byId.get(e.to);
    if (!A || !B) continue;
    const p = ortho(rectFor(A), rectFor(B));
    const st = GEDGE[e.kind ?? 'solid'] ??
      GEDGE['solid'] ?? {
        stroke: 'var(--charcoal)',
        sw: 1.4,
        dash: '',
        marker: 'gArrow',
        err: false,
      };
    s += `<path d="${p.d}" fill="none" stroke="${st.stroke}" stroke-width="${st.sw}" stroke-dasharray="${st.dash}" marker-end="url(#${st.marker})"/>`;
    // C4 convention: the relationship label plus its technology in brackets.
    const pillLabel =
      e.tech !== undefined
        ? `${e.label !== undefined ? `${e.label} ` : ''}[${e.tech}]`
        : e.label;
    if (pillLabel !== undefined && pillLabel !== '') {
      steps.push({ label: pillLabel, ...(st.err ? { err: true } : {}) });
      labels.push(edgeStep(p, steps.length, st.err));
    }
  }

  for (const n of nodes) {
    const r = rectFor(n);
    const st = c4Style(n);
    const cxN = r.x + r.w / 2;
    // Stores render as the canonical database cylinder (content shifts down
    // past the rim); everything else is the clean rounded card.
    const isStore = n.kind === 'store';
    const dy = isStore ? 10 : 0;
    const desc = wrapText(n.desc, 32, isStore ? 1 : 2);
    const strokeWidth = st.solid === true ? 0 : 1.2;
    const strokeAttr = st.solid === true ? 'none' : st.accent;
    const dashAttr = st.dash !== undefined ? ` stroke-dasharray="${st.dash}"` : '';
    const card = isStore
      ? `<path d="M${r.x} ${r.y + 12} A ${r.w / 2} 12 0 0 1 ${r.x + r.w} ${r.y + 12} V ${r.y + r.h - 12} A ${r.w / 2} 12 0 0 1 ${r.x} ${r.y + r.h - 12} Z" fill="${st.fill}" stroke="${st.accent}" stroke-width="1.2"/>` +
        `<path d="M${r.x} ${r.y + 12} A ${r.w / 2} 12 0 0 0 ${r.x + r.w} ${r.y + 12}" fill="none" stroke="${st.accent}" stroke-width="1.2"/>`
      : `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="10" fill="${st.fill}" stroke="${strokeAttr}" stroke-width="${strokeWidth}"${dashAttr}/>`;
    // Person glyph sits in the top-right corner, clear of the centered text.
    const gx = r.x + r.w - 26;
    const personGlyph =
      n.kind === 'person'
        ? `<g fill="${st.text}"><circle cx="${gx + 7}" cy="${r.y + 18}" r="6"/><path d="M ${gx} ${r.y + 33} a 7 8 0 0 1 14 0 z"/></g>`
        : '';
    const chipFill = st.solid === true ? st.sub : st.accent;
    // Structurizr-style centered typography: kind chip · name · tech chip · desc.
    const techLine =
      n.tech !== undefined
        ? (() => {
            const tw = Math.min(n.tech.length * 5.6 + 14, r.w - 32);
            return (
              `<rect x="${(cxN - tw / 2).toFixed(1)}" y="${r.y + 52 + dy}" width="${tw.toFixed(1)}" height="15" rx="7.5" fill="${st.accent}" fill-opacity="${st.solid === true ? '0.28' : '0.12'}"/>` +
              `<text x="${cxN}" y="${r.y + 63 + dy}" class="c4-tech" fill="${st.sub}" text-anchor="middle">${escapeHtml(n.tech)}</text>`
            );
          })()
        : '';
    const descLines = desc
      .map(
        (ln, j) =>
          `<text x="${cxN}" y="${r.y + 82 + dy + j * 13}" class="c4-desc" fill="${st.sub}" text-anchor="middle">${escapeHtml(ln)}</text>`,
      )
      .join('');
    s +=
      `<g filter="url(#gshadow)">` +
      card +
      personGlyph +
      `<text x="${cxN}" y="${r.y + 22 + dy}" class="c4-chip" fill="${chipFill}" text-anchor="middle">${escapeHtml(st.chip)}</text>` +
      `<text x="${cxN}" y="${r.y + 44 + dy}" class="c4-name" fill="${st.text}" text-anchor="middle">${escapeHtml(n.name)}</text>` +
      techLine +
      descLines +
      `</g>`;
  }

  s += labels.join(''); // labels on top, never crossed by a line
  s += `</svg>`;
  // Legend derives from the kinds actually present — no boilerplate rows.
  const usedLegend = new Map<string, string>();
  for (const n of nodes) {
    const st = c4Style(n);
    if (!usedLegend.has(st.chip)) usedLegend.set(st.chip, st.solid === true ? st.accent : st.fill);
  }
  const legend =
    `<div class="legend">` +
    [...usedLegend]
      .map(
        ([label, sw]) =>
          `<span class="item"><span class="sw" style="background:${sw};border:1px solid #d1d5db"></span>${escapeHtml(label)}</span>`,
      )
      .join('') +
    `</div>`;

  return diagramFrame(
    {
      tag: data.level !== undefined ? `C4 · ${data.level.toUpperCase()}` : 'C4',
      tagClass: 'c4',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
    },
    s + stepsLegend(steps) + legend,
  );
}
