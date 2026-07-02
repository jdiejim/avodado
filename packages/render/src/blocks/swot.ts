/**
 * Renders a `swot` block — the classic strengths / weaknesses / opportunities
 * / threats 2×2. Four quadrant cards on a 2-column grid (1 column on mobile),
 * each with a coloured top bar, a soft background wash, a small uppercase
 * header, and a compact list. All four quadrants always draw — an empty one
 * just shows its header — so the shape reads as a SWOT at a glance.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';

type SwotData = BlockDataMap['swot'];

interface Quadrant {
  readonly key: 's' | 'w' | 'o' | 't';
  readonly label: string;
  readonly items: readonly string[];
}

function renderQuadrant(q: Quadrant): string {
  const items = q.items
    .map((it) => `<li class="swot-item">${escapeHtml(it)}</li>`)
    .join('');
  const list = items !== '' ? `<ul class="swot-list">${items}</ul>` : '';
  return (
    `<div class="swot-quad swot-${q.key}">` +
    `<div class="swot-label">${escapeHtml(q.label)}</div>` +
    list +
    `</div>`
  );
}

export function renderSwot(data: SwotData): string {
  const head =
    data.title !== undefined ? `<div class="swot-head">${escapeHtml(data.title)}</div>` : '';
  const desc =
    data.description !== undefined
      ? `<p class="swot-desc">${escapeHtml(data.description)}</p>`
      : '';
  const quads: readonly Quadrant[] = [
    { key: 's', label: 'Strengths', items: data.strengths ?? [] },
    { key: 'w', label: 'Weaknesses', items: data.weaknesses ?? [] },
    { key: 'o', label: 'Opportunities', items: data.opportunities ?? [] },
    { key: 't', label: 'Threats', items: data.threats ?? [] },
  ];
  const grid = quads.map(renderQuadrant).join('');
  return `<div class="swot">${head}${desc}<div class="swot-grid">${grid}</div></div>`;
}
