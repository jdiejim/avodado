/**
 * Renders a `dodont` block — do / don't guideline cards on a 2-column grid
 * (1 column on mobile). The DO card has a positive-soft header band with a ✓
 * circle and a "DO" label; the DON'T card mirrors it in negative tones with ✕.
 * Each item is a 13px guideline with a small coloured marker; an optional
 * `example` renders beneath as an 11.5px mono chip. Cards align top with
 * independent heights.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';

type DodontData = BlockDataMap['dodont'];
type DodontItem = DodontData['dos'][number];

function renderItem(item: DodontItem): string {
  const example =
    item.example !== undefined ? `<div class="dd-ex">${escapeHtml(item.example)}</div>` : '';
  return `<div class="dd-item"><div class="dd-text">${escapeHtml(item.text)}</div>${example}</div>`;
}

function renderCard(
  kind: 'dd-do' | 'dd-dont',
  sign: string,
  label: string,
  items: readonly DodontItem[],
): string {
  return (
    `<div class="dd-card ${kind}">` +
    `<div class="dd-band">` +
    `<span class="dd-sign">${sign}</span>` +
    `<span class="dd-label">${escapeHtml(label)}</span>` +
    `</div>` +
    `<div class="dd-list">${items.map(renderItem).join('')}</div>` +
    `</div>`
  );
}

export function renderDodont(data: DodontData): string {
  const head =
    data.title !== undefined ? `<div class="dd-head">${escapeHtml(data.title)}</div>` : '';
  const desc =
    data.description !== undefined
      ? `<p class="dd-desc">${escapeHtml(data.description)}</p>`
      : '';
  return (
    `<div class="dodont">${head}${desc}` +
    `<div class="dd-grid">` +
    renderCard('dd-do', '✓', 'Do', data.dos) +
    renderCard('dd-dont', '✕', "Don't", data.donts) +
    `</div>` +
    `</div>`
  );
}
