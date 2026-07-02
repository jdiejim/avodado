/**
 * Renders an `inventory` block — a component / feature status board as
 * compact hairline-separated rows (not cards), scannable like a status page.
 * Each row: the name in bold with an optional tiny mono tag chip, an optional
 * note beneath, and a right-aligned colour-coded status chip (stable green ·
 * beta blue · experimental purple · deprecated red · planned gray).
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';

type InventoryData = BlockDataMap['inventory'];
type InventoryItem = InventoryData['items'][number];

/** Status → chip class (colour-coded in css.ts). */
const STATUS_CLASS: Record<InventoryItem['status'], string> = {
  stable: 'inv-st-stable',
  beta: 'inv-st-beta',
  experimental: 'inv-st-experimental',
  deprecated: 'inv-st-deprecated',
  planned: 'inv-st-planned',
};

function renderRow(item: InventoryItem): string {
  const tag = item.tag !== undefined ? `<span class="inv-tag">${escapeHtml(item.tag)}</span>` : '';
  const note =
    item.note !== undefined ? `<div class="inv-note">${escapeHtml(item.note)}</div>` : '';
  return (
    `<div class="inv-row">` +
    `<div class="inv-main">` +
    `<div class="inv-top"><span class="inv-name">${escapeHtml(item.name)}</span>${tag}</div>` +
    note +
    `</div>` +
    `<span class="inv-status ${STATUS_CLASS[item.status]}">${escapeHtml(item.status)}</span>` +
    `</div>`
  );
}

export function renderInventory(data: InventoryData): string {
  const head =
    data.title !== undefined ? `<div class="inv-head">${escapeHtml(data.title)}</div>` : '';
  const desc =
    data.description !== undefined
      ? `<p class="inv-desc">${escapeHtml(data.description)}</p>`
      : '';
  const rows = data.items.map(renderRow).join('');
  return `<div class="inventory">${head}${desc}<div class="inv-list">${rows}</div></div>`;
}
