/**
 * Renders a `pullquote` block — a standout quote with optional attribution.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';

export function renderPullquote(data: BlockDataMap['pullquote']): string {
  const attr =
    data.attribution !== undefined
      ? `<div class="pull-attr">${escapeHtml(data.attribution)}</div>`
      : '';
  return `<div class="pull"><p class="pull-text">${escapeHtml(data.text)}</p>${attr}</div>`;
}
