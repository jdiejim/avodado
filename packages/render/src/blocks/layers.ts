/**
 * Renders a `layers` block — a vertical stack of numbered layers, each with a
 * kicker/title/source/question in a left meta column and a body on the right.
 * Good for "explain it in N ordered layers" (e.g. an L1/L2/L3 model).
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';

type LayerItem = NonNullable<BlockDataMap['layers']['items']>[number];

function renderLayer(item: LayerItem, n: number): string {
  const meta =
    `<div class="layer-meta">` +
    (item.kicker !== undefined ? `<div class="layer-kicker">${escapeHtml(item.kicker)}</div>` : '') +
    `<div class="layer-title">${escapeHtml(item.title)}</div>` +
    (item.source !== undefined ? `<div class="layer-src">${escapeHtml(item.source)}</div>` : '') +
    (item.question !== undefined ? `<div class="layer-q">${escapeHtml(item.question)}</div>` : '') +
    `</div>`;
  const body =
    item.body !== undefined ? `<div class="layer-body">${escapeHtml(item.body)}</div>` : `<div class="layer-body"></div>`;
  return `<div class="layer"><div class="layer-num">${n}</div>${meta}${body}</div>`;
}

export function renderLayers(data: BlockDataMap['layers']): string {
  const items = data.items ?? [];
  return `<div class="layer-stack">${items.map((it, i) => renderLayer(it, i + 1)).join('')}</div>`;
}
