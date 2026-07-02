/**
 * Renders a `palette` block — colour-token swatches on a responsive card grid
 * (`--pl-cols`, default 4, clamped 2-6; collapses to 2 then 1 column on narrow
 * screens). Each card: a 64px swatch filled with the token's colour, the hex
 * shown in mono inside the swatch bottom-left (in `on`, or an auto-contrast
 * colour computed from the hex's relative luminance), then the token name and
 * an optional usage line. Invalid / unsafe colour values fall back to a
 * neutral gray swatch with dark label text.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { safeColor } from '../sanitize.js';

type PaletteData = BlockDataMap['palette'];
type PaletteColor = PaletteData['colors'][number];

/** Neutral gray swatch used when a colour value is missing or unsafe. */
const FALLBACK_SWATCH = '#d1d5db';
/** Label colours for light / dark swatches. */
const DARK_TEXT = '#1f2937';
const LIGHT_TEXT = '#ffffff';

/** Parses `#rgb` / `#rrggbb` / `#rrggbbaa` into [r, g, b] (0-255), or null. */
function parseHex(value: string): readonly [number, number, number] | null {
  const hex = value.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    const chars = hex.split('');
    return [
      parseInt(`${chars[0]}${chars[0]}`, 16),
      parseInt(`${chars[1]}${chars[1]}`, 16),
      parseInt(`${chars[2]}${chars[2]}`, 16),
    ];
  }
  if (/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(hex)) {
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  }
  return null;
}

/** WCAG relative luminance (0 black .. 1 white) of an [r, g, b] triple. */
function relativeLuminance(rgb: readonly [number, number, number]): number {
  const channel = (v: number): number => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

/** Auto-contrast label colour for a swatch: dark text on light, white on dark. */
export function contrastFor(swatch: string): string {
  const rgb = parseHex(swatch);
  if (rgb === null) return DARK_TEXT;
  return relativeLuminance(rgb) > 0.6 ? DARK_TEXT : LIGHT_TEXT;
}

function renderCard(color: PaletteColor): string {
  const swatch = safeColor(color.value, FALLBACK_SWATCH);
  const label = safeColor(color.on, contrastFor(swatch));
  const usage =
    color.usage !== undefined ? `<div class="pl-usage">${escapeHtml(color.usage)}</div>` : '';
  return (
    `<div class="pl-card">` +
    `<div class="pl-swatch" style="background:${swatch}">` +
    `<span class="pl-hex" style="color:${label}">${escapeHtml(color.value)}</span>` +
    `</div>` +
    `<div class="pl-meta">` +
    `<div class="pl-name">${escapeHtml(color.name)}</div>` +
    usage +
    `</div>` +
    `</div>`
  );
}

export function renderPalette(data: PaletteData): string {
  const head =
    data.title !== undefined ? `<div class="pl-head">${escapeHtml(data.title)}</div>` : '';
  const desc =
    data.description !== undefined
      ? `<p class="pl-desc">${escapeHtml(data.description)}</p>`
      : '';
  const cols = Math.min(6, Math.max(2, Math.floor(data.cols ?? 4)));
  const cards = data.colors.map(renderCard).join('');
  return (
    `<div class="palette">${head}${desc}` +
    `<div class="pl-grid" style="--pl-cols:${cols}">${cards}</div>` +
    `</div>`
  );
}
