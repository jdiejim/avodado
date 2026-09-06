/**
 * Renders an `archmap` block — a target-architecture capability map: the
 * classic enterprise-architecture one-pager. A square mosaic of tinted domain
 * areas (accent wash + uppercase kicker label + optional desc), each packed
 * with small capability/system tiles. Tiles are status-coded: a plain string
 * is a current capability (white), `target` is to-be-built (dashed navy on
 * light blue), `new` is just added (green), `gap` is missing (dashed red),
 * `deprecated` is retiring (grayed out). A compact legend below the mosaic
 * shows only the statuses actually used. Empty areas render as just the
 * tinted region with its label.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';

type ArchmapData = BlockDataMap['archmap'];
type ArchmapArea = ArchmapData['areas'][number];
type ArchmapItem = NonNullable<ArchmapArea['items']>[number];

/** A tile's effective status — plain strings and status-less objects are `current`. */
type TileStatus = 'current' | 'target' | 'new' | 'gap' | 'deprecated';

const STATUS_ORDER: readonly TileStatus[] = ['current', 'target', 'new', 'gap', 'deprecated'];

const STATUS_LABEL: Record<TileStatus, string> = {
  current: 'Current',
  target: 'Target',
  new: 'New',
  gap: 'Gap',
  deprecated: 'Deprecated',
};

function statusOf(item: ArchmapItem): TileStatus {
  if (typeof item === 'string') return 'current';
  const s = item.status;
  // Unknown statuses (invalid per schema, but render is lenient) degrade to `current`.
  return s !== undefined && s in STATUS_LABEL ? s : 'current';
}

function nameOf(item: ArchmapItem): string {
  return typeof item === 'string' ? item : item.name;
}

function renderTile(item: ArchmapItem, path: string): string {
  const status = statusOf(item);
  const statusClass = status === 'current' ? '' : ` am-t-${status}`;
  // A gap is a missing capability, not an error: dashed outline plus a word chip.
  const chip = status === 'gap' ? `<span class="t-eyebrow am-chip">Gap</span>` : '';
  return `<div class="am-tile${statusClass}"${bp(path)}>${escapeHtml(nameOf(item))}${chip}</div>`;
}

function renderArea(area: ArchmapArea, ai: number): string {
  const accent = area.accent !== undefined ? ` am-${area.accent}` : '';
  const desc =
    area.desc !== undefined
      ? `<div class="am-area-desc"${bp(`areas.${ai}.desc`)}>${escapeHtml(area.desc)}</div>`
      : '';
  const items = area.items ?? [];
  const tiles =
    items.length > 0
      ? `<div class="am-tiles"${bl(`areas.${ai}.items`)}>${items
          .map((item, j) => renderTile(item, `areas.${ai}.items.${j}`))
          .join('')}</div>`
      : '';
  return (
    `<div class="am-area${accent}"${bp(`areas.${ai}`)}>` +
    `<div class="am-area-label"${bp(`areas.${ai}.label`)}>${escapeHtml(area.label)}</div>` +
    desc +
    tiles +
    `</div>`
  );
}

/**
 * The legend strip (shared `.diagram-legend` style) — one swatch per tile
 * status actually used; omitted when only one status is in play. The gap
 * entry shows its word chip, the same chip the tile carries.
 */
function renderLegend(areas: ArchmapData['areas']): string {
  const used = new Set<TileStatus>();
  for (const area of areas) {
    for (const item of area.items ?? []) used.add(statusOf(item));
  }
  const present = STATUS_ORDER.filter((s) => used.has(s));
  if (present.length < 2) return '';
  const items = present
    .map((s) => {
      const sw =
        s === 'gap'
          ? `<span class="lg-chip t-eyebrow">Gap</span>`
          : `<span class="lg-sw am-sw am-sw-${s}"></span>`;
      return `<span class="lg-item">${sw}<span class="lg-label">${STATUS_LABEL[s]}</span></span>`;
    })
    .join('');
  return `<div class="diagram-legend"><span class="lg-title t-eyebrow">Legend</span>${items}</div>`;
}

export function renderArchmap(data: ArchmapData): string {
  const head =
    data.title !== undefined
      ? `<div class="am-head"${bp('title')}>${escapeHtml(data.title)}</div>`
      : '';
  const desc =
    data.description !== undefined
      ? `<p class="am-desc"${bp('description')}>${escapeHtml(data.description)}</p>`
      : '';
  const cols = data.cols !== undefined ? Math.min(4, Math.max(2, Math.floor(data.cols))) : 3;
  const areas = data.areas.map((area, ai) => renderArea(area, ai)).join('');
  return (
    `<div class="archmap">${head}${desc}` +
    `<div class="am-grid" style="--am-cols:${cols}"${bl('areas')}>${areas}</div>` +
    renderLegend(data.areas) +
    `</div>`
  );
}
