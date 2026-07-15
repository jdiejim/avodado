/**
 * Renders an `options` block — the approaches/options explored for a decision.
 * Each card has a kicker, title, an optional "how it works" line, pros and cons
 * lists, and a verdict pill (rejected / viable / chosen / warn). The chosen
 * option is highlighted. Good for "we considered N approaches" sections.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';

type OptionItem = NonNullable<BlockDataMap['options']['items']>[number];

function renderOption(item: OptionItem, idx: number): string {
  const tone = item.tone ?? 'neutral';
  const chosen = tone === 'chosen' ? ' is-chosen' : '';
  const kicker = item.kicker !== undefined ? `<span class="op-kicker">${escapeHtml(item.kicker)}</span>` : '';
  const how = item.how !== undefined ? `<div class="op-how"${bp(`items.${idx}.how`)}>${escapeHtml(item.how)}</div>` : '';
  const pros =
    item.pros !== undefined && item.pros.length > 0
      ? `<ul class="op-list op-pros"${bl(`items.${idx}.pros`)}>${item.pros.map((p, i) => `<li${bp(`items.${idx}.pros.${i}`)}>${escapeHtml(p)}</li>`).join('')}</ul>`
      : '';
  const cons =
    item.cons !== undefined && item.cons.length > 0
      ? `<ul class="op-list op-cons"${bl(`items.${idx}.cons`)}>${item.cons.map((c, i) => `<li${bp(`items.${idx}.cons.${i}`)}>${escapeHtml(c)}</li>`).join('')}</ul>`
      : '';
  const verdict =
    item.verdict !== undefined ? `<div class="op-verdict op-v-${tone}"${bp(`items.${idx}.verdict`)}>${escapeHtml(item.verdict)}</div>` : '';
  return (
    `<div class="op-card${chosen}"${bp(`items.${idx}`)}>` +
    `<div class="op-head op-h-${tone}">${kicker}<span class="op-title"${bp(`items.${idx}.title`)}>${escapeHtml(item.title)}</span></div>` +
    `${how}<div class="op-body">${pros}${cons}</div>${verdict}</div>`
  );
}

export function renderOptions(data: BlockDataMap['options']): string {
  const items = data.items ?? [];
  const caption = data.title !== undefined ? `<div class="op-headline">${escapeHtml(data.title)}</div>` : '';
  const desc = data.description !== undefined ? `<p class="op-desc">${escapeHtml(data.description)}</p>` : '';
  return `<div class="options">${caption}${desc}<div class="op-grid"${bl('items')}>${items.map((item, i) => renderOption(item, i)).join('')}</div></div>`;
}
