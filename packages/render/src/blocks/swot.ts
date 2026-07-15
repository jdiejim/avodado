/**
 * Renders a `swot` block — the classic strengths / weaknesses / opportunities
 * / threats 2×2. Four quadrant cards on a 2-column grid (1 column on mobile),
 * each with a coloured top bar, a soft background wash, a small uppercase
 * header, and a compact list. All four quadrants always draw — an empty one
 * just shows its header — so the shape reads as a SWOT at a glance.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';

type SwotData = BlockDataMap['swot'];

interface Quadrant {
  readonly key: 's' | 'w' | 'o' | 't';
  /** Schema field name of this quadrant's string array (data path root). */
  readonly path: 'strengths' | 'weaknesses' | 'opportunities' | 'threats';
  readonly label: string;
  readonly items: readonly string[];
}

function renderQuadrant(q: Quadrant): string {
  const items = q.items
    .map((it, i) => `<li class="swot-item"${bp(`${q.path}.${i}`)}>${escapeHtml(it)}</li>`)
    .join('');
  const list = items !== '' ? `<ul class="swot-list">${items}</ul>` : '';
  // The quadrant card is the array container (not the <ul>) so the container
  // path survives even when the quadrant is empty and no list is drawn.
  return (
    `<div class="swot-quad swot-${q.key}"${bl(q.path)}>` +
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
    { key: 's', path: 'strengths', label: 'Strengths', items: data.strengths ?? [] },
    { key: 'w', path: 'weaknesses', label: 'Weaknesses', items: data.weaknesses ?? [] },
    { key: 'o', path: 'opportunities', label: 'Opportunities', items: data.opportunities ?? [] },
    { key: 't', path: 'threats', label: 'Threats', items: data.threats ?? [] },
  ];
  const grid = quads.map(renderQuadrant).join('');
  return `<div class="swot">${head}${desc}<div class="swot-grid">${grid}</div></div>`;
}
