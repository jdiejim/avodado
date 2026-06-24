/**
 * Renders a `drivers` block — a grid of factor/driver cards, each with an
 * optional line-icon, a coloured top accent, a title, body, and a small tag.
 * Good for "the N forces/requirements that shaped this" overviews.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';

type DriverItem = NonNullable<BlockDataMap['drivers']['items']>[number];

/** A small set of stroked 24×24 line icons (drawn with currentColor). */
export const ICONS: Readonly<Record<string, string>> = {
  location: '<path d="M12 21s-7-6.3-7-11a7 7 0 0 1 14 0c0 4.7-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  shield: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/>',
  grid: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
  lock: '<rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="16" r="1.5"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M17 5l2 2M14 8l2 2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  doc: '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/>',
  link: '<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  server: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>',
  layers: '<path d="M12 2l9 5-9 5-9-5 9-5z"/><path d="M3 12l9 5 9-5"/><path d="M3 17l9 5 9-5"/>',
};

function renderDriver(item: DriverItem): string {
  const accent = item.accent !== undefined ? ` dv-${item.accent}` : '';
  const iconPaths = item.icon !== undefined ? (ICONS[item.icon] ?? '<circle cx="12" cy="12" r="8"/>') : '';
  const icon =
    iconPaths !== ''
      ? `<svg class="dv-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths}</svg>`
      : '';
  const body = item.body !== undefined ? `<div class="dv-sub">${escapeHtml(item.body)}</div>` : '';
  const tag = item.tag !== undefined ? `<div class="dv-tag">${escapeHtml(item.tag)}</div>` : '';
  return `<div class="dv-card${accent}">${icon}<div class="dv-title">${escapeHtml(item.title)}</div>${body}${tag}</div>`;
}

export function renderDrivers(data: BlockDataMap['drivers']): string {
  const items = data.items ?? [];
  const caption = data.title !== undefined ? `<div class="dv-head">${escapeHtml(data.title)}</div>` : '';
  const desc = data.description !== undefined ? `<p class="dv-desc">${escapeHtml(data.description)}</p>` : '';
  return `<div class="drivers">${caption}${desc}<div class="dv-grid">${items.map(renderDriver).join('')}</div></div>`;
}
