/**
 * Renders a `pullquote` block — a standout quote with optional attribution.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bp } from '../paths.js';

export function renderPullquote(data: BlockDataMap['pullquote']): string {
  const attr =
    data.attribution !== undefined
      ? `<div class="pull-attr"${bp('attribution')}>${escapeHtml(data.attribution)}</div>`
      : '';
  return `<div class="pull"><p class="pull-text"${bp('text')}>${escapeHtml(data.text)}</p>${attr}</div>`;
}
