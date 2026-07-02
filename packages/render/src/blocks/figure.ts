/**
 * Renders a `figure` block — an image with an optional caption, framed as a
 * bordered card. The `src` URL is sanitised (`safeUrl`), and `width` (a
 * number, px) caps the image via an inline `max-width`.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { safeUrl } from '../sanitize.js';

export function renderFigure(data: BlockDataMap['figure']): string {
  const width =
    data.width !== undefined && Number.isFinite(data.width) && data.width > 0
      ? ` style="max-width:${Math.round(data.width)}px"`
      : '';
  const alt = data.alt ?? data.caption ?? '';
  const caption =
    data.caption !== undefined
      ? `<figcaption class="fig-cap">${escapeHtml(data.caption)}</figcaption>`
      : '';
  return (
    `<figure class="fig">` +
    `<img class="fig-img" src="${escapeHtml(safeUrl(data.src))}" alt="${escapeHtml(alt)}"${width}>` +
    caption +
    `</figure>`
  );
}
