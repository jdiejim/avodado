/**
 * Renders a `pullquote` block — a standout quote with optional attribution.
 * The quote text renders as inline Markdown (pairs with core's bare-text body
 * sugar: a pullquote fence can be just the quote itself).
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { renderInlineMd } from '../markdown.js';
import { bp } from '../paths.js';

export function renderPullquote(data: BlockDataMap['pullquote']): string {
  const attr =
    data.attribution !== undefined
      ? `<div class="pull-attr"${bp('attribution')}>${escapeHtml(data.attribution)}</div>`
      : '';
  return `<div class="pull"><p class="pull-text"${bp('text')}>${renderInlineMd(data.text)}</p>${attr}</div>`;
}
